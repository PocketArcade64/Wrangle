import { Vec2, dist, polylineLength, segmentIntersection } from './geometry';

export interface ExtendResult {
  /** Closed-loop polygon if the new segment crossed the line, else null. */
  loop: Vec2[] | null;
  /** True if the BACK of the rope paid out this step to stay in budget. */
  overflow: boolean;
}

/**
 * The player's drawn capture line. Tracks points, rope budget, and
 * self-intersection (loop) detection.
 *
 * Ranger-accurate loop rule (Shadows of Almia): closing a loop consumes ONLY
 * the loop portion of the line. The tail drawn before the loop started stays
 * on the field as part of the live line, and drawing continues from the
 * crossing point. The rope budget tracks the current total line length, so
 * completing a loop refunds that loop's circumference.
 *
 * Whether the loop *counts* (creature enclosed) is the caller's decision
 * via pointInPolygon on the returned polygon.
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

    this.pts.push({ ...p });
    this.used += d;

    // Rope budget, original-Ranger styler style: exceeding the budget no
    // longer snaps the line - the BACK of the rope pays out instead, oldest
    // points vanishing until the line fits again.
    let trimmed = false;
    while (this.used > this.budget && this.pts.length > 2) {
      this.used -= dist(this.pts[0], this.pts[1]);
      this.pts.shift();
      trimmed = true;
    }

    // Test the newest segment against all earlier segments (skip the adjacent one).
    const n = this.pts.length;
    const a = this.pts[n - 2];
    const b = this.pts[n - 1];
    for (let i = n - 4; i >= 0; i--) {
      const hit = segmentIntersection(a, b, this.pts[i], this.pts[i + 1]);
      if (hit) {
        // Loop path: crossing point -> pts[i+1..n-2] -> back to crossing point.
        const polygon: Vec2[] = [hit, ...this.pts.slice(i + 1, n - 1)];
        // Consume only the loop: keep the pre-loop tail (pts[0..i] -> crossing
        // point) and continue drawing from the crossing point.
        const tail = this.pts.slice(0, i + 1);
        tail.push({ ...hit }, { ...p });
        this.pts = tail;
        this.used = polylineLength(this.pts);
        return { loop: polygon, overflow: trimmed };
      }
    }
    return { loop: null, overflow: trimmed };
  }
}
