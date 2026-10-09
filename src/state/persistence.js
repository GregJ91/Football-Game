import { openDB } from 'idb';
import { migratePlayers } from '../engine/players/migrate';
const DB_NAME = 'pyramid-fc';
const STORE = 'saves';
let dbPromise = null;
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
export async function saveGame(game, slot = 'slot1') {
    try {
        return await writeSave(game, slot);
    }
    catch {
        return null;
    }
}
async function writeSave(game, slot) {
    const meta = {
        slot,
        clubName: game.clubs[game.userClubId].name,
        season: game.season,
        week: game.week,
        savedAt: Date.now(),
    };
    const record = { meta, game };
    await (await db()).put(STORE, record, slot);
    return meta;
}
export async function loadGame(slot = 'slot1') {
    let record;
    try {
        record = (await (await db()).get(STORE, slot));
    }
    catch {
        return null;
    }
    if (!record)
        return null;
    // Saves from before pressing existed.
    for (const c of Object.values(record.game.clubs))
        c.tactics.pressing ??= 'medium';
    migratePlayers(record.game);
    // Saves from before the day-by-day calendar.
    record.game.day ??= -1;
    record.game.half ??= 'pm';
    return record.game;
}
export async function listSaves() {
    try {
        return await readSaveList();
    }
    catch {
        return [];
    }
}
async function readSaveList() {
    const d = await db();
    const keys = await d.getAllKeys(STORE);
    const metas = [];
    for (const k of keys) {
        const r = (await d.get(STORE, k));
        if (r)
            metas.push(r.meta);
    }
    return metas.sort((a, b) => b.savedAt - a.savedAt);
}
export async function deleteSave(slot = 'slot1') {
    await (await db()).delete(STORE, slot);
}
