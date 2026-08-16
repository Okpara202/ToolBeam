import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * The source of truth for popularity.
 *
 * One document per (user, tool). `Tool.upvoteCount` is a derived cache of how
 * many of these exist; if the two ever disagree, this collection wins — that is
 * what `npm run reconcile` rebuilds from.
 */
const upvoteSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tool: {
      type: Schema.Types.ObjectId,
      ref: 'Tool',
      required: true,
    },
  },
  { timestamps: true },
);

/**
 * The idempotency guarantee, enforced by the database rather than by
 * application code.
 *
 * A check-then-insert in the service would still let two concurrent requests
 * from the same user both pass the check and both insert. This index makes the
 * second write fail with E11000 no matter how the requests interleave, and the
 * upvote service turns that error into a 409.
 */
upvoteSchema.index({ user: 1, tool: 1 }, { unique: true });

// Backs the ?window=week|month trending pipeline, which starts from this
// collection and groups by tool.
upvoteSchema.index({ tool: 1, createdAt: -1 });
upvoteSchema.index({ createdAt: -1 });

export type Upvote = InferSchemaType<typeof upvoteSchema>;
export type UpvoteDocument = HydratedDocument<Upvote>;

export default model('Upvote', upvoteSchema);
