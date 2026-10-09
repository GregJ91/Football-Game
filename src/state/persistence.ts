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

export async function saveGame(game: GameState, slot = 'slot1'): Promise<SaveMeta> {
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
  const record = (await (await db()).get(STORE, slot)) as SaveRecord | undefined;
  return record?.game ?? null;
}

export async function listSaves(): Promise<SaveMeta[]> {
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
