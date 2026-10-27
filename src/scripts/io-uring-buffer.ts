// io-uring-buffer.ts — Asynchronous Ring Buffer, Write Coalescing & Batch Subsystem for Convex DB
import type { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

export type SlipColor = 'yellow' | 'pink' | 'mint' | 'sky' | 'kraft';

export interface NewSlipPayload {
  author: string;
  tag: string;
  message: string;
  color: SlipColor;
  stamp: string;
  rotation: number;
  clientSubmissionId: string;
}

export interface LikeDeltaPayload {
  slipId: string;
  delta: number;
}

export type IoOpType = 'INSERT_SLIP' | 'TOGGLE_LIKE';

export interface IoSubmissionEntry {
  sqeId: number;
  op: IoOpType;
  slipPayload?: NewSlipPayload;
  slipId?: string;
  likeDelta?: number;
  timestamp: number;
}

export interface IoCompletionEntry {
  cqeId: number;
  sqeId: number;
  success: boolean;
  timestamp: number;
  insertedCount?: number;
  error?: string;
}

export interface IoUringStats {
  sqPending: number;
  cqCompleted: number;
  coalescedLikesSaved: number;
  totalBatchesFlushed: number;
  lastSyncTimestamp: number;
}

/**
 * IoUringBatcher: An io_uring-inspired high-throughput, non-blocking asynchronous
 * write-coalescing ring buffer that absorbs UI events and flushes batched mutations to Convex.
 */
export class IoUringBatcher {
  private convex: ConvexClient | null = null;
  private isOnline = true;
  private isFlushing = false;

  // Ring Buffer Parameters
  private readonly RING_CAPACITY = 128;
  private sqRing: IoSubmissionEntry[] = [];
  private cqRing: IoCompletionEntry[] = [];
  private nextSqeId = 1;
  private nextCqeId = 1;

  // Write Coalescing Map for Likes (slipId ➔ Net Delta)
  private likeDeltas = new Map<string, number>();

  // Token Bucket Rate Limiter
  private lastSlipSubmitTime = 0;
  private readonly SLIP_SUBMIT_MIN_INTERVAL = 3000; // 3 seconds min between note creations

  // Stats
  private coalescedLikesSaved = 0;
  private totalBatchesFlushed = 0;
  private lastSyncTimestamp = Date.now();

  // Ticker Interval
  private flushTimer: number | null = null;
  private readonly FLUSH_INTERVAL_MS = 2200; // 2.2 second debounce window

  constructor(convexClient: ConvexClient | null = null) {
    this.convex = convexClient;
    this.initLifecycle();
  }

  public setClient(client: ConvexClient | null) {
    this.convex = client;
  }

  private initLifecycle() {
    // Start background drainer timer
    this.startTicker();

    // Listen to network status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      // Emergency flush on tab background or close
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushQueue();
        }
      });

      window.addEventListener('beforeunload', () => {
        this.flushQueue();
      });
    }
  }

  private startTicker() {
    if (this.flushTimer) return;
    this.flushTimer = window.setInterval(() => {
      if (this.hasPendingWrites()) {
        this.flushQueue();
      }
    }, this.FLUSH_INTERVAL_MS);
  }

  public hasPendingWrites(): boolean {
    return this.sqRing.length > 0 || this.likeDeltas.size > 0;
  }

  /**
   * Enqueue a new slip insertion (SQE)
   */
  public enqueueSlip(payload: NewSlipPayload): { accepted: boolean; sqeId?: number; reason?: string } {
    const now = Date.now();

    // Rate limiter check
    if (now - this.lastSlipSubmitTime < this.SLIP_SUBMIT_MIN_INTERVAL) {
      return { accepted: false, reason: 'Please wait a moment before pinning another slip.' };
    }

    if (this.sqRing.length >= this.RING_CAPACITY) {
      return { accepted: false, reason: 'Submission queue full. Syncing in progress...' };
    }

    this.lastSlipSubmitTime = now;
    const sqeId = this.nextSqeId++;

    const entry: IoSubmissionEntry = {
      sqeId,
      op: 'INSERT_SLIP',
      slipPayload: payload,
      timestamp: now,
    };

    this.sqRing.push(entry);
    this.notifyTelemetry();

    return { accepted: true, sqeId };
  }

  /**
   * Enqueue a like toggle with instant local write-coalescing (SQE)
   * Rapid repeated clicks collapse into a single net delta (e.g. +1, 0, -1).
   */
  public enqueueLike(slipId: string, delta: number): { netDelta: number; isCoalesced: boolean } {
    const currentNet = this.likeDeltas.get(slipId) || 0;
    const newNet = currentNet + delta;

    if (currentNet !== 0) {
      this.coalescedLikesSaved++;
    }

    if (newNet === 0) {
      // Net change cancelled out (e.g. liked and unliked before flush) ➔ 0 DB writes needed!
      this.likeDeltas.delete(slipId);
    } else {
      this.likeDeltas.set(slipId, newNet);
    }

    this.notifyTelemetry();
    return { netDelta: newNet, isCoalesced: currentNet !== 0 };
  }

  /**
   * Drain the SQ Ring Buffer into a single Convex batchSync transaction
   */
  public async flushQueue(): Promise<boolean> {
    if (this.isFlushing || !this.hasPendingWrites()) {
      return true;
    }

    // If Convex is not configured or offline, preserve in queue or fallback
    if (!this.convex || !this.isOnline) {
      return false;
    }

    this.isFlushing = true;

    // 1. Drain pending slips from SQ
    const drainedSlips: NewSlipPayload[] = [];
    const drainedSqeIds: number[] = [];

    while (this.sqRing.length > 0) {
      const entry = this.sqRing.shift();
      if (entry && entry.op === 'INSERT_SLIP' && entry.slipPayload) {
        drainedSlips.push(entry.slipPayload);
        drainedSqeIds.push(entry.sqeId);
      }
    }

    // 2. Drain coalesced like deltas
    const drainedLikes: LikeDeltaPayload[] = [];
    for (const [slipId, delta] of this.likeDeltas.entries()) {
      if (delta !== 0) {
        drainedLikes.push({ slipId, delta });
      }
    }
    this.likeDeltas.clear();

    if (drainedSlips.length === 0 && drainedLikes.length === 0) {
      this.isFlushing = false;
      return true;
    }

    try {
      // Execute 1 Single Atomic Batched Mutation
      const result = await this.convex.mutation(api.slips.batchSync, {
        newSlips: drainedSlips,
        likeDeltas: drainedLikes,
      });

      this.totalBatchesFlushed++;
      this.lastSyncTimestamp = Date.now();

      // Emit CQE completions
      for (const sqeId of drainedSqeIds) {
        this.cqRing.push({
          cqeId: this.nextCqeId++,
          sqeId,
          success: true,
          timestamp: Date.now(),
          insertedCount: result.insertedCount,
        });
      }

      // Keep CQ Ring within capacity
      if (this.cqRing.length > this.RING_CAPACITY) {
        this.cqRing.splice(0, this.cqRing.length - this.RING_CAPACITY);
      }

      this.notifyTelemetry();
      this.isFlushing = false;
      return true;
    } catch (err: any) {
      console.warn('[io_uring] Batch flush failed, returning items to submission queue:', err);

      // On failure, re-queue drained slips so data is never lost
      for (let i = drainedSlips.length - 1; i >= 0; i--) {
        this.sqRing.unshift({
          sqeId: drainedSqeIds[i] || this.nextSqeId++,
          op: 'INSERT_SLIP',
          slipPayload: drainedSlips[i],
          timestamp: Date.now(),
        });
      }

      // Re-queue like deltas
      for (const item of drainedLikes) {
        const cur = this.likeDeltas.get(item.slipId) || 0;
        this.likeDeltas.set(item.slipId, cur + item.delta);
      }

      this.isFlushing = false;
      return false;
    }
  }

  public getStats(): IoUringStats {
    return {
      sqPending: this.sqRing.length + this.likeDeltas.size,
      cqCompleted: this.cqRing.length,
      coalescedLikesSaved: this.coalescedLikesSaved,
      totalBatchesFlushed: this.totalBatchesFlushed,
      lastSyncTimestamp: this.lastSyncTimestamp,
    };
  }

  private notifyTelemetry() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('birthday:io-uring-stats', {
          detail: this.getStats(),
        })
      );
    }
  }

  public destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushQueue();
  }
}
