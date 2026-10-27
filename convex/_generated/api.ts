import { anyApi, makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";

export interface SlipDoc {
  _id: string;
  _creationTime: number;
  author: string;
  tag: string;
  message: string;
  color: "yellow" | "pink" | "mint" | "sky" | "kraft";
  stamp: string;
  likes: number;
  rotation: number;
  clientSubmissionId: string;
  createdAt: number;
  status: "active" | "hidden";
}

export interface NewSlipPayload {
  author: string;
  tag: string;
  message: string;
  color: "yellow" | "pink" | "mint" | "sky" | "kraft";
  stamp: string;
  rotation: number;
  clientSubmissionId: string;
}

export interface LikeDeltaPayload {
  slipId: string;
  delta: number;
}

export const api = anyApi as unknown as {
  slips: {
    list: FunctionReference<"query", "public", Record<string, never>, SlipDoc[]>;
    batchSync: FunctionReference<
      "mutation",
      "public",
      {
        newSlips: NewSlipPayload[];
        likeDeltas: LikeDeltaPayload[];
      },
      {
        success: boolean;
        insertedCount: number;
        processedLikes: number;
      }
    >;
  };
};
