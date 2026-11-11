// Run with `node test.js`. No dependencies; exits non-zero if a test fails.
const assert = require('node:assert');
const { TEAMS, comparison, decide } = require('./ranked-pairs.js');

// Votes for each pair in PAIRS order: OG-OO, OG-CG, OG-CO, OO-CG, OO-CO, CG-CO.
const comps = votes => votes.map(([x, y], id) => comparison(id, x, y));
const names = final => final.map(t => TEAMS[t]).join(' > ');

function test(name, fn) {
    try { fn(); console.log('ok  ', name); }
    catch (e) { console.log('FAIL', name); console.log(e.message); process.exitCode = 1; }
}

test('manual example B (five-judge panel, section 3.2)', () => {
    const c = comps([[4, 1], [2, 3], [5, 0], [3, 2], [5, 0], [5, 0]]);

    // Only the 1-vote tie (OG vs CG, OO vs CG) matters; the 5-vote tie over CO does not.
    const first = decide(c);
    assert.strictEqual(first.ask.m, 1);
    assert.deepStrictEqual(first.ask.options.map(o => o.id).sort(), [1, 3]);

    // Chair ranks OO > CG above OG < CG: OG < CG is skipped.
    const r = decide(c, { 1: [3] });
    assert.strictEqual(names(r.final), 'OG > OO > CG > CO');
    assert.deepStrictEqual(r.steps.filter(s => s.clash).map(s => s.c.id), [1]);

    // The other way round, as the manual notes, gives CG > OG > OO > CO.
    assert.strictEqual(names(decide(c, { 1: [1] }).final), 'CG > OG > OO > CO');
});

test('unanimous panel', () => {
    const r = decide(comps([[3, 0], [3, 0], [3, 0], [3, 0], [3, 0], [3, 0]]));
    assert.strictEqual(r.ask, null);
    assert.strictEqual(names(r.final), 'OG > OO > CG > CO');
    assert.ok(r.steps.every(s => !s.clash));
});
