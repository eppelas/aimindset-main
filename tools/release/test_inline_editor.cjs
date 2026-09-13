const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../src/page/runtime/inline-editor.js'),'utf8');
function harness(answer,remoteRev=167){
  class Element {
    constructor(scope=''){this.scope=scope;this.listeners={};this.attrs={};this.style={};this.textContent='Text';this.children=[];this.childNodes=[{nodeType:3,textContent:'Text'}];const flags=new Set();this.classList={toggle:(k,v)=>v?flags.add(k):flags.delete(k),contains:k=>flags.has(k)};}
    addEventListener(k,fn){this.listeners[k]=fn;}
    setAttribute(k,v){this.attrs[k]=v;} removeAttribute(k){delete this.attrs[k];}
    closest(s){return this.scope&&s.split(',').map(x=>x.trim()).includes(this.scope)?this:null;}
    matches(s){return s.includes('h1');} getClientRects(){return [{}];}
    appendChild(){} remove(){}
  }
  const controls=Object.fromEntries(['editToggle','editDuplicate','editSave','editVariantLink','editStatus'].map(k=>[k,new Element()]));
  const fields=['','header','footer','#learning','#aim-mobile-menu'].map(x=>new Element(x));
  const body=new Element();let fetches=0,prompts=0;
  const document={createElement(){const d=new Element();const form=new Element(),input={value:answer},cancel=new Element();d.querySelector=s=>s==='form'?form:s==='input'?input:cancel;d.showModal=()=>{prompts++;queueMicrotask(()=>answer===null?d.listeners.cancel({preventDefault(){}}):form.listeners.submit({preventDefault(){}}));};return d;},body,documentElement:{dataset:{rev:'167'}},getElementById:k=>controls[k],querySelector:s=>s.includes('aim-edit-object')?{content:'wild/index.html'}:null,querySelectorAll:s=>s==='body *'?fields:s==='[data-editable]'?fields.filter(e=>'data-editable'in e.attrs):[],addEventListener(){}};
  const sandbox={document,window:{addEventListener(){},prompt(){prompts++;return answer;}},matchMedia:()=>({matches:true,addEventListener(){}}),MutationObserver:class{observe(){}disconnect(){}},Element,HTMLElement:Element,Node:{TEXT_NODE:3},getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),location:{protocol:'https:',hostname:'aimindset-wild.web.app',origin:'https://aimindset-wild.web.app'},URL,fetch:async()=>{fetches++;return {ok:true,json:async()=>({ok:true,rev:remoteRev})};},setTimeout,clearTimeout};
  vm.runInNewContext(source,sandbox);
  return {controls,fields,body,toggle:()=>controls.editToggle.listeners.click(),metrics:()=>({fetches,prompts})};
}
test('cancel and wrong password never fetch or enable',async()=>{for(const answer of [null,'bad']){const h=harness(answer);await h.toggle();assert.equal(h.body.classList.contains('editing'),false);assert.equal(h.metrics().fetches,0);}});
test('correct password keeps shared components locked and can exit without prompting again',async()=>{const h=harness('0281');await h.toggle();assert.equal(h.body.classList.contains('editing'),true);assert.equal(h.fields[0].attrs.contenteditable,'true');for(const field of h.fields.slice(1))assert.equal(field.attrs.contenteditable,undefined);await h.toggle();assert.equal(h.body.classList.contains('editing'),false);assert.equal(h.metrics().prompts,1);});
test('correct password preserves existing stale-version rejection',async()=>{const h=harness('0281',168);await h.toggle();assert.equal(h.body.classList.contains('editing'),false);assert.match(h.controls.editStatus.textContent,/rev 168/);assert.equal(h.controls.editToggle.disabled,false);});
