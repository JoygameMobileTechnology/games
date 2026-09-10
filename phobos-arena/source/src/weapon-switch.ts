import type { WeaponId } from "./rules";

export const WEAPON_LOWER_SECONDS = 0.06;
export const WEAPON_RAISE_SECONDS = 0.09;
/** A long background frame must not hide the complete presentation in one step. */
export const WEAPON_SWITCH_MAX_DELTA = 0.05;
export interface WeaponSwitchPose {
  visibleWeapon: WeaponId;
  /** 0 is the ordinary gun pose; 1 is fully lowered. */
  amount: number;
  offsetY: number;
  offsetZ: number;
  tiltX: number;
}

/** Presentation only. The selected gameplay weapon, firing and cooldowns remain
 * immediate; this helper controls only which first-person mesh is drawn. */
export class WeaponSwitchAnimation {
  private readonly pose: WeaponSwitchPose;
  private pending: WeaponId;
  private direction: -1 | 0 | 1 = 0;
  private startAmount = 0;
  private elapsed = 0;
  private duration = 0;

  constructor(weapon: WeaponId = "machinegun") {
    this.pending = weapon;
    this.pose = { visibleWeapon: weapon, amount: 0, offsetY: 0, offsetZ: 0, tiltX: 0 };
  }
  get visibleWeapon() { return this.pose.visibleWeapon; }
  get amount() { return this.pose.amount; }

  reset(weapon: WeaponId): Readonly<WeaponSwitchPose> {
    this.pending = this.pose.visibleWeapon = weapon;
    this.direction = 0;
    this.startAmount = this.elapsed = this.duration = 0;
    this.setAmount(0);
    return this.pose;
  }

  /** Seconds, with a stable result object. Reversals start at the current pose;
   * an intermediate selection is never flashed while the gun remains raised. */
  update(selectedWeapon: WeaponId, dt: number): Readonly<WeaponSwitchPose> {
    this.pending = selectedWeapon;
    if (selectedWeapon !== this.pose.visibleWeapon && this.direction !== 1) this.begin(1);
    else if (selectedWeapon === this.pose.visibleWeapon && this.direction === 1) this.begin(-1);
    let remaining = Number.isFinite(dt) ? Math.max(0, Math.min(WEAPON_SWITCH_MAX_DELTA, dt)) : 0;
    // A single update can finish lowering and spend the remainder on raising.
    // Zero-length reversals at the bottom are handled without dividing by zero.
    while (this.direction !== 0) {
      const advance = Math.min(remaining, Math.max(0, this.duration - this.elapsed));
      this.elapsed += advance;
      remaining -= advance;
      const progress = this.duration > 0 ? Math.min(1, this.elapsed / this.duration) : 1;
      const eased = progress * progress * (3 - 2 * progress);
      const target = this.direction === 1 ? 1 : 0;
      this.setAmount(this.startAmount + (target - this.startAmount) * eased);
      if (progress < 1) break;
      if (this.direction === 1) {
        this.pose.visibleWeapon = this.pending;
        this.begin(-1);
      } else {
        this.direction = 0;
        this.setAmount(0);
      }
      if (remaining <= 0) break;
    }
    return this.pose;
  }
  private begin(direction: -1 | 1) {
    this.direction = direction;
    this.startAmount = this.pose.amount;
    this.elapsed = 0;
    const distance = direction === 1 ? 1 - this.startAmount : this.startAmount;
    this.duration = (direction === 1 ? WEAPON_LOWER_SECONDS : WEAPON_RAISE_SECONDS) * distance;
  }
  private setAmount(value: number) {
    this.pose.amount = value;
    this.pose.offsetY = -0.52 * value;
    this.pose.offsetZ = 0.12 * value;
    this.pose.tiltX = -0.28 * value;
  }
}
