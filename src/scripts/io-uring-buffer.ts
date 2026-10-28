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
  opId?: string;
  slipId: string;
  delta: number;
}

export interface LikeOperationEntry {
  sqeId: number;
  opId: string;
  slipId: string;
  delta: number;
  timestamp: number;
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
  op: IoOpType;
  success: boolean;
  timestamp: number;
  clientSubmissionId?: string;
  slipId?: string;
  status?: string;
  newLikes?: number;
  isNew?: boolean;
  error?: string;
}

export interface IoUringStats {
  sqPending: number;
  inFlight: number;
  cqCompleted: number;
  cqDropped: number;
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
  private hasPendingReflush = false;
  private currentFlushPromise: Promise<boolean> | null = null;

  // Capacity bounds
  private readonly SQ_CAPACITY = 64;
  private readonly LIKE_CAPACITY = 128;
  private readonly CQ_CAPACITY = 128;

  // Submission & Completion Rings
  private sqRing: IoSubmissionEntry[] = [];
  private cqRing: IoCompletionEntry[] = [];
  private nextSqeId = 1;
  private nextCqeId = 1;
  private cqDropped = 0;

  // In-flight storage for rollback and retry safety
  private inFlightSlips: IoSubmissionEntry[] = [];
  private inFlightLikes: LikeOperationEntry[] = [];

  // Write Coalescing Map for Likes (slipId ➔ LikeOperationEntry with unique opId)
  private likeDeltas = new Map<string, LikeOperationEntry>();

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

  // Stored event listener references for clean teardown
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private unloadHandler: (() => void) | null = null;

  constructor(convexClient: ConvexClient | null = null) {
    this.convex = convexClient;
    this.isOnline = typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;
    this.initLifecycle();
  }

  public setClient(client: ConvexClient | null) {
    this.convex = client;
  }

  private initLifecycle() {
    // Start background drainer timer (guarded for SSR)
    this.startTicker();

    // Listen to network & lifecycle status in browser runtimes
    if (typeof window !== 'undefined') {
      this.onlineHandler = () => {
        this.isOnline = true;
        this.flushQueue();
      };

      this.offlineHandler = () => {
        this.isOnline = false;
      };

      this.visibilityHandler = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          this.flushQueue();
        }
      };

