import { CATEGORIES } from '@/constants/category';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const toolSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: CATEGORIES,
    },
    link: {
      type: String,
      required: true,
      trim: true,
    },
    /**
     * The link reduced to a comparison key (no protocol, no "www.", no trailing
     * slash, lowercased) — see normalizeLink(). Carrying the key as its own
     * field is what lets a unique index enforce "one entry per tool" without
     * forcing everyone to submit a byte-identical URL.
     */
    linkKey: {
      type: String,
      required: true,
      unique: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    /**
     * Derived from name + description on every write, never client-supplied.
     * Makes free-text similarity a plain array intersection in the relatedness
     * pipeline. See extractKeywords().
     */
    keywords: {
      type: [String],
      default: [],
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /**
     * Denormalized count of documents in the `upvotes` collection for this tool.
     * The Upvote collection remains the source of truth; this exists so that
     * ranking reads never have to count across collections.
     */
    upvoteCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

// /tools/recent — newest first.
toolSchema.index({ createdAt: -1 });
// /tools/popular — the decay pipeline sorts on a computed score, but this
// backs the plain count sort and the relatedness tie-breaker.
toolSchema.index({ upvoteCount: -1 });
// /tools/:id/related — the candidate lookup is an $or across these three.
toolSchema.index({ category: 1 });
toolSchema.index({ tags: 1 });
toolSchema.index({ keywords: 1 });

export type Tool = InferSchemaType<typeof toolSchema>;
export type ToolDocument = HydratedDocument<Tool>;

export default model('Tool', toolSchema);
