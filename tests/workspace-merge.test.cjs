const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/workspaceMerge.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const { mergeWorkspace } = exportsObject;
const normalize = (value) => JSON.parse(JSON.stringify(value));
const archive = (opportunities = []) => ({ opportunities, tasks: [], brands: [], salesReps: [] });
test('three way merge preserves independent fields, parallel additions and activity history', () => {
  const base = archive([{ id: 'one', phone: 'old', email: 'old', history: [] }]);
  const local = archive([{ ...base.opportunities[0], phone: 'new', history: [{ id: 'a', title: 'First' }] }, { id: 'two' }]);
  const remote = archive([{ ...base.opportunities[0], email: 'new', history: [{ id: 'b', title: 'Second' }] }, { id: 'three' }]);
  const result = normalize(mergeWorkspace(base, local, remote));
  assert.equal(result.opportunities.length, 3);
  assert.equal(result.opportunities[0].phone, 'new'); assert.equal(result.opportunities[0].email, 'new');
  assert.deepEqual(result.opportunities[0].history.map((item) => item.id), ['a', 'b']);
});
test('unchanged remote deletions stay deleted; concurrent edits stay visible', () => {
  const base = archive([{ id: 'one', phone: 'old' }]);
  assert.deepEqual(normalize(mergeWorkspace(base, base, archive())).opportunities, []);
  assert.equal(mergeWorkspace(base, archive([{ id: 'one', phone: 'new' }]), archive()).opportunities[0].phone, 'new');
});
