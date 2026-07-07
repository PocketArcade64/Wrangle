import { Vec2, clamp, dist } from './geometry';
import type { SpeciesDef } from '../data/species';

export interface PointerInfo {
  x: number;
  y: number;
  down: boolean;
}

export interface ArenaRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type State = 'idle' | 'roam' | 'telegraph' | 'recover';

// Keep creatures well clear of the arena walls so there is always room to
// draw a loop around them (a body flush against the edge is un-lassoable).
const EDGE_MARGIN = 48;

/**
 * Movement + attack brain for a capture target. Pure logic — the scene owns
 * rendering, hazards, and HP. Scene subscribes via onTelegraph/onAttack.
 */
export class CreatureActor {
  readonly species: SpeciesDef;
  readonly pos: Vec2;
  onTelegraph?: () => void;
  onAttack?: (origin: Vec2) => void;

  private state: State = 'idle';
  private stateT = 0.5;
  private target: Vec2;
  private attackT: number;
  private dashT = 0; // >0 while dashing
  private dashCooldown: number;
  private readonly arena: ArenaRect;

  constructor(species: SpeciesDef, start: Vec2, arena: ArenaRect) {
    this.species = species;
    this.pos = { ...start };
    this.arena = arena;
    this.target = { ...start };
    this.attackT = this.attackDelay();
    this.dashCooldown = this.dashDelay();
  }

  get radius(): number {
    return this.species.bodyRadius;
  }

  update(dt: number, pointer: PointerInfo): void {
    switch (this.state) {
      case 'telegraph':
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.onAttack?.({ ...this.pos });
          this.state = 'recover';
          this.stateT = 0.4;
        }
        return;
      case 'recover':
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.setIdle(0.3);
          this.attackT = this.attackDelay();
        }
        return;
      case 'idle':
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.pickTarget();
          this.state = 'roam';
        }
        this.locomotion(dt, pointer);
        break;
      case 'roam':
        this.locomotion(dt, pointer);
        break;
    }
    this.tickAttack(dt);
    this.tickDash(dt, pointer);
  }

  private locomotion(dt: number, pointer: PointerInfo): void {
    const sp = this.species;
    let speed = sp.moveSpeed;

    if (sp.movement === 'flee' && pointer.down) {
      const d = dist(pointer, this.pos);
      if (d < 280) {
        const nx = (this.pos.x - pointer.x) / (d || 1);
        const ny = (this.pos.y - pointer.y) / (d || 1);
        this.target = this.clampPoint({ x: this.pos.x + nx * 200, y: this.pos.y + ny * 200 });
        this.state = 'roam';
        speed *= 1.3;
      }
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      speed *= 3;
      if (this.dashT <= 0) {
        this.setIdle(0.4);
        return;
      }
    }

    if (this.state !== 'roam') return;
    const d = dist(this.target, this.pos);
    if (d < 6) {
      this.setIdle(0.6 + Math.random() * 0.8);
      return;
    }
    this.pos.x += ((this.target.x - this.pos.x) / d) * speed * dt;
    this.pos.y += ((this.target.y - this.pos.y) / d) * speed * dt;
    this.clampSelf();
  }

  private tickAttack(dt: number): void {
    if (this.species.attackPattern === 'none') return;
    this.attackT -= dt;
    if (this.attackT <= 0) {
      this.state = 'telegraph';
      this.stateT = (this.species.telegraphMs ?? 800) / 1000;
      this.onTelegraph?.();
    }
  }

  private tickDash(dt: number, pointer: PointerInfo): void {
    if (this.species.movement !== 'charge' || this.dashT > 0) return;
    this.dashCooldown -= dt;
    if (this.dashCooldown <= 0) {
      this.target = this.clampPoint({ x: pointer.x, y: pointer.y });
      this.dashT = 0.7;
      this.state = 'roam';
      this.dashCooldown = this.dashDelay();
    }
  }

  private setIdle(seconds: number): void {
    this.state = 'idle';
    this.stateT = seconds;
  }

  private pickTarget(): void {
    const inset = this.radius + EDGE_MARGIN;
    this.target = {
      x: this.arena.left + inset + Math.random() * (this.arena.right - this.arena.left - inset * 2),
      y: this.arena.top + inset + Math.random() * (this.arena.bottom - this.arena.top - inset * 2)
    };
  }

  private clampPoint(p: Vec2): Vec2 {
    const inset = this.radius + EDGE_MARGIN;
    return {
      x: clamp(p.x, this.arena.left + inset, this.arena.right - inset),
      y: clamp(p.y, this.arena.top + inset, this.arena.bottom - inset)
    };
  }

  private clampSelf(): void {
    const c = this.clampPoint(this.pos);
    this.pos.x = c.x;
    this.pos.y = c.y;
  }

  private attackDelay(): number {
    const base = (this.species.attackIntervalMs ?? 5000) / 1000;
    return base * (0.8 + Math.random() * 0.4);
  }

  private dashDelay(): number {
    const base = (this.species.dashIntervalMs ?? 3500) / 1000;
    return base * (0.8 + Math.random() * 0.4);
  }
}
