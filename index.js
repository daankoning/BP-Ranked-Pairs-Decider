const TEAMS = ['OG', 'OO', 'CG', 'CO'];
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];   // same order as the rows in #votes

const $ = id => document.getElementById(id);
const el = (tag, text = '') => Object.assign(document.createElement(tag), { textContent: text });

// Replace a table body's rows: one row per entry, one cell per value.
const fillRows = (tbody, rows) => tbody.replaceChildren(...rows.map(cells => {
    const tr = el('tr');
    tr.append(...cells.map(text => el('td', text)));
    return tr;
}));

const votes = $('votes');
const out = $('out');

const casting = {};      // comparison -> team given the chair's casting vote, when the panel is tied on it
let picks = {};          // margin -> comparisons the chair has ranked within that tie, highest first

const name = c => `${TEAMS[c.win]} > ${TEAMS[c.lose]}`;

// Read the six rows. A comparison only counts once it has both numbers (and a casting vote, if it needs one).
function read() {
    const comps = [], totals = [];
    PAIRS.forEach(([a, b], id) => {
        const x = $(`v${id}a`).value;
        const y = $(`v${id}b`).value;
        const filled = x !== '' && y !== '' && +x + +y > 0;
        const tied = filled && +x === +y;
        if (!tied) delete casting[id];

        const cast = $('cast' + id);
        cast.hidden = !tied;
        cast.querySelectorAll('input').forEach(r => { r.checked = casting[id] === +r.value; });

        if (!filled) return;
        totals.push(+x + +y);
        const win = tied ? casting[id] : +x > +y ? a : b;
        if (win === undefined) return;
        comps.push({ id, win, lose: win === a ? b : a, hi: Math.max(x, y), lo: Math.min(x, y), margin: Math.abs(x - y) });
    });
    $('warn').hidden = new Set(totals).size < 2;
    return { comps, filled: totals.length };
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

// Work out the ranking, then update the page. Every part is shown or hidden on every call,
// so nothing from an earlier state is left behind.
function render() {
    const { comps, filled } = read();
    const complete = comps.length === 6;
    $('status').hidden = complete;
    $('report').hidden = !complete;
    if (!complete) {
        $('status').textContent = filled < 6 ? 'Fill in all six comparisons to see the ranking.' : "Give the chair's casting vote to see the ranking.";
        return;
    }

    // Sort by margin. The sort is stable, so tied comparisons stay in the order they are listed above.
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

    const hasPicks = Object.keys(picks).length > 0;
    fillRows($('order'), order.map(c => [rank[c.id], name(c), `${c.hi}–${c.lo}`, c.margin]));

    $('ask').hidden = !ask;
    $('ask-options').replaceChildren(...(ask ? ask.options : []).map(c => {
        const b = Object.assign(el('button', name(c)), { type: 'button' });
        b.dataset.pick = c.id;
        b.dataset.margin = ask.m;
        return b;
    }));
    if (ask) {
        $('ask-margin').textContent = ask.m;
        $('ask-which').textContent = ask.picked ? 'next' : ask.options.length > 2 ? 'highest' : 'higher';
    }
    $('tie-note').hidden = !!ask || !order.some(c => String(rank[c.id]).endsWith('='));
    $('redo-row').hidden = !hasPicks;
    $('chair-set').hidden = !hasPicks;

    $('result').hidden = $('steps').hidden = !!ask;
    if (ask) return;

    const steps = lockIn(order);
    const locked = steps.filter(s => !s.clash).map(s => s.c);
    const skipped = steps.filter(s => s.clash);
    const beaten = t => TEAMS.filter((_, u) => chain(locked, t, u)).length;
    const final = TEAMS.map((_, t) => t).sort((s, t) => beaten(t) - beaten(s));

    $('final').replaceChildren(...final.map(t => el('li', TEAMS[t])));
    $('skipped').replaceChildren(...skipped.map(s =>
        el('p', `The ${s.c.hi}–${s.c.lo} ${s.c.margin ? '' : 'casting '}vote for ${TEAMS[s.c.win]} over ${TEAMS[s.c.lose]} is ignored.`)));
    $('no-cycle').hidden = skipped.length > 0;
    fillRows($('steps-body'), steps.map((s, i) => [i + 1, name(s.c),
        s.clash ? 'Skip: cyclic with ' + s.clash.map(c => order.indexOf(c) + 1).sort().join(' & ') : 'Lock in']));
}

votes.addEventListener('input', e => {
    if (e.target.type === 'radio') return;
    e.target.value = e.target.value.replace(/\D/g, '');
    picks = {};
    render();
});

votes.addEventListener('change', e => {
    if (e.target.type !== 'radio') return;
    casting[e.target.dataset.cast] = +e.target.value;
    picks = {};
    render();
});

out.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'redo') picks = {};
    else (picks[b.dataset.margin] = picks[b.dataset.margin] || []).push(+b.dataset.pick);
    render();
    ($('ask').hidden ? $('result') : $('ask-options').firstElementChild).focus();
});

$('clear').addEventListener('click', () => {
    votes.querySelectorAll('.row input').forEach(i => { i.value = ''; });
    picks = {};
    render();
    votes.querySelector('input').focus();
});

render();