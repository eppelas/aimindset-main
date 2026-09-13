// VM regression checks for the original Wild animation scheduling.
// Run: node verify-animation-scheduling.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const html = fs.readFileSync(path.resolve(__dirname, process.argv[2] || '../index.html'), 'utf8');
function setup() {
  let next = 1, reads = 0, draws = 0, clears = 0;
  const queue = new Map(), ev = {}, dev = {}, ce = {}, ie = {}, nodes=[], observers=[];
  const ctx = {setTransform(){}, clearRect(){clears++}, fillRect(){draws++}, drawImage(){},
    getImageData(x,y,w,h){reads++; return {data:new Uint8Array(w*h*4)}}};
  const rect = {left:0,top:0,right:140,bottom:140,width:140,height:140};
  const image = {src:'one.png', naturalWidth:280, naturalHeight:280,
    getBoundingClientRect:()=>rect, addEventListener:(n,f)=>ie[n]=f};
  const card = {querySelector:()=>image, addEventListener:(n,f)=>ce[n]=f,
    getBoundingClientRect:()=>({...rect,right:200})};
  const doc = {getElementById:()=>({clientWidth:390,clientHeight:600,append(){},addEventListener(){}}),hidden:false, body:{appendChild(){}}, querySelectorAll:()=>[card], querySelector:()=>({append(){}}),
    createElement:tag=>{const n={tag,width:0,height:0,style:{},dataset:{},events:{},append(){},setAttribute(){},setPointerCapture(){},addEventListener(k,f){this.events[k]=f},getBoundingClientRect:()=>rect,getContext:()=>ctx};nodes.push(n);return n;},
    addEventListener:(n,f)=>dev[n]=f, elementFromPoint:()=>null};
  const env = {performance:{now:()=>0},IntersectionObserver:function(cb){observers.push(cb);this.observe=()=>{};},document:doc,innerWidth:1000,innerHeight:800,devicePixelRatio:2,
    matchMedia:q=>({matches:!q.includes('reduced-motion')}), addEventListener:(n,f)=>ev[n]=f,
    requestAnimationFrame:f=>{const id=next++;queue.set(id,f);return id},
    cancelAnimationFrame:id=>queue.delete(id)};
  env.window=env;
  return {env,ev,dev,ce,ie,rect,image,doc,queue,card,nodes,observers,
    tick(t){const q=[...queue.values()];queue.clear();q.forEach(f=>f(t))},
    stats:()=>({reads,draws,clears})};
}
function script(marker, opening) {
  const p=html.indexOf(marker);assert(p>=0, `Missing marker: ${marker}`);
  const start=html.indexOf(opening,p),end=html.indexOf('</script>',p);
  assert(start>=p&&end>start);return html.slice(start,end).split('/* Двойная спираль процесса.')[0];
}
const results=[];
let s=setup();
vm.runInNewContext(script('/* ═══ пикселизация команды:', '(function(){'),s.env);
assert.equal(s.queue.size,0);
s.ce.mouseenter();s.ce.mouseenter();assert.equal(s.queue.size,1);
s.tick(100);assert.equal(s.stats().reads,1);
s.tick(116);assert.equal(s.stats().reads,1);
s.image.src='two.png';s.tick(132);assert.equal(s.stats().reads,2);
s.rect.width=168;s.tick(148);assert.equal(s.stats().reads,3);
// Same URL and dimensions, fresh bytes loaded: must sample again exactly once.
s.ie.load();assert.equal(s.queue.size,1);
s.tick(164);assert.equal(s.stats().reads,4);
s.tick(180);assert.equal(s.stats().reads,4);
s.doc.hidden=true;s.dev.visibilitychange();assert.equal(s.queue.size,0);
s.doc.hidden=false;s.dev.visibilitychange();assert.equal(s.queue.size,1);
s.ce.mouseleave();assert.equal(s.queue.size,0);
// Reload while inactive invalidates data without starting invisible animation.
s.ie.load();assert.equal(s.queue.size,0);
s.ce.mouseenter();s.tick(196);assert.equal(s.stats().reads,5);
results.push('PASS team: idle, deduplicated wake, cache reuse, source/size invalidation, same-URL load invalidation active and inactive, hidden/resume, leave cancellation');
s=setup();vm.runInNewContext(script('/* ═══ курсор-лого','(function()'),s.env);
assert.equal(s.queue.size,0);
const about={closest:q=>q==='#about'?{}:null};
const move=target=>s.ev.pointermove({clientX:20,clientY:20,target});
move(about);move(about);assert.equal(s.queue.size,1);
s.tick(100);assert(s.stats().draws>0);assert.equal(s.queue.size,1);
move({closest:()=>null});for(let i=0;i<30;i++)s.tick(116+i*16);
assert.equal(s.queue.size,0);
move(about);s.tick(700);s.doc.hidden=true;s.dev.visibilitychange();assert.equal(s.queue.size,0);
s.doc.hidden=false;s.dev.visibilitychange();assert.equal(s.queue.size,1);
results.push('PASS cursor: idle, deduplicated wake, visible painting, fade completion, hidden/resume');
// Mobile team interactions must wake a timed effect, retain hint priority and expire.
s=setup();s.env.innerWidth=390;
vm.runInNewContext(script('/* ═══ пикселизация команды:', '(function(){'),s.env);
s.ce.mouseenter();assert.equal(s.queue.size,0);
s.dev['aim:team-effect']({detail:{card:s.card,duration:400,hint:false}});
assert.equal(s.queue.size,1);s.tick(40);assert.equal(s.stats().reads,1);
const painted=s.stats().clears;s.tick(50);assert.equal(s.stats().clears,painted);
s.dev['aim:team-effect']({detail:{card:s.card,duration:900,hint:true}});
s.tick(450);assert.equal(s.queue.size,0); // Hint must not extend the active interaction.
s.dev['aim:team-effect']({detail:{card:s.card,duration:600,hint:true}});s.tick(480);
assert.equal(s.queue.size,1);s.tick(700);assert.equal(s.queue.size,0);
results.push('PASS mobile team: desktop hover ignored, timed tap wakes, 30fps throttle, hint cannot override interaction, duration expiry');
s=setup();s.env.innerWidth=390;
vm.runInNewContext(script('/* ═══ курсор-лого','(function()'),s.env);
assert.equal(s.queue.size,0);s.observers[0]([{isIntersecting:true}]);
s.tick(100);assert(s.stats().draws>0);
const host=s.nodes.find(n=>n.tag==='button');
assert(host.events.pointerdown && host.events.pointermove && host.events.keydown);
host.events.pointerdown({clientX:10,clientY:10,pointerId:1,stopPropagation(){}});host.events.pointermove({clientX:20});
host.events.keydown({key:'ArrowLeft',preventDefault(){}});s.tick(116);
s.rect.top=900;s.rect.bottom=996;s.observers[0]([{isIntersecting:false}]);
for(let i=0;i<30;i++)s.tick(132+i*16);assert.equal(s.queue.size,0);
s.rect.top=100;s.rect.bottom=196;s.observers[0]([{isIntersecting:true}]);
assert.equal(s.queue.size,1);s.tick(900);
results.push('PASS mobile about logo: host observer wake, drag and keyboard retained, offscreen fade stops, reentry resumes');

const p=html.indexOf('  let running=false;');assert(p>=0);
const end=html.indexOf('})();',p);assert(end>p);
s=setup();let visible=true,draw=0;
Object.assign(s.env,{states:[{visible:()=>visible}],safeDraw:()=>draw++,performance:{now:()=>10},previous:0,reduced:false});
vm.runInNewContext(html.slice(p,end),s.env);
assert.equal(s.queue.size,1);s.tick(100);assert.equal(draw,1);
visible=false;s.tick(116);assert.equal(s.queue.size,0);
visible=true;s.dev.visibilitychange();assert.equal(s.queue.size,1);
s.tick(132);assert.equal(draw,2);
results.push('PASS directions: visible draw, all-offscreen suspension, visibility wake');
console.log(JSON.stringify({sourceSha256:crypto.createHash('sha256').update(html).digest('hex'),results,
  scope:'Mock VM scheduler/state verification only; does not prove browser visual equality or performance.'},null,2));
