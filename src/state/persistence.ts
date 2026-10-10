import { openDB, type IDBPDatabase } from 'idb';
import { migratePlayers } from '../engine/players/migrate';
import type { GameState } from '../engine/types';

const DB_NAME = 'pyramid-fc';
const STORE = 'saves';

export interface SaveMeta {
  slot: string;
  clubName: string;
  season: number;
  week: number;
  savedAt: number;
  /** What kind of game: a career, a challenge (with its name) or Legends. */
  mode?: 'career' | 'challenge' | 'legends';
  /** e.g. "Northern Regional League" or "Super League · season 3 of 10". */
  detail?: string;
}

/** Three save slots; any slot can hold any kind of game. */
export const SLOTS = ['slot1', 'slot2', 'slot3'] as const;

interface SaveRecord {
  meta: SaveMeta;
  game: GameState;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore(STORE);
    },
  });
  return dbPromise;
}

/**
 * Storage can be unavailable (private browsing, blocked site data). Saving
 * then fails quietly and the game carries on in memory.
 */
export async function saveGame(game: GameState, slot = 'slot1'): Promise<SaveMeta | null> {
  try {
    return await writeSave(game, slot);
  } catch {
    return null;
  }
}

async function writeSave(game: GameState, slot: string): Promise<SaveMeta> {
  const club = game.unemployed ? game.clubs[game.unemployed.fromClubId] : game.clubs[game.userClubId];
  const division = game.divisions.find((d) => d.clubIds.includes(club.id));
  const meta: SaveMeta = {
    slot,
    clubName: club.name,
    season: game.season,
    week: game.week,
    savedAt: Date.now(),
    mode: game.mode === 'legends' ? 'legends' : game.challenge ? 'challenge' : 'career',
    detail:
      game.mode === 'legends'
        ? `Season ${Math.min((game.legends?.roll.length ?? 0) + 1, 10)} of 10`
        : game.unemployed ? 'Out of work' : division?.def.name,
  };
  const record: SaveRecord = { meta, game };
  await (await db()).put(STORE, record, slot);
  return meta;
}

export async function loadGame(slot = 'slot1'): Promise<GameState | null> {
  let record: SaveRecord | undefined;
  try {
    record = (await (await db()).get(STORE, slot)) as SaveRecord | undefined;
  } catch {
    return null;
  }
  if (!record) return null;
  // Saves from before pressing existed.
  for (const c of Object.values(record.game.clubs)) c.tactics.pressing ??= 'medium';
  migratePlayers(record.game);
  // Saves from before the day-by-day calendar.
  record.game.day ??= -1;
  record.game.half ??= 'pm';
  // Legends drafts from before the position-by-position draft.
  const d = record.game.legends?.draft;
  if (d && !d.slots) {
    d.slots = [];
    for (let r = 0; r < d.rounds; r++) {
      const pass = d.snake && r % 2 ? [...d.order].reverse() : d.order;
      for (const clubId of pass) d.slots.push({ clubId, round: r + 1, group: 'ANY' });
    }
  }
  return record.game;
}

export async function listSaves(): Promise<SaveMeta[]> {
  try {
    return await readSaveList();
  } catch {
    return [];
  }
}

async function readSaveList(): Promise<SaveMeta[]> {
  const d = await db();
  // A Legends game from before the three slots moves into the first free one.
  const old = (await d.get(STORE, LEGENDS_SLOT)) as SaveRecord | undefined;
  if (old) {
    for (const slot of SLOTS) {
      if (await d.get(STORE, slot)) continue;
      await d.put(STORE, { meta: { ...old.meta, slot }, game: old.game }, slot);
      await d.delete(STORE, LEGENDS_SLOT);
      break;
    }
  }
  const keys = await d.getAllKeys(STORE);
  const metas: SaveMeta[] = [];
  for (const k of keys) {
    const r = (await d.get(STORE, k)) as SaveRecord | undefined;
    // Only saves (achievements live in the same store under their own key).
    if (r?.meta && (SLOTS as readonly string[]).includes(String(k))) metas.push({ ...r.meta, mode: r.meta.mode ?? 'career' });
  }
  return metas.sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSave(slot = 'slot1') {
  await (await db()).delete(STORE, slot);
}

// ---------------------------------------------------------------- achievements

/** When and where an achievement was unlocked. */
export interface Unlock {
  at: number;
  clubName: string;
  season: number;
}

const ACHIEVEMENTS_KEY = 'achievements';

/** Achievements are kept on the device across every career, apart from the save. */
export async function loadAchievements(): Promise<Record<string, Unlock>> {
  try {
    const r = (await (await db()).get(STORE, ACHIEVEMENTS_KEY)) as { unlocked?: Record<string, Unlock> } | undefined;
    return r?.unlocked ?? {};
  } catch {
    return {};
  }
}

export async function saveAchievements(unlocked: Record<string, Unlock>) {
  try {
    await (await db()).put(STORE, { unlocked }, ACHIEVEMENTS_KEY);
  } catch {
    // Storage unavailable: they stay for this session.
  }
}

/** Where Legends games were kept before the three save slots. */
const LEGENDS_SLOT = 'legends';
