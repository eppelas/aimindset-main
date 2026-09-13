'use strict';
// Only identical values under identical selectors and media conditions are automatic.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const postcss = require(process.env.AIM_POSTCSS_PATH || 'postcss');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'source-manifest.json')));
const sheets = manifest.blocks.filter(x => x.tag === 'style').map(entry => {
  const source = fs.readFileSync(path.join(root, entry.path), 'utf8');
  return { file:entry.path, source, ast:postcss.parse(source, {from:entry.path}) };
});
const declarations = [];
for (const sheet of sheets) sheet.ast.walkDecls(node => {
  if (node.parent.type !== 'rule') return;
  const context = [];
  for (let p=node.parent.parent; p && p.type !== 'root'; p=p.parent) {
    if (p.type !== 'atrule' || p.name !== 'media') return;
    context.unshift('@'+p.name+' '+p.params);
  }
  declarations.push({sheet, node, context, selector:node.parent.selector});
});
const seen = new Map(), candidates = [];
const describe = d => ({file:d.sheet.file, line:d.node.source.start.line, context:d.context,
  selector:d.selector, property:d.node.prop, value:d.node.value, important:!!d.node.important});
for (const current of declarations.slice().reverse()) {
  const key = JSON.stringify([current.context, current.selector, current.node.prop]);
  const later = seen.get(key) || {};
  const winner = later.important || (!current.node.important && later.normal);
  if (winner) candidates.push({current, winner, identical:current.node.value === winner.node.value});
  const priority = current.node.important ? 'important' : 'normal';
  if (!later[priority]) later[priority] = current;
  seen.set(key, later);
}
const selected = candidates.filter(x => x.identical);
if (!process.argv.includes('--apply-identical')) {
  console.log(JSON.stringify({candidates:candidates.length, identical:selected.length,
    importantRemoved:selected.filter(x=>x.current.node.important).length,
    review:candidates.map(x=>({earlier:describe(x.current),later:describe(x.winner),identical:x.identical}))},null,2));
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const backup = path.join(root,'backups','cascade-prune-'+stamp);
const operations = [];
const affected = new Set(selected.map(x=>x.current.sheet));
for (const sheet of affected) {
  const dest=path.join(backup,sheet.file); fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(path.join(root,sheet.file),dest,fs.constants.COPYFILE_EXCL);
  operations.push({src:sheet.file,dst:path.relative(root,dest),sha256:crypto.createHash('sha256').update(sheet.source).digest('hex')});
}
for (const item of selected) item.current.node.remove();
for (const sheet of affected) {
  sheet.ast.walkRules(rule=>{if (!rule.nodes.length) rule.remove();});
  fs.writeFileSync(path.join(root,sheet.file),sheet.ast.toString());
}
const report = {policy:'Same exact selector, property, value and complete media context; later equal or higher priority; no reordering.',
  count:selected.length,importantRemoved:selected.filter(x=>x.current.node.important).length,
  operations,removed:selected.map(x=>({earlier:describe(x.current),later:describe(x.winner)}))};
fs.writeFileSync(path.join(root,'tools/cascade-cleanup.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({removed:report.count,importantRemoved:report.importantRemoved,files:affected.size,backup:path.relative(root,backup)}));
