import {
  DECAY_OFFSET_HOURS,
  GRAVITY,
  POPULARITY_SATURATION,
  PopularWindow,
  RELATED_WEIGHT,
  WINDOW_DAYS,
} from '@/constants/ranking';
import Tool from '@/db/models/tool.model';
import Upvote from '@/db/models/upvote.model';
import { findToolOrThrow, toolProjectionStage, type ToolView } from '@/services/tool.service';
import type { PipelineStage } from 'mongoose';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export interface PopularTool extends ToolView {
  popularityScore: number;
  ageHours?: number;
  windowUpvotes?: number;
}

export interface RelatedTool extends ToolView {
  relevanceScore: number;
  matchedOn: {
    sameCategory: boolean;
    sharedTags: string[];
    sharedKeywords: string[];
  };
}

// ===========================================================================
// POPULARITY
// ===========================================================================
//
// What makes a tool popular here: upvotes, discounted by how long the tool has
// had to collect them. A tool that gathered 50 upvotes last week is a stronger
// signal to a visitor than one that gathered 60 over two years, so it ranks
// higher. Without that discount "popular" ossifies — whatever launched first
// accumulates the most votes and never moves, which is precisely the discovery
// problem this directory exists to solve.
//
// Where it lives in the database, in two tiers:
//
//   1. The `upvotes` collection is the source of truth — one document per
//      (user, tool), made idempotent by a unique compound index on
//      { user, tool }. Its `createdAt` is what makes the windowed view below
//      possible.
//   2. `tools.upvoteCount` is a denormalized counter kept by an atomic `$inc`
//      and backed by a `{ upvoteCount: -1 }` index, so a ranking read never has
//      to count documents across collections.
//
// What is deliberately NOT stored is the score itself. It changes every second
// for no reason other than tools getting older, so any persisted value is stale
// the moment it is written and would need a cron job rewriting every document
// forever. Instead it is computed at read time against `$$NOW` — the server
// clock at the instant of the query — which is always current and costs one
// pass over an already-indexed collection.
// ===========================================================================

/** Age of each tool in hours, measured against the server clock at query time. */
const ageHoursStage: PipelineStage = {
  $addFields: {
    ageHours: { $divide: [{ $subtract: ['$$NOW', '$createdAt'] }, MS_PER_HOUR] },
  },
};

/**
 *   score = upvoteCount / (ageHours + DECAY_OFFSET_HOURS) ^ GRAVITY
 *
 * The numerator is the raw count with no `+1` smoothing: a tool with zero
 * upvotes must score exactly zero and sink, otherwise /popular drifts into
 * ranking brand-new tools highly on recency alone and stops being meaningfully
 * different from /recent.
 */
const popularityScoreStage: PipelineStage = {
  $addFields: {
    popularityScore: {
      $divide: ['$upvoteCount', { $pow: [{ $add: ['$ageHours', DECAY_OFFSET_HOURS] }, GRAVITY] }],
    },
  },
};

const POPULAR_SORT: PipelineStage = {
  $sort: { popularityScore: -1, upvoteCount: -1, createdAt: -1 },
};

/** All-time popularity: every tool, ranked by lifetime upvotes decayed by age. */
const allTimePopular = (limit: number) =>
  Tool.aggregate<PopularTool>([
    ageHoursStage,
    popularityScoreStage,
    POPULAR_SORT,
    { $limit: limit },
    toolProjectionStage({
      // Exposed in the response so a client — or a reviewer reading the JSON —
      // can see exactly why this ordering came out the way it did.
      popularityScore: { $round: ['$popularityScore', 6] },
      ageHours: { $round: ['$ageHours', 1] },
    }),
  ]);

/**
 * Trending: ranked purely by upvotes cast *inside* the window.
 *
 * No age decay here, on purpose. The window already bounds recency, and
 * decaying by tool age on top of it would penalise an older tool that is
 * genuinely having a resurgence — exactly the thing a trending view should
 * surface.
 *
 * The pipeline starts from `upvotes` rather than from `tools` so it only ever
 * touches tools that actually received a vote in the window, instead of
 * scanning the whole directory to discover that most of them received none.
 */
const windowedPopular = (limit: number, days: number) => {
  const since = new Date(Date.now() - days * MS_PER_DAY);

  return Upvote.aggregate<PopularTool>([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$tool', windowUpvotes: { $sum: 1 } } },
    { $sort: { windowUpvotes: -1, _id: 1 } },
    { $limit: limit },
    { $lookup: { from: 'tools', localField: '_id', foreignField: '_id', as: 'tool' } },
    { $unwind: '$tool' },
    { $replaceRoot: { newRoot: { $mergeObjects: ['$tool', { windowUpvotes: '$windowUpvotes' }] } } },
    { $sort: { windowUpvotes: -1, createdAt: -1 } },
    toolProjectionStage({
      windowUpvotes: 1,
      popularityScore: '$windowUpvotes',
    }),
  ]);
};

export const getPopularTools = async (limit: number, window: PopularWindow) => {
  if (window === PopularWindow.ALL) {
    return allTimePopular(limit);
  }

  return windowedPopular(limit, WINDOW_DAYS[window]);
};

