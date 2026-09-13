'use strict';
// Checks use parsers: comment-like text in strings and URLs is not stripped.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const postcss = require(process.env.AIM_POSTCSS_PATH || 'postcss');
const babel = require(process.env.AIM_BABEL_PARSER_PATH || '@babel/parser');
const root = path.resolve(__dirname, '..');
const forbiddenComment = /Аня\s+\d|AGENT RULE|USER-OWNED TEAM COPY|рабочая копия ушла|новых не создавать|предыдущих обсуждени/i;
const key = entry => JSON.stringify([entry.file, entry.context, entry.property, entry.value]);
function commentsValid(comments, file) {
  for (const comment of comments) assert(!forbiddenComment.test(comment), 'Collaboration residue in ' + file);
}
function verifyBudget(actual, budget) {
  const allowed = new Map();
  for (const entry of budget.entries) {
    assert(entry.role && entry.reason, 'Priority exception requires a role and reason');
    allowed.set(key(entry), (allowed.get(key(entry)) || 0) + 1);
  }
  for (const entry of actual) {
    const remaining = allowed.get(key(entry)) || 0;
    assert(remaining > 0, 'Unreviewed !important: ' + key(entry));
    allowed.set(key(entry), remaining - 1);
  }
  assert([...allowed.values()].every(n => n === 0), 'Remove stale priority exceptions from the budget');
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'source-manifest.json')));
const budget = JSON.parse(fs.readFileSync(path.join(root, 'important-budget.json')));
const actual = [];
for (const entry of manifest.blocks) {
  const source = fs.readFileSync(path.join(root, entry.path), 'utf8');
  if (entry.tag === 'script') {
    const ast = babel.parse(source, {sourceType:'script'});
    commentsValid(ast.comments.map(c => c.value), entry.path);
  } else {
    const ast = postcss.parse(source, {from:entry.path});
    ast.walkComments(c => commentsValid([c.text], entry.path));
    ast.walkDecls(d => {
      if (!d.important) return;
      const context = [];
      for (let node=d.parent; node && node.type !== 'root'; node=node.parent)
        context.unshift(node.selector || '@' + node.name + ' ' + node.params);
      actual.push({file:entry.path, context, property:d.prop, value:d.value});
    });
  }
}
verifyBudget(actual, budget);
// Negative controls ensure the guard rejects a new exception and changed values.
assert.throws(() => verifyBudget([...actual, {file:'unknown.css',context:['body'],property:'color',value:'red'}], budget), /Unreviewed/);
if (actual.length) assert.throws(() => verifyBudget([{...actual[0], value:'unreviewed-value'}], budget), /Unreviewed/);
assert.throws(() => commentsValid(['AGENT RULE: change this'], 'fixture'), /residue/);
commentsValid(babel.parse('const url="https://example.org/* AGENT RULE */"').comments.map(c=>c.value), 'string fixture');
console.log(`PASS ${manifest.blocks.length} parsed source files; ${actual.length} reviewed priority exceptions; comments and negative guards`);
