'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'src/page/runtime',name+'.js'),'utf8');
function harness({learning=false,hidden=false,reduced=false}={}){
  const listeners=new Map(),observations=[],frames=new Map();let next=1,now=1000,draws=0;
  const events=()=>({addEventListener(type,fn){const list=this.events.get(type)||[];list.push(fn);this.events.set(type,list)},events:new Map()});
  const node=()=>Object.assign(events(),{dataset:{},style:{},classList:{add(){},toggle(){},remove(){},contains(){return false}},attrs:{},children:[],
    getBoundingClientRect(){return {left:0,top:0,right:120,bottom:80,width:120,height:80}},
    setAttribute(k,v){this.attrs[k]=v;if(k==='d')draws++},removeAttribute(k){delete this.attrs[k]},hasAttribute(){return false},
    append(...items){this.children.push(...items)},prepend(...items){this.children.unshift(...items)},appendChild(item){this.children.push(item);return item},
    querySelector(selector){this.queries ||= {};return this.queries[selector] ||= node()},querySelectorAll(){return []},
    getContext(){return {setTransform(){},clearRect(){draws++},fillText(){}}}});
  const roots=[node(),node()];roots.forEach((n,i)=>n.dataset.morphPreset=i?'community':'practice');
  const graph=node(),branches=Array.from({length:4},(_,i)=>{const n=node();n.dataset.ecosystemBranch=String(i);return n});
  graph.querySelectorAll=selector=>selector==='[data-ecosystem-branch]'?branches:[];
  const document=Object.assign(events(),{hidden,documentElement:{dataset:{}},createElement:node,createElementNS:node,
    querySelector:selector=>selector==='[data-ecosystem-graph]'?graph:null,
    querySelectorAll:()=>learning?roots:[]});
  const media=Object.assign(events(),{matches:reduced});
  const context={document,performance:{now:()=>now},scrollY:0,devicePixelRatio:1,
    getComputedStyle:()=>({lineHeight:'18'}),matchMedia:q=>q.includes('prefers-reduced-motion')?media:{matches:false},
    requestAnimationFrame:fn=>{const id=next++;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),
    addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list)},
    IntersectionObserver:class{constructor(fn){this.fn=fn;this.targets=[];observations.push(this)}observe(target){this.targets.push(target)}},
    ResizeObserver:class{constructor(fn){this.fn=fn}observe(){}}};context.window=context;
  return {context,frames,roots,graph,observations,get draws(){return draws},
    execute(source){vm.runInNewContext(source,context)},
    fire(target,type,event={}){for(const fn of target.events.get(type)||[])fn(event)},
    visible(values){for(const observer of observations)observer.fn(observer.targets.map((target,i)=>({target,isIntersecting:values[i]??values[0]})))},
    hidden(value){document.hidden=value;this.fire(document,'visibilitychange')},
    reduced(value){media.matches=value;this.fire(media,'change',{matches:value})},
    tick(){const pending=[...frames.values()];frames.clear();now+=16;pending.forEach(fn=>fn(now))}};
}
{
  const h=harness();h.execute(read('ecosystem-graph'));
  assert.equal(h.frames.size,0,'graph must wait for intersection');
  h.visible([true]);h.visible([true]);assert.equal(h.frames.size,1,'duplicate intersection must not fork graph loop');
  const before=h.draws;h.tick();assert(h.draws>before,'actual graph renderer executed');assert.equal(h.frames.size,1);
  h.visible([false]);assert.equal(h.frames.size,0,'offscreen graph cancels pending RAF');
  h.visible([true]);assert.equal(h.frames.size,1);h.hidden(true);assert.equal(h.frames.size,0);
  h.visible([true]);assert.equal(h.frames.size,0,'intersection cannot wake hidden document');
  h.hidden(false);h.hidden(false);assert.equal(h.frames.size,1,'visibility resume is deduplicated');h.tick();
  h.hidden(true);h.visible([false]);h.hidden(false);assert.equal(h.frames.size,0,'hidden offscreen graph stays idle');
}
{
  const h=harness({learning:true});h.execute(read('learning-program-morph'));
  assert.equal(h.frames.size,1);h.visible([false,false]);assert.equal(h.frames.size,0);
  h.visible([false,true]);h.visible([false,true]);assert.equal(h.frames.size,1);
  const before=h.draws;h.tick();assert(h.draws>before,'actual 150-segment morph renderer executed');assert.equal(h.frames.size,1);
  h.reduced(true);assert.equal(h.frames.size,0,'reduced motion cancels animation');
  h.reduced(false);assert.equal(h.frames.size,1);h.hidden(true);assert.equal(h.frames.size,0);
  h.reduced(true);h.reduced(false);assert.equal(h.frames.size,0,'motion preference must not wake hidden page');
  h.hidden(false);assert.equal(h.frames.size,1);h.visible([false,false]);assert.equal(h.frames.size,0);
  h.reduced(true);h.reduced(false);assert.equal(h.frames.size,0,'offscreen preference change stays idle');
}
for(const mode of [{learning:true,reduced:true},{learning:true,hidden:true}]){
  const h=harness(mode);h.execute(read('learning-program-morph'));assert.equal(h.frames.size,0);assert(h.draws>0,'initial static paths remain available');
}
{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'source-manifest.json'))),template=fs.readFileSync(path.join(root,'src/page/index.html'),'utf8');
  const includes=[...template.matchAll(/\{\{source:([^}]+)\}\}/g)].map(m=>m[1]);
  assert.deepEqual(includes,manifest.blocks.map(b=>b.path),'all remaining include order is coherent');
  for(const name of ['direction-mini-scenes','direction-scene-physics','direction-field-legacy']){
    assert(!includes.some(p=>p.endsWith('/'+name+'.js')),'retired false&& script is excluded');
    assert(!fs.existsSync(path.join(root,'src/page/runtime',name+'.js')),'retired source is archived outside active sources');
  }
  const team=read('pixel-hover-and-team');assert(!team.includes('w19-procflow'),'disabled spiral no longer shipped');
  for(const entry of manifest.blocks.filter(b=>b.tag==='script'))new vm.Script(fs.readFileSync(path.join(root,entry.path),'utf8'),{filename:entry.path});
}
console.log('PASS actual graph/morph schedulers: zero idle RAF, deduplicated wake, hidden/reduced handling, real renderer execution; retired code excluded, source order and JS compile');
