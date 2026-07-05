import { Vec2, dist, segmentIntersection } from './geometry';

export interface ExtendResult {
  /** Closed-loop polygon if the new segment crossed the line, else null. */
  loop: Vec2[] | null;
  /** True if this extension would exceed the rope budget (point not added). */
  overflow: boolean;
}

/**
 * The player's drawn capture line. Tracks points, rope budget, and
 * self-intersection (loop) detection.
 *
 * Rules (per design doc):
 * - Any self-crossing closes a loop and restarts the line from the crossing
 *   point; used rope length resets each loop.
 * - Whether the loop *counts* (creature enclosed) is the caller's decision
 *   via pointInPolygon on the returned polygon.
 */
export class LassoLine {
  readonly budget: number;
  private pts: Vec2[] = [];
  private used = 0;

  constructor(budget: number) {
    this.budget = budget;
  }

  get active(): boolean {
    return this.pts.length > 0;
  }

  get points(): readonly Vec2[] {
    return this.pts;
  }

  get usedLength(): number {
    return this.used;
  }

  get remainingFraction(): number {
    return Math.max(0, 1 - this.used / this.budget);
  }

  start(p: Vec2): void {
    this.pts = [{ ...p }];
    this.used = 0;
  }

  clear(): void {
    this.pts = [];
    this.used = 0;
  }

  extend(p: Vec2, minPointDist: number): ExtendResult {
    if (!this.active) return { loop: null, overflow: false };
    const last = this.pts[this.pts.length - 1];
    const d = dist(last, p);
    if (d < minPointDist) return { loop: null, overflow: false };
    if (this.used + d > this.budget) return { loop: null, overflow: true };

    this.pts.push({ ...p });
    this.used += d;

    // Test the newest segment against all earlier segments (skip the adjacent one).
    const n = this.pts.length;
    const a = this.pts[n - 2];
    const b = this.pts[n - 1];
    for (let i = n - 4; i >= 0; i--) {
      const hit = segmentIntersection(a, b, this.pts[i], this.pts[i + 1]);
      if (hit) {
        // Loop path: crossing point -> pts[i+1..n-2] -> back to crossing point.
        const polygon: Vec2[] = [hit, ...this.pts.slice(i + 1, n - 1)];
        // Rope restarts from the crossing point; budget resets per loop.
        this.pts = [{ ...hit }, { ...p }];
        this.used = dist(hit, p);
        return { loop: polygon, overflow: false };
      }
    }
    return { loop: null, overflow: false };
  }
}
