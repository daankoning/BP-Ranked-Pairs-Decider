// The ranked pairs method for a four-team British Parliamentary room, with no DOM access, so it can be
// tested on its own. Loaded as a plain script by index.html; `require`-able from Node (see the bottom).

const TEAMS = ['OG', 'OO', 'CG', 'CO'];
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];   // same order as the rows in index.html

// The comparison for pair `id`, from the panel's votes for each side: who won, and by how much.
// `cast` is the team given the chair's casting vote, which only counts when the votes are tied.
// Returns null when the votes are tied and there is no casting vote yet.
function comparison(id, x, y, cast) {
    const [a, b] = PAIRS[id];
    const win = x === y ? cast : x > y ? a : b;
    if (win === undefined) return null;
    return { id, win, lose: win === a ? b : a, hi: Math.max(x, y), lo: Math.min(x, y), margin: Math.abs(x - y) };
}

// The shortest chain of locked comparisons through which `from` already beats `to`, or null if there is none.
function chain(locked, from, to) {
    let best = null;
    for (const c of locked) {
        if (c.win !== from) continue;
        const rest = c.lose === to ? [] : chain(locked, c.lose, to);
        if (rest && (!best || rest.length + 1 < best.length)) best = [c, ...rest];
    }
    return best;
}

// Lock comparisons in the given order, skipping any that would form a cycle with those already locked.
function lockIn(order) {
    const locked = [];
    return order.map(c => {
        const clash = chain(locked, c.lose, c.win);
        if (!clash) locked.push(c);
        return { c, clash };
    });
}

function permutations(list) {
    if (list.length < 2) return [list];
    return list.flatMap((x, i) => permutations(list.filter((_, j) => j !== i)).map(p => [x, ...p]));
}

// The tied comparisons whose place among the others can change what gets skipped, and so the result.
// Only these need ranking by the chair. Found by trying every order: there are at most 720.
function decisive(before, tied) {
    const tries = permutations(tied).map(order => ({
        order,
        skipped: lockIn([...before, ...order]).filter(s => s.clash).map(s => s.c.id).sort().join()
    }));
    return tied.filter(x => {
        const seen = {};   // order of the other comparisons -> what was skipped
        return tries.some(({ order, skipped }) => {
            const others = order.filter(c => c !== x).map(c => c.id).join();
            if (!(others in seen)) seen[others] = skipped;
            return seen[others] !== skipped;
        });
    });
}

// Sort the comparisons by margin. `picks` maps a margin to the ids of the comparisons the chair has
// ranked within that tie, highest first. Returns the order, each comparison's rank by id (e.g. 3, or
// '3=' when tied), and `ask`: the first tie the chair still has to break, or null.
function sortByMargin(comps, picks = {}) {
    // The sort is stable, so tied comparisons stay in the order they were given.
    const sorted = [...comps].sort((x, y) => y.margin - x.margin);

    // Go through each group of equal margins. Within a group, the chair's picks come first. The rest
    // stay tied, unless their order would change the result: then the chair has to pick again.
    const order = [], rank = {};
    let ask = null;
    for (const m of new Set(sorted.map(c => c.margin))) {
        const group = sorted.filter(c => c.margin === m);
        const picked = (picks[m] || []).map(id => group.find(c => c.id === id));
        const rest = group.filter(c => !picked.includes(c));
        picked.forEach(c => { order.push(c); rank[c.id] = order.length; });
        const options = ask ? [] : decisive(order, rest);
        if (options.length) ask = { m, options, picked: picked.length };
        rest.forEach(c => { rank[c.id] = order.length + 1 + (rest.length > 1 ? '=' : ''); });
        order.push(...rest);
    }
    return { order, rank, ask };
}

// Run ranked pairs on the comparisons. Returns what sortByMargin does, and, once no tie is left for the
// chair to break, the lock-in `steps` and the `final` ranking of teams, first place first.
function decide(comps, picks = {}) {
    const { order, rank, ask } = sortByMargin(comps, picks);
    if (ask) return { order, rank, ask };

    const steps = lockIn(order);
    const locked = steps.filter(s => !s.clash).map(s => s.c);
    const beaten = t => TEAMS.filter((_, u) => chain(locked, t, u)).length;
    const final = TEAMS.map((_, t) => t).sort((s, t) => beaten(t) - beaten(s));
    return { order, rank, ask, steps, final };
}

if (typeof module === 'object') {
    module.exports = { TEAMS, PAIRS, comparison, chain, lockIn, permutations, decisive, sortByMargin, decide };
}
