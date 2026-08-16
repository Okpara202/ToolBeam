/**
 * Every tunable number behind the two ranking algorithms, in one place.
 *
 * Ranking is the product. Burying these as magic numbers inside aggregation
 * pipelines would make the system impossible to reason about or tune, so the
 * pipelines in services/ranking.service.ts read every weight from here.
 */

// --- Popularity: upvotes discounted by age -------------------------------
//
//   score = upvoteCount / (ageHours + DECAY_OFFSET_HOURS) ^ GRAVITY
//
// GRAVITY controls how fast yesterday's winners fall away. 1.5 is the Hacker
// News exponent: high enough that a genuinely new tool can break through,
// low enough that a landmark tool does not vanish in a week.
export const GRAVITY = 1.5;

// Stops the denominator collapsing toward zero (and the score toward Infinity)
// for a tool submitted seconds ago.
export const DECAY_OFFSET_HOURS = 2;

// --- Relatedness: weighted overlap of shared attributes ------------------
//
//   score = CATEGORY x (same category)
//         + TAG      x (# shared tags)
//         + KEYWORD  x (# shared keywords)
//         + POPULARITY x (normalized upvotes)   <- tie-breaker only
//
// The ordering matters more than the exact values: one shared category
// outranks one shared tag, which outranks one incidental shared keyword.
// Popularity is weighted low on purpose — it breaks ties between equally
// related tools, it must never make an unrelated-but-famous tool surface.
export const RELATED_WEIGHT = {
  CATEGORY: 3,
  TAG: 2,
  KEYWORD: 1,
  POPULARITY: 0.5,
} as const;

// Upvote count at which the popularity tie-breaker saturates, so a tool with
// 10,000 upvotes cannot let its 0.5 weight overpower a real category match.
export const POPULARITY_SATURATION = 100;

// --- Shared paging defaults ----------------------------------------------
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

export enum PopularWindow {
  ALL = 'all',
  WEEK = 'week',
  MONTH = 'month',
}

export const WINDOW_DAYS: Record<Exclude<PopularWindow, PopularWindow.ALL>, number> = {
  [PopularWindow.WEEK]: 7,
  [PopularWindow.MONTH]: 30,
};
