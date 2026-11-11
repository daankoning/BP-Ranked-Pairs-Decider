// The page: reads the votes, and shows what ranked-pairs.js makes of them.

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
    PAIRS.forEach((_, id) => {
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
        const c = comparison(id, +x, +y, casting[id]);
        if (c) comps.push(c);
    });
    $('warn').hidden = new Set(totals).size < 2;
    return { comps, filled: totals.length };
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

    const { order, rank, ask, steps, final } = decide(comps, picks);

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

    $('result').hidden = $('steps').hidden = !!ask;
    if (ask) return;

    const skipped = steps.filter(s => s.clash);
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
