import { ErrorCode } from '@/constants/error-code';
import { ERROR_MESSAGE } from '@/constants/message';
import Tool from '@/db/models/tool.model';
import Upvote from '@/db/models/upvote.model';
import { conflict } from '@/errors/AppError';
import { findToolOrThrow } from '@/services/tool.service';
import { isDuplicateKeyError, toObjectId } from '@/utils/mongo.util';
import type { AnyBulkWriteOperation, Types } from 'mongoose';

/**
 * Records one user's upvote for one tool.
 *
 * The write order matters. The `Upvote` document goes in first, because the
 * unique { user, tool } index on it is what actually enforces one-vote-per-user
 * — a read-then-write check in application code would let two concurrent
 * requests from the same user both see "not yet voted" and both insert. Only
 * once that insert succeeds does the denormalized counter move.
 *
 * The two writes are not transactional. A crash in between leaves the counter
 * one short of the truth, which `npm run reconcile` repairs from the source of
 * truth below. That is the deliberate trade: an upvote tally does not justify
 * the latency of a distributed transaction on every vote, and the error mode is
 * a slightly low number rather than a lost or duplicated vote.
 */
export const upvoteTool = async (userId: string, toolId: string) => {
  const tool = await findToolOrThrow(toolId);
  const user = toObjectId(userId);

  try {
    await Upvote.create({ user, tool: tool._id });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw conflict(ERROR_MESSAGE.ALREADY_UPVOTED, ErrorCode.ALREADY_UPVOTED);
    }

    throw err;
  }

  const updated = await Tool.findByIdAndUpdate(
    tool._id,
    { $inc: { upvoteCount: 1 } },
    { returnDocument: 'after' },
  );

  return {
    id: tool._id.toString(),
    name: tool.name,
    upvoteCount: updated?.upvoteCount ?? tool.upvoteCount + 1,
    hasUpvoted: true,
  };
};

export const removeUpvote = async (userId: string, toolId: string) => {
  const tool = await findToolOrThrow(toolId);

  const removed = await Upvote.findOneAndDelete({ user: toObjectId(userId), tool: tool._id });

  if (!removed) {
    throw conflict(ERROR_MESSAGE.NOT_UPVOTED, ErrorCode.NOT_UPVOTED);
  }

  // The `upvoteCount: { $gt: 0 }` clause is part of the filter, not the update,
  // so a counter that had already drifted to zero simply does not match and the
  // decrement is skipped — there is no path here that stores a negative count.
  const updated = await Tool.findOneAndUpdate(
    { _id: tool._id, upvoteCount: { $gt: 0 } },
    { $inc: { upvoteCount: -1 } },
    { returnDocument: 'after' },
  );

  return {
    id: tool._id.toString(),
    name: tool.name,
    // `updated` is null only when the guard above declined the decrement.
    upvoteCount: updated?.upvoteCount ?? 0,
    hasUpvoted: false,
  };
};

/**
 * Rebuilds every `Tool.upvoteCount` by counting the `upvotes` collection.
 *
 * This is what makes the denormalized counter safe to rely on: whenever the
 * cache and the source of truth disagree, the source of truth wins and this
 * puts them back in step. Run by `npm run reconcile`.
 */
export const reconcileUpvoteCounts = async () => {
  const grouped = await Upvote.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $group: { _id: '$tool', total: { $sum: 1 } } },
  ]);

  const actualByTool = new Map(grouped.map(({ _id, total }) => [_id.toString(), total]));
  const tools = await Tool.find({}, { upvoteCount: 1 });

  const operations: AnyBulkWriteOperation[] = [];
  const corrections: { id: string; from: number; to: number }[] = [];

  for (const tool of tools) {
    const actual = actualByTool.get(tool._id.toString()) ?? 0;

    if (actual !== tool.upvoteCount) {
      corrections.push({ id: tool._id.toString(), from: tool.upvoteCount, to: actual });
      operations.push({
        updateOne: { filter: { _id: tool._id }, update: { $set: { upvoteCount: actual } } },
      });
    }
  }

  if (operations.length) {
    await Tool.bulkWrite(operations);
  }

  return { checked: tools.length, corrected: corrections.length, corrections };
};
