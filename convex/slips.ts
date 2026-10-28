import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 1. Reactive Real-Time Query: Returns active slips ordered newest first
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("slips")
      .withIndex("by_created_at")
      .order("desc")
      .filter((q) => q.eq(q.field("status"), "active"))
      .take(150);
  },
});

// 2. High-Efficiency io_uring Batch Sync Mutation:
// Combines multiple new slip creations and coalesced like deltas into 1 atomic transaction.
// Enforces strict idempotency on both slip creations and like operations to ensure retry safety.
export const batchSync = mutation({
  args: {
    newSlips: v.array(
      v.object({
        author: v.string(),
        tag: v.string(),
        message: v.string(),
        color: v.union(
          v.literal("yellow"),
          v.literal("pink"),
          v.literal("mint"),
          v.literal("sky"),
          v.literal("kraft")
        ),
        stamp: v.string(),
        rotation: v.number(),
        clientSubmissionId: v.string(),
      })
    ),
    likeDeltas: v.array(
      v.object({
        opId: v.optional(v.string()), // Unique operation ID for like idempotency
        slipId: v.string(),
        delta: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Enforce server-side batch boundaries to prevent abuse
    if (args.newSlips.length > 20) {
      throw new Error("Batch size limit exceeded: maximum 20 slips per request.");
    }
    if (args.likeDeltas.length > 64) {
      throw new Error("Batch size limit exceeded: maximum 64 like deltas per request.");
    }

    let newlyInsertedCount = 0;
    let duplicateCount = 0;
    let rejectedSlipsCount = 0;

    const slipResults: Array<{
      clientSubmissionId: string;
      slipId?: string;
      status: "inserted" | "duplicate" | "rejected";
      reason?: string;
    }> = [];

    // 1. Process new slip submissions with strict idempotency protection
    for (const slip of args.newSlips) {
      const author = slip.author.trim().slice(0, 36);
      const tag = slip.tag.trim().slice(0, 32);
      const message = slip.message.trim().slice(0, 280);
      const clientSubmissionId = slip.clientSubmissionId.trim();

      if (!author || !message || !clientSubmissionId) {
        rejectedSlipsCount++;
        slipResults.push({
          clientSubmissionId: clientSubmissionId || "unknown",
          status: "rejected",
          reason: "Author, message, and clientSubmissionId are required.",
        });
        continue;
      }

      // Check if already inserted via clientSubmissionId idempotency key
      const existing = await ctx.db
        .query("slips")
        .withIndex("by_client_id", (q) => q.eq("clientSubmissionId", clientSubmissionId))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("slips", {
          author,
          tag: tag || "Aki Fan Club",
          message,
          color: slip.color,
          stamp: slip.stamp,
          rotation: slip.rotation,
          clientSubmissionId,
          likes: 1, // Note: starts at 1 because author implicitly likes their own pinned wish note
          createdAt: Date.now(),
          status: "active",
        });
        newlyInsertedCount++;
        slipResults.push({
          clientSubmissionId,
          slipId: id,
          status: "inserted",
        });
      } else {
        duplicateCount++;
        slipResults.push({
          clientSubmissionId,
          slipId: existing._id,
          status: "duplicate",
        });
      }
    }

    // 2. Apply coalesced likes atomically with operation-level idempotency
    let appliedLikesCount = 0;
    let alreadyAppliedLikesCount = 0;

    const likeResults: Array<{
      opId?: string;
      slipId: string;
      status: "applied" | "already_applied" | "not_found" | "rejected";
      newLikes?: number;
      error?: string;
    }> = [];

    for (const { slipId, delta, opId } of args.likeDeltas) {
      if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
        likeResults.push({
          opId,
          slipId,
          status: "rejected",
          error: "Delta must be a non-zero finite integer.",
        });
        continue;
      }

      // Check idempotency if an operation ID was provided
      if (opId) {
        const alreadyApplied = await ctx.db
          .query("appliedOps")
          .withIndex("by_op_id", (q) => q.eq("opId", opId))
          .first();

        if (alreadyApplied) {
          alreadyAppliedLikesCount++;
          // Fetch current likes to return updated state
          let currentLikes: number | undefined;
          const normalizedId = ctx.db.normalizeId("slips", slipId);
          if (normalizedId) {
            const currentDoc = await ctx.db.get(normalizedId);
            currentLikes = currentDoc?.likes;
          }
          likeResults.push({
            opId,
            slipId,
            status: "already_applied",
            newLikes: currentLikes,
          });
          continue;
        }
      }

      const clampedDelta = Math.max(-100, Math.min(100, delta));

      let doc = null;
      const normalizedId = ctx.db.normalizeId("slips", slipId);
      if (normalizedId) {
        doc = await ctx.db.get(normalizedId);
      }

      if (!doc) {
        doc = await ctx.db
          .query("slips")
          .withIndex("by_client_id", (q) => q.eq("clientSubmissionId", slipId))
          .first();
      }

      if (!doc) {
        likeResults.push({
          opId,
          slipId,
          status: "not_found",
          error: `Slip '${slipId}' was not found.`,
        });
        continue;
      }

      const newLikes = Math.max(0, doc.likes + clampedDelta);
      await ctx.db.patch(doc._id, { likes: newLikes });
      appliedLikesCount++;

      // Record opId in appliedOps to ensure retries never double-apply
      if (opId) {
        await ctx.db.insert("appliedOps", {
          opId,
          createdAt: Date.now(),
        });
      }

      likeResults.push({
        opId,
        slipId,
        status: "applied",
        newLikes,
      });
    }

    return {
      success: true,
      slips: slipResults,
      likes: likeResults,
      insertedCount: newlyInsertedCount,
      duplicateCount,
      rejectedSlipsCount,
      appliedLikesCount,
      alreadyAppliedLikesCount,
    };
  },
});
