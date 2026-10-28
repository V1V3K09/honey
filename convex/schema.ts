import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  slips: defineTable({
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
    likes: v.number(),
    rotation: v.number(),
    clientSubmissionId: v.string(), // Idempotency key to prevent duplicates
    createdAt: v.number(),          // Timestamp in ms
    status: v.union(v.literal("active"), v.literal("hidden")), // Moderation flag
  })
    .index("by_created_at", ["createdAt"])
    .index("by_client_id", ["clientSubmissionId"]),

  // Operation idempotency log to guarantee like deltas cannot double-apply on network retry
  appliedOps: defineTable({
    opId: v.string(),
    createdAt: v.number(),
  })
    .index("by_op_id", ["opId"])
    .index("by_created_at", ["createdAt"]),
});
