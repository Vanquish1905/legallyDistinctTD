import type { DamageType, EnemyDef } from './types';
import type { PathFollower } from './PathFollower';
import type { Circle } from './SpatialHash';
import type { DamageTarget } from './damage';
import { makeStatus, statusSpeedFactor, type StatusState } from './status';

/** Per-enemy runtime data used by ability handlers. */
export interface AbilityRuntime {
  /** Seconds until the next ability action. */
  timer: number;
  /** Boss phase index (0 = not yet entered any phase). */
  phase: number;
  /** Speed multiplier set by abilities (enrage, phases). */
  speedMul: number;
  /** Per-part timers of a `combo` ability (filled lazily, cleared on boss phase change). */
  timers: number[];
}

/** Visual height of flying enemies above the path (px). Flying is cosmetic: they follow the path. */
export const FLYING_ALTITUDE = 36;

/** Options for creating an enemy. */
export interface EnemySpawnOptions {
  uid: number;
  def: EnemyDef;
  pathIndex: number;
  path: PathFollower;
  /** Starting distance along the path. */
  distance: number;
  /** Sideways offset from the centre line (px). */
  offset: number;
  hpMul: number;
  speedMul: number;
  /** Wave this enemy belongs to (for wave-clear tracking). */
  wave: number;
}

/** Live state of one enemy on the field. */
export class EnemyState implements Circle, DamageTarget {
  readonly uid: number;
  readonly def: EnemyDef;
  readonly pathIndex: number;
  readonly wave: number;
  readonly offset: number;
  readonly maxHp: number;
  readonly radius: number;
  readonly flying: boolean;
  readonly stealth: boolean;
  /** Height above the ground for rendering (FLYING_ALTITUDE for flyers, else 0). */
  readonly altitude: number;
  /** Base speed in px/s after difficulty scaling. */
  readonly baseSpeed: number;
  x = 0;
  y = 0;
  /** Heading in radians. */
  angle = 0;
  /** Distance travelled along its path. */
  distance: number;
  /** Distance left to the path end. */
  remaining = 0;
  hp: number;
  shield = 0;
  /** Size of the last shield granted (for the renderer's shield bar). */
  maxShield = 0;
  armor: number;
  /** Speed actually moved last tick (px/s). */
  currentSpeed = 0;
  alive = true;
  /** Seen by a stealth-revealing support this tick. */
  revealed = false;
  /** Submerged: cannot be targeted or hit. */
  burrowed = false;
  readonly status: StatusState = makeStatus();
  readonly ability: AbilityRuntime = { timer: 0, phase: 0, speedMul: 1, timers: [] };

  constructor(o: EnemySpawnOptions) {
    this.uid = o.uid;
    this.def = o.def;
    this.pathIndex = o.pathIndex;
    this.wave = o.wave;
    this.offset = o.offset;
    this.maxHp = o.def.hp * o.hpMul;
    this.hp = this.maxHp;
    this.armor = o.def.armor;
    this.radius = o.def.radius;
    this.baseSpeed = o.def.speed * o.speedMul;
    this.flying = o.def.traits.includes('flying');
    this.stealth = o.def.traits.includes('stealth');
    this.altitude = this.flying ? FLYING_ALTITUDE : 0;
    this.distance = o.distance;
    this.place(o.path);
  }

  get resist(): Partial<Record<DamageType, number>> | undefined {
    return this.def.resist;
  }

  /** Underground right now: untargetable and untouched by splash. */
  get submerged(): boolean {
    return this.burrowed;
  }

  get isBoss(): boolean {
    return this.def.traits.includes('boss');
  }

  /** Recompute position/heading from `distance`. */
  place(path: PathFollower): void {
    path.positionAt(this.distance, this);
    this.angle = path.angleAt(this.distance);
    if (this.offset !== 0) {
      this.x -= Math.sin(this.angle) * this.offset;
      this.y += Math.cos(this.angle) * this.offset;
    }
    this.remaining = path.length - this.distance;
  }

  /** Advance along the path. Returns true when the end was reached (leak). */
  move(path: PathFollower, dt: number): boolean {
    this.currentSpeed = this.baseSpeed * this.ability.speedMul * statusSpeedFactor(this.status);
    this.distance += this.currentSpeed * dt;
    this.place(path);
    return this.distance >= path.length;
  }
}
