const pick = (items, seed) => items[Math.abs(seed) % items.length];
/** Deterministic variety: derive a template choice from the event. */
function seedOf(e) {
    let h = e.minute * 31;
    for (const c of e.playerId)
        h = (h * 33 + c.charCodeAt(0)) | 0;
    return h;
}
export function describeEvent(e, name, clubName) {
    const s = seedOf(e);
    const p = name(e.playerId);
    const club = clubName(e.side);
    switch (e.type) {
        case 'goal': {
            const a = e.assistId ? name(e.assistId) : null;
            const finish = pick([
                `${p} fires low into the bottom corner!`,
                `${p} rises highest and powers a header home!`,
                `${p} keeps his cool and slots it past the keeper!`,
                `${p} smashes it into the roof of the net!`,
                `${p} curls a beauty in off the post!`,
                `${p} pounces on the loose ball and scores!`,
            ], s);
            return { minute: e.minute, kind: 'goal', side: e.side, text: `GOAL! ${club}. ${finish}${a ? ` Great work from ${a}.` : ''}` };
        }
        case 'save':
            return {
                minute: e.minute,
                kind: 'chance',
                side: e.side,
                text: pick([
                    `Great save! ${p} tips ${name(e.assistId)}'s drive around the post.`,
                    `${p} gets down well to keep out ${name(e.assistId)}.`,
                    `${name(e.assistId)} tests the keeper, but ${p} holds on.`,
                    `Fingertip stop from ${p}! ${name(e.assistId)} can't believe it.`,
                ], s),
            };
        case 'chance':
            return {
                minute: e.minute,
                kind: 'chance',
                side: e.side,
                text: pick([
                    `${p} drags his shot just wide.`,
                    `Chance for ${club}! ${p} blazes over the bar.`,
                    `${p} heads straight at the keeper. Should have done better.`,
                    `${p} lets fly from distance, but it's off target.`,
                    `${p} is denied by a last-ditch block.`,
                ], s),
            };
        case 'yellow':
            return { minute: e.minute, kind: 'card', side: e.side, text: pick([`Yellow card for ${p} after a cynical trip.`, `${p} goes into the book for a late challenge.`, `The referee shows ${p} a yellow for dissent.`], s) };
        case 'red':
            return { minute: e.minute, kind: 'card', side: e.side, text: `RED CARD! ${p} is sent off. ${club} are down to ten.` };
        case 'injury':
            return { minute: e.minute, kind: 'info', side: e.side, text: `${p} is down injured and needs treatment.` };
        case 'sub':
            return { minute: e.minute, kind: 'info', side: e.side, text: `Substitution for ${club}: ${name(e.inId)} replaces ${p}.` };
        case 'attack':
            return {
                minute: e.minute,
                kind: 'build',
                side: e.side,
                text: pick([
                    `${p} drives forward for ${club}.`,
                    `${club} build pressure, ${p} probing on the edge of the box.`,
                    `${p} switches play out to the wing.`,
                    `${p} wins a corner for ${club}.`,
                    `Neat interplay from ${club}, ${p} at the heart of it.`,
                ], s),
            };
    }
    return null;
}
export function playerLabel(p) {
    return p ? `${p.firstName[0]}. ${p.lastName}` : 'Unknown';
}
