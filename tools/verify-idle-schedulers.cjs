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
const h=harness();Object.assign(h,{embedded:false,hideHero:false,ctx:{clearRect:()=>{}},hero:{getBoundingClientRect:()=>({bottom:h.heroBottom??600})},W:375,mobileField:true,mobileStill:false,mobilePainted:false,H:700,t:0,typeT:0,introT:0,dprGov:0,dprGovT:0,DPR:1.5,logoData:{},renders:0,size:()=>{},render:()=>h.renders++});
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
// The local homepage experiment suppresses only the hero field and keeps desktop lower-page effects.
h.hideHero=true;h.fire('resize');assert.equal(h.pending(),0,'no field in the mobile homepage hero');
h.mobileField=false;h.heroBottom=1000;h.fire('resize');assert.equal(h.pending(),0,'no field while the homepage hero fills the viewport');
h.heroBottom=400;h.fire('scroll');assert.equal(h.pending(),1,'lower-page field resumes below the homepage hero');
// A bounded mount uses its own visibility even far below the document origin.
const e=harness();let mountTop=1200;
Object.assign(e,{embedded:true,hideHero:false,fieldVisible:false,mount:{getBoundingClientRect:()=>({top:mountTop,bottom:mountTop+440,left:20,right:350})},
 mobileField:false,mobileStill:false,mobilePainted:false,W:330,H:440,t:0,typeT:0,introT:0,dprGov:0,dprGovT:0,DPR:1.5,logoData:{},renders:0,size:()=>{},render:()=>e.renders++});
vm.runInContext(hero.match(/function invalidateSafeGeometry\(\)\{[^}]+\}/)[0]+'\n'+scheduler,e);
assert.equal(e.pending(),0,'offscreen embedded field starts asleep');
e.scrollY=2000;mountTop=120;e.fire('scroll');e.fire('scroll');assert.equal(e.pending(),1);e.step(100);assert.equal(e.renders,1,'embedded field runs at a large document scroll offset');
mountTop=-500;e.intersection();assert.equal(e.pending(),0);const embeddedElapsed=e.t;
mountTop=120;e.intersection();e.step(10000);assert.equal(e.t,embeddedElapsed,'embedded resume has no time jump');
e.motionPreference.matches=true;e.preferenceChange();e.step(10100);assert.equal(e.pending(),0,'reduced motion renders one static desktop frame');
const stillRenders=e.renders;e.fire('scroll');assert.equal(e.renders,stillRenders);assert.equal(e.pending(),0);
e.motionPreference.matches=false;e.preferenceChange();assert.equal(e.pending(),1);
e.document.body.style.position='fixed';e.mutation();assert.equal(e.pending(),0);e.document.body.style.position='';e.mutation();assert.equal(e.pending(),1);
e.document.hidden=true;e.fire('visibilitychange');assert.equal(e.pending(),0);e.document.hidden=false;e.fire('visibilitychange');assert.equal(e.pending(),1);
e.mobileField=true;e.motionPreference.matches=true;e.preferenceChange();e.step(10200);assert.equal(e.pending(),0,'reduced motion renders one static mobile frame');

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
