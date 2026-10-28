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
// Prevents expensive individual writes and eliminates quota exhaustion under high traffic.
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
        slipId: v.string(),
        delta: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const insertedIds: string[] = [];

    // Process new slip submissions with idempotency protection
    for (const slip of args.newSlips) {
      const author = slip.author.trim().slice(0, 36);
      const tag = slip.tag.trim().slice(0, 32);
      const message = slip.message.trim().slice(0, 280);

      if (!author || !message) continue;

      // Check if already inserted via clientSubmissionId idempotency key
      const existing = await ctx.db
        .query("slips")
        .withIndex("by_client_id", (q) => q.eq("clientSubmissionId", slip.clientSubmissionId))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("slips", {
          author,
          tag: tag || "Aki Fan Club",
          message,
          color: slip.color,
          stamp: slip.stamp,
          rotation: slip.rotation,
          clientSubmissionId: slip.clientSubmissionId,
          likes: 1,
          createdAt: Date.now(),
          status: "active",
        });
        insertedIds.push(id);
      } else {
        insertedIds.push(existing._id);
      }
    }

    // Apply coalesced likes atomically
    for (const { slipId, delta } of args.likeDeltas) {
      if (delta === 0) continue;

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

      if (doc) {
        const newLikes = Math.max(0, doc.likes + delta);
        await ctx.db.patch(doc._id, { likes: newLikes });
      }
    }

    return {
      success: true,
      insertedCount: insertedIds.length,
      processedLikes: args.likeDeltas.length,
    };
  },
});
