// XP / leveling: one small persistent object. Enemies award XP through
// hud.addKill(xp) — the existing kill funnel — and level-ups scale player
// max HP and blade damage. Saved to localStorage so grinding survives reloads.
// ponytail: flat schema keyed _v1 — if fields ever change, bump the key, don't migrate.
const KEY = 'cao_progress_v1';

export class Progression {
  constructor() {
    this.lv = 1;
    this.xp = 0;
    this.col = 0; // currency; loot drops feed it through hud.addKill
    this.cleared = []; // biome ids with the boss beaten (loading-screen checkmarks)
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s) { this.lv = s.lv || 1; this.xp = s.xp || 0; this.col = s.col || 0; this.cleared = s.cleared || []; }
    } catch { /* private mode / corrupt save → fresh run */ }
    this.hud = null;    // late-bound by main.js (same pattern as player.hud)
    this.player = null;
    console.log(`[CAO] progress loaded: Lv ${this.lv}, cleared floors: [${this.cleared}]`);
  }

  xpNext() { return Math.round(50 * Math.pow(1.35, this.lv - 1)); }
  damageMult() { return 1 + 0.06 * (this.lv - 1); }
  maxHpFor() { return 100 + 10 * (this.lv - 1); }

  addXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNext()) {
      this.xp -= this.xpNext();
      this.lv++;
      if (this.player) {
        this.player.maxHp = this.maxHpFor();
        this.player.hp = this.player.maxHp; // level-up = full heal
      }
      if (this.hud) { this.hud.setHP(1); this.hud.levelUp(this.lv); }
    }
    this.save();
    if (this.hud) this.hud.setXP(this.xp / this.xpNext(), this.lv);
  }

  addCol(n) {
    this.col += n;
    this.save();
  }

  clearFloor(id) {
    if (!this.cleared.includes(id)) { this.cleared.push(id); this.save(); }
  }

  isCleared(id) { return this.cleared.includes(id); }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify({ lv: this.lv, xp: this.xp, col: this.col, cleared: this.cleared })); }
    catch { /* storage unavailable → session-only progression */ }
  }
}
