import { openDB, type IDBPDatabase } from 'idb';
import type { GameState } from '../engine/types';

const DB_NAME = 'pyramid-fc';
const STORE = 'saves';

export interface SaveMeta {
  slot: string;
  clubName: string;
  season: number;
  week: number;
  savedAt: number;
}

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
  const meta: SaveMeta = {
    slot,
    clubName: game.clubs[game.userClubId].name,
    season: game.season,
    week: game.week,
    savedAt: Date.now(),
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
  // Saves from before the day-by-day calendar.
  record.game.day ??= -1;
  record.game.half ??= 'pm';
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
  const keys = await d.getAllKeys(STORE);
  const metas: SaveMeta[] = [];
  for (const k of keys) {
    const r = (await d.get(STORE, k)) as SaveRecord | undefined;
    if (r) metas.push(r.meta);
  }
  return metas.sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSave(slot = 'slot1') {
  await (await db()).delete(STORE, slot);
}