      this.unloadHandler = () => {
        this.flushQueue();
      };

      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.visibilityHandler);
      }
      window.addEventListener('beforeunload', this.unloadHandler);
    }
  }

  private startTicker() {
    if (this.flushTimer || typeof window === 'undefined') return;
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

    if (this.sqRing.length + this.inFlightSlips.length >= this.SQ_CAPACITY) {
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
   * Validates delta to reject non-integers, NaN, Infinity, and out-of-range values.
   */
  public enqueueLike(slipId: string, delta: number): { netDelta: number; isCoalesced: boolean; accepted: boolean; sqeId?: number; reason?: string } {
    if (!slipId || typeof slipId !== 'string') {
      return { netDelta: 0, isCoalesced: false, accepted: false, reason: 'Invalid slip ID.' };
    }

    if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10) {
      const cur = this.likeDeltas.get(slipId)?.delta || 0;
      return { netDelta: cur, isCoalesced: false, accepted: false, reason: 'Invalid like delta.' };
    }

    const existingEntry = this.likeDeltas.get(slipId);

    // Check capacity for new unique keys
    if (!existingEntry && this.likeDeltas.size >= this.LIKE_CAPACITY) {
      return { netDelta: 0, isCoalesced: false, accepted: false, reason: 'Like coalescer capacity reached. Sync in progress...' };
    }

    if (existingEntry) {
      const newNet = existingEntry.delta + delta;
      this.coalescedLikesSaved++;

      if (newNet === 0) {
        // Net change cancelled out (e.g. liked and unliked before flush) ➔ 0 DB writes needed!
        this.likeDeltas.delete(slipId);
        this.notifyTelemetry();
        return { netDelta: 0, isCoalesced: true, accepted: true, sqeId: existingEntry.sqeId };
      } else {
        existingEntry.delta = newNet;
        this.notifyTelemetry();
        return { netDelta: newNet, isCoalesced: true, accepted: true, sqeId: existingEntry.sqeId };
      }
    } else {
      const sqeId = this.nextSqeId++;
      const opId = `like-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      this.likeDeltas.set(slipId, {
        sqeId,
        opId,
        slipId,
        delta,
        timestamp: Date.now(),
      });

      this.notifyTelemetry();
      return { netDelta: delta, isCoalesced: false, accepted: true, sqeId };
    }
  }

  /**
   * Returns any un-flushed coalesced like delta for a specific slipId
   * (checks both queued deltas and in-flight deltas to prevent UI flicker)
   */
  public getPendingLikeDelta(slipId: string): number {
    const queued = this.likeDeltas.get(slipId)?.delta || 0;
    const inFlight = this.inFlightLikes.find(l => l.slipId === slipId)?.delta || 0;
    return queued + inFlight;
  }

  /**
   * Drain the SQ Ring Buffer into a single Convex batchSync transaction.
   * Serializes flushes and continuously drains new entries accumulated while in flight.
   */
  public async flushQueue(): Promise<boolean> {
    if (this.isFlushing) {
      this.hasPendingReflush = true;
      return this.currentFlushPromise || Promise.resolve(false);
    }

    this.currentFlushPromise = this.drainLoop();
    try {
      return await this.currentFlushPromise;
    } finally {
      this.currentFlushPromise = null;
    }
  }

  private async drainLoop(): Promise<boolean> {
    this.isFlushing = true;
    let overallSuccess = true;

    try {
      while (this.hasPendingWrites()) {
        this.hasPendingReflush = false;

        // If offline or Convex not connected, pause flushing
        if (!this.convex || !this.isOnline) {
          overallSuccess = false;
          break;
        }

        // 1. Move pending slips to in-flight
        this.inFlightSlips = [...this.sqRing];
        this.sqRing = [];

        // 2. Move pending like deltas to in-flight
        this.inFlightLikes = Array.from(this.likeDeltas.values()).filter(l => l.delta !== 0);
        this.likeDeltas.clear();

        if (this.inFlightSlips.length === 0 && this.inFlightLikes.length === 0) {
          break;
        }

        this.notifyTelemetry();

        try {
          const payloadSlips: NewSlipPayload[] = [];
          for (const entry of this.inFlightSlips) {
            if (entry.slipPayload) {
              payloadSlips.push(entry.slipPayload);
            }
          }

          const payloadLikes: LikeDeltaPayload[] = this.inFlightLikes.map(l => ({
            opId: l.opId,
            slipId: l.slipId,
            delta: l.delta,
          }));

          // Execute 1 Single Atomic Batched Mutation
          const result = await this.convex.mutation(api.slips.batchSync, {
            newSlips: payloadSlips,
            likeDeltas: payloadLikes,
          });

          this.totalBatchesFlushed++;
          this.lastSyncTimestamp = Date.now();

          // 3. Emit per-slip CQE completions with accurate IDs and flags
          const slipResultsMap = new Map<string, { slipId?: string; status: string; reason?: string }>();
          if (result?.slips && Array.isArray(result.slips)) {
            for (const r of result.slips) {
              slipResultsMap.set(r.clientSubmissionId, r);
            }
          }

          for (const sqe of this.inFlightSlips) {
            const clientSubId = sqe.slipPayload?.clientSubmissionId;
            const match = clientSubId ? slipResultsMap.get(clientSubId) : undefined;
            const isSuccess = match?.status === 'inserted' || match?.status === 'duplicate';

            this.pushCqe({
              cqeId: this.nextCqeId++,
              sqeId: sqe.sqeId,
              op: 'INSERT_SLIP',
              success: isSuccess,
              timestamp: Date.now(),
              clientSubmissionId: clientSubId,
              slipId: match?.slipId,
              status: match?.status,
              isNew: match?.status === 'inserted',
              error: match?.reason,
            });
          }

          // 4. Emit per-like CQE completions
          const likeResultsMap = new Map<string, { status: string; newLikes?: number; error?: string }>();
          if (result?.likes && Array.isArray(result.likes)) {
            for (const l of result.likes) {
              if (l.opId) likeResultsMap.set(l.opId, l);
              else likeResultsMap.set(l.slipId, l);
            }
          }

          for (const item of this.inFlightLikes) {
            const match = likeResultsMap.get(item.opId) || likeResultsMap.get(item.slipId);
            const isSuccess = match?.status === 'applied' || match?.status === 'already_applied';

            this.pushCqe({
              cqeId: this.nextCqeId++,
              sqeId: item.sqeId,
              op: 'TOGGLE_LIKE',
              success: isSuccess,
              timestamp: Date.now(),
              slipId: item.slipId,
              status: match?.status,
              newLikes: match?.newLikes,
              error: match?.error,
            });
          }

          // Discard in-flight batch on confirmed commit
          this.inFlightSlips = [];
          this.inFlightLikes = [];
          this.notifyTelemetry();

        } catch (err: any) {
          console.warn('[io_uring] Batch flush failed, returning in-flight items safely:', err);
          overallSuccess = false;

          // Safe rollback: restore in-flight slips to head of sqRing without exceeding capacity
          const availableSlots = Math.max(0, this.SQ_CAPACITY - this.sqRing.length);
          const slipsToRestore = this.inFlightSlips.slice(0, availableSlots);
          const droppedSlips = this.inFlightSlips.slice(availableSlots);

          for (const d of droppedSlips) {
            this.pushCqe({
              cqeId: this.nextCqeId++,
              sqeId: d.sqeId,
              op: 'INSERT_SLIP',
              success: false,
              timestamp: Date.now(),
              clientSubmissionId: d.slipPayload?.clientSubmissionId,
              error: 'Queue capacity exceeded during rollback',
            });
          }

          this.sqRing = [...slipsToRestore, ...this.sqRing];

          // Safe rollback: merge failed like deltas additively with newly accumulated deltas
          for (const item of this.inFlightLikes) {
            const curEntry = this.likeDeltas.get(item.slipId);
            if (curEntry) {
              const merged = curEntry.delta + item.delta;
              if (merged === 0) {
                this.likeDeltas.delete(item.slipId);
              } else {
                curEntry.delta = merged;
              }
            } else {
              // Preserve original opId for idempotent retry on the server!
              this.likeDeltas.set(item.slipId, item);
            }
          }

          this.inFlightSlips = [];
          this.inFlightLikes = [];
          this.notifyTelemetry();

          // Stop loop on failure to let ticker or backoff retry later
          break;
        }
      }
    } finally {
      this.isFlushing = false;
      this.notifyTelemetry();
    }

    return overallSuccess;
  }

  private pushCqe(cqe: IoCompletionEntry) {
    this.cqRing.push(cqe);
    if (this.cqRing.length > this.CQ_CAPACITY) {
      const excess = this.cqRing.length - this.CQ_CAPACITY;
      this.cqRing.splice(0, excess);
      this.cqDropped += excess;
    }
  }

  public getStats(): IoUringStats {
    return {
      sqPending: this.sqRing.length + this.likeDeltas.size,
      inFlight: this.inFlightSlips.length + this.inFlightLikes.length,
      cqCompleted: this.cqRing.length,
      cqDropped: this.cqDropped,
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

  public async destroy(): Promise<boolean> {
    if (this.flushTimer && typeof window !== 'undefined') {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (typeof window !== 'undefined') {
      if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
      if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
      if (this.visibilityHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
      }
      if (this.unloadHandler) window.removeEventListener('beforeunload', this.unloadHandler);
    }

    return await this.flushQueue();
  }
}