// ===========================================================================
// RELATEDNESS
// ===========================================================================
//
// Two constraints shaped this design:
//
//   - It has to work for a tool submitted seconds ago with zero upvotes and no
//     interaction history, so it cannot lean on behavioural signal. A
//     collaborative "users who upvoted this also upvoted…" approach needs dense
//     voting data; on a young directory it degrades into noise, which is worse
//     than useless in a discovery product.
//   - It has to never return an empty list. A dead end is the single worst
//     outcome for someone browsing, so the backfill below guarantees results.
//
// So relatedness is content-based, scored over three overlapping attributes and
// tie-broken by popularity:
//
//   score = CATEGORY   x (same category ? 1 : 0)
//         + TAG        x |shared tags|
//         + KEYWORD    x |shared keywords|
//         + POPULARITY x min(1, upvotes / SATURATION)
//
// All three signals are arrays, which is the trick that makes this cheap: each
// one is a `$setIntersection` in a single pass, with no text index and no
// second query. `keywords` is derived from name + description on write (see
// extractKeywords) precisely so free-text similarity can join that same shape.
//
// Popularity is weighted lowest and saturates, so it only ever separates two
// equally-related tools — a famous but unrelated tool can never outrank a
// genuine match.
// ===========================================================================

export const getRelatedTools = async (toolId: string, limit: number) => {
  const source = await findToolOrThrow(toolId);

  // Mongoose arrays are proxies; copy to plain arrays before they go into a
  // pipeline as literal operands.
  const sourceTags = [...source.tags];
  const sourceKeywords = [...source.keywords];

  const candidates = await Tool.aggregate<RelatedTool>([
    {
      $match: {
        _id: { $ne: source._id },
        // Anything sharing at least one signal is a candidate; the scoring
        // stage below decides how strong a candidate it is. An `$in` against an
        // empty array simply matches nothing, so a tool with no tags still gets
        // its category and keyword clauses.
        $or: [
          { category: source.category },
          { tags: { $in: sourceTags } },
          { keywords: { $in: sourceKeywords } },
        ],
      },
    },
    {
      $addFields: {
        sameCategory: { $eq: ['$category', source.category] },
        sharedTags: { $setIntersection: ['$tags', sourceTags] },
        sharedKeywords: { $setIntersection: ['$keywords', sourceKeywords] },
      },
    },
    {
      $addFields: {
        relevanceScore: {
          $add: [
            { $cond: ['$sameCategory', RELATED_WEIGHT.CATEGORY, 0] },
            { $multiply: [RELATED_WEIGHT.TAG, { $size: '$sharedTags' }] },
            { $multiply: [RELATED_WEIGHT.KEYWORD, { $size: '$sharedKeywords' }] },
            {
              $multiply: [
                RELATED_WEIGHT.POPULARITY,
                { $min: [1, { $divide: ['$upvoteCount', POPULARITY_SATURATION] }] },
              ],
            },
          ],
        },
      },
    },
    { $sort: { relevanceScore: -1, upvoteCount: -1, createdAt: -1 } },
    { $limit: limit },
    toolProjectionStage({
      relevanceScore: { $round: ['$relevanceScore', 3] },
      // Returned so the reason for each match is visible in the response rather
      // than hidden inside the pipeline.
      matchedOn: {
        sameCategory: '$sameCategory',
        sharedTags: '$sharedTags',
        sharedKeywords: '$sharedKeywords',
      },
    }),
  ]);

  const related =
    candidates.length >= limit
      ? candidates
      : [...candidates, ...(await backfillRelated(source._id, candidates, limit))];

  return {
    // Echoed back so a caller can see what the results were matched against.
    source: {
      id: source._id.toString(),
      name: source.name,
      category: source.category,
      tags: sourceTags,
    },
    related,
  };
};

/**
 * Tops up a short result set with popular tools, so a niche submission — the
 * only entry in its category, with tags nobody else uses — still leads
 * somewhere instead of dead-ending the visitor.
 *
 * These carry `relevanceScore: 0` and an empty `matchedOn`, which is the
 * response saying plainly: nothing genuinely matched, here is what people are
 * upvoting instead.
 */
const backfillRelated = async (
  sourceId: unknown,
  found: RelatedTool[],
  limit: number,
): Promise<RelatedTool[]> => {
  const alreadyShown = found.map((tool) => tool.id);

  return Tool.aggregate<RelatedTool>([
    {
      $match: {
        _id: { $ne: sourceId },
        // Compared as strings because the projection above already stringified
        // the ids that came back.
        $expr: { $not: { $in: [{ $toString: '$_id' }, alreadyShown] } },
      },
    },
    ageHoursStage,
    popularityScoreStage,
    POPULAR_SORT,
    { $limit: limit - found.length },
    toolProjectionStage({
      // `$literal` is required: a bare 0 / false / [] inside `$project` would be
      // read as a field-exclusion flag rather than as a value.
      relevanceScore: { $literal: 0 },
      matchedOn: {
        sameCategory: { $literal: false },
        sharedTags: { $literal: [] },
        sharedKeywords: { $literal: [] },
      },
    }),
  ]);
};
