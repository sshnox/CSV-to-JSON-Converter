'use strict';
const { convert, detectDelimiter } = require('../js/converter.js');

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✔  ${name}`); passed++; }
  catch (e) { console.error(`  ✖  ${name}\n     ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || `Expected ${JSON.stringify(a)} == ${JSON.stringify(b)}`); }

console.log('\n  CSV→JSON Test Suite\n');

// ── Delimiter detection ───────────────────────────────────────
test('detects comma', () => eq(detectDelimiter('a,b,c\n1,2,3'), ','));
test('detects semicolon', () => eq(detectDelimiter('a;b;c\n1;2;3'), ';'));
test('detects tab', () => eq(detectDelimiter('a\tb\tc\n1\t2\t3'), '\t'));

// ── Basic conversion ──────────────────────────────────────────
test('basic array output', () => {
  const r = convert('name,age\nAlice,30\nBob,25');
  const d = JSON.parse(r.json);
  eq(d[0].name, 'Alice');
  eq(d[0].age, 30);
  eq(d[1].name, 'Bob');
});

test('row and col counts', () => {
  const r = convert('a,b,c\n1,2,3\n4,5,6');
  eq(r.rows, 2); eq(r.cols, 3);
});

// ── Type casting ──────────────────────────────────────────────
test('casts integers', () => {
  const r = convert('n\n42\n-7\n3.14');
  const d = JSON.parse(r.json);
  eq(typeof d[0].n, 'number');
  eq(d[0].n, 42);
  eq(d[2].n, 3.14);
});

test('casts booleans', () => {
  const r = convert('b\ntrue\nfalse\nTRUE');
  const d = JSON.parse(r.json);
  eq(d[0].b, true); eq(d[1].b, false); eq(d[2].b, true);
});

test('casts empty to null', () => {
  const r = convert('a,b\n1,\n,2');
  const d = JSON.parse(r.json);
  eq(d[0].b, null); eq(d[1].a, null);
});

test('no-types keeps strings', () => {
  const r = convert('n\n42', { autoTypes: false });
  const d = JSON.parse(r.json);
  eq(typeof d[0].n, 'string');
});

test('no-nulls keeps empty strings', () => {
  const r = convert('a,b\n1,', { nullEmpty: false });
  const d = JSON.parse(r.json);
  eq(d[0].b, '');
});

// ── Quoted fields ─────────────────────────────────────────────
test('handles quoted fields', () => {
  const r = convert('name,note\n"Smith, John","He said ""hello"""');
  const d = JSON.parse(r.json);
  eq(d[0].name, 'Smith, John');
  eq(d[0].note, 'He said "hello"');
});

test('handles multiline quoted fields', () => {
  const r = convert('id,text\n1,"line one\nline two"');
  const d = JSON.parse(r.json);
  assert(d[0].text.includes('\n'), 'should contain newline');
});

// ── No-header mode ────────────────────────────────────────────
test('no-header mode', () => {
  const r = convert('1,2,3\n4,5,6', { header: false });
  const d = JSON.parse(r.json);
  assert('col_0' in d[0], 'should have col_0');
  eq(d[0].col_0, 1);
});

// ── Formats ───────────────────────────────────────────────────
test('object format keyed by first col', () => {
  const r = convert('id,val\na,1\nb,2', { format: 'object' });
  const d = JSON.parse(r.json);
  assert('a' in d && 'b' in d, 'keys should be a and b');
});

test('split format', () => {
  const r = convert('x,y\n1,2', { format: 'split' });
  const d = JSON.parse(r.json);
  assert(Array.isArray(d.columns) && Array.isArray(d.rows), 'should have columns and rows');
  eq(d.columns, ['x','y']);
});

// ── Indent ────────────────────────────────────────────────────
test('minified output', () => {
  const r = convert('a\n1', { indent: 0 });
  assert(!r.json.includes('\n'), 'should be minified');
});

test('tab indent', () => {
  const r = convert('a\n1', { indent: 'tab' });
  assert(r.json.includes('\t'), 'should use tabs');
});

// ── Error handling ────────────────────────────────────────────
test('throws on empty input', () => {
  let threw = false;
  try { convert(''); } catch { threw = true; }
  assert(threw);
});

// ── Summary ───────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
