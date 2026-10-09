/**
 * Seeded, serialisable PRNG (mulberry32). All game randomness goes through an
 * Rng so a save + seed reproduces exactly the same results.
 */
export class Rng {
    state;
    constructor(seed) {
        this.state = seed >>> 0;
    }
    /** Float in [0, 1). */
    next() {
        let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** Integer in [min, max] inclusive. */
    int(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }
    chance(p) {
        return this.next() < p;
    }
    pick(items) {
        return items[Math.floor(this.next() * items.length)];
    }
    /** Approximately normal via sum of uniforms (mean 0, sd ~1). */
    normal() {
        return this.next() + this.next() + this.next() + this.next() - 2;
    }
    /** Weighted pick; weights need not sum to 1. */
    weighted(items, weight) {
        let total = 0;
        for (const it of items)
            total += Math.max(0, weight(it));
        let r = this.next() * total;
        for (const it of items) {
            r -= Math.max(0, weight(it));
            if (r < 0)
                return it;
        }
        return items[items.length - 1];
    }
    shuffle(items) {
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    }
}
export function randomSeed() {
    return Math.floor(Math.random() * 2 ** 32);
}
