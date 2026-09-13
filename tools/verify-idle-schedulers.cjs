const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function harness(){
  const callbacks=new Map(),events={},docEvents={};let seq=0;
  const on=(map,name,fn)=>(map[name]??=[]).push(fn);
  const h={console,Math,innerWidth:375,innerHeight:800,scrollY:0,performance:{now:()=>0},
    document:{hidden:false,body:{style:{}},fonts:{ready:{then:()=>{}}},addEventListener:(n,f)=>on(docEvents,n,f)},
    addEventListener:(n,f)=>on(events,n,f),requestAnimationFrame:f=>{callbacks.set(++seq,f);return seq;},cancelAnimationFrame:id=>callbacks.delete(id),
    MutationObserver:class{constructor(fn){h.mutation=fn;}observe(){}},IntersectionObserver:class{constructor(fn){h.intersection=fn;}observe(){}},
    motionPreference:{matches:false,addEventListener:(n,f)=>{h.preferenceChange=f;}},
  };h.window=h;h.fire=n=>(events[n]||docEvents[n]||[]).forEach(f=>f());h.pending=()=>callbacks.size;
  h.step=t=>{const list=[...callbacks.values()];callbacks.clear();list.forEach(f=>f(t));};
  return vm.createContext(h);
}
const hero=fs.readFileSync(path.join(root,'src/page/runtime/hero-field.js'),'utf8');
const scheduler=hero.slice(hero.indexOf('  var fieldRaf='),hero.lastIndexOf('})();'));
assert(scheduler.includes('function fieldCanRun'));
const h=harness();Object.assign(h,{mobileField:true,mobileStill:false,mobilePainted:false,H:700,t:0,typeT:0,introT:0,dprGov:0,dprGovT:0,DPR:1.5,logoData:{},renders:0,size:()=>{},render:()=>h.renders++});
// Run the actual scheduler plus the source invalidation function, with only the renderer stubbed.
vm.runInContext(hero.match(/function invalidateSafeGeometry\(\)\{[^}]+\}/)[0]+'\n'+scheduler,h);
assert.equal(h.pending(),1);h.step(100);h.step(140);assert.equal(h.renders,2);
h.scrollY=1000;h.fire('scroll');assert.equal(h.pending(),0);const elapsed=h.t;
h.scrollY=0;h.fire('scroll');h.fire('scroll');assert.equal(h.pending(),1);h.step(10000);assert.equal(h.t,elapsed,'no elapsed-time jump after sleeping');
h.document.body.style.position='fixed';h.mutation();assert.equal(h.pending(),0);
h.document.body.style.position='';h.mutation();assert.equal(h.pending(),1);h.step(10100);
h.motionPreference.matches=true;h.preferenceChange();h.step(10200);assert.equal(h.pending(),0,'static mobile frame sleeps');
vm.runInContext('invalidateSafeGeometry()',h);assert.equal(h.pending(),1);h.step(10300);assert.equal(h.pending(),0);
h.motionPreference.matches=false;h.preferenceChange();assert.equal(h.pending(),1);h.step(10400);
h.document.hidden=true;h.fire('visibilitychange');assert.equal(h.pending(),0);h.document.hidden=false;h.fire('visibilitychange');assert.equal(h.pending(),1);
h.mobileField=false;h.scrollY=10000;h.fire('scroll');h.step(10500);assert.equal(h.pending(),1,'desktop field remains global');
h.mobileField=true;h.fire('resize');assert.equal(h.pending(),0);h.scrollY=0;h.fire('scroll');assert.equal(h.pending(),1);
assert(hero.includes('buildLogoSilhouette(); buildCursorLogo(); invalidateSafeGeometry();'),'logo mask load invalidates static frame');
const f=harness();let top=100,draws=0;const reduce={matches:false,addEventListener:(n,fn)=>{f.reduceChange=fn;}};
const item={addEventListener:()=>{}};const ctx={clearRect:()=>draws++,fillRect:()=>{}};
const canvas={getContext:()=>ctx,getAttribute:()=> 'human',closest:()=>item,getBoundingClientRect:()=>({top,bottom:top+156})};
f.document.querySelectorAll=()=>[canvas];f.matchMedia=()=>reduce;
vm.runInContext(fs.readFileSync(path.join(root,'src/page/runtime/team-faces.js'),'utf8'),f);
assert.equal(draws,1);assert.equal(f.pending(),1);f.step(100);assert.equal(draws,2);
top=1000;f.intersection();assert.equal(f.pending(),0);top=100;f.intersection();f.fire('scroll');assert.equal(f.pending(),1);f.step(200);
reduce.matches=true;f.reduceChange();f.step(250);assert.equal(f.pending(),0);const staticDraws=draws;f.fire('scroll');assert.equal(f.pending(),0);assert.equal(draws,staticDraws);
reduce.matches=false;f.reduceChange();assert.equal(f.pending(),1);f.document.hidden=true;f.fire('visibilitychange');assert.equal(f.pending(),0);f.document.hidden=false;f.fire('visibilitychange');assert.equal(f.pending(),1);
f.step(300);const beforeThrottle=draws;f.step(310);assert.equal(draws,beforeThrottle);assert.equal(f.pending(),1);f.step(340);assert.equal(draws,beforeThrottle+1);
console.log('PASS: actual hero scheduler and full team source suspend/restart, single RAF, mobile/static transitions, layout/mask invalidation, desktop global field, 30fps throttle.');
