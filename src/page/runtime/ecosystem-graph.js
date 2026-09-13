
(() => {
  'use strict';
  const graph=document.querySelector('[data-ecosystem-graph]');
  if(!graph||graph.__ecosystemReady)return;
  graph.__ecosystemReady=true;
  const root=graph.querySelector('.ecosystem-root'),branches=[...graph.querySelectorAll('[data-ecosystem-branch]')];
  if(!root||branches.length!==4)return;
  const SVG_NS='http://www.w3.org/2000/svg',svg=document.createElementNS(SVG_NS,'svg');
  svg.classList.add('ecosystem-tree-lines');svg.setAttribute('aria-hidden','true');svg.dataset.editorRuntime='';
  const lineSets=new Map(),railPath=document.createElementNS(SVG_NS,'path');
  railPath.classList.add('ecosystem-tree-line');svg.append(railPath);
  branches.forEach(branch=>{
    const key=branch.dataset.ecosystemBranch,main=document.createElementNS(SVG_NS,'path'),land=document.createElementNS(SVG_NS,'path'),kids=document.createElementNS(SVG_NS,'path'),px=document.createElementNS(SVG_NS,'path');
    main.classList.add('ecosystem-tree-line');land.classList.add('ecosystem-tree-px');kids.classList.add('ecosystem-tree-line','ecosystem-tree-kids');px.classList.add('ecosystem-tree-px','ecosystem-tree-kids');
    [main,land,kids,px].forEach(p=>{p.dataset.branch=key});svg.append(main,land,kids,px);lineSets.set(key,[main,land,kids,px]);
  });
  const canvas=document.createElement('canvas');canvas.className='ecosystem-flow-canvas';canvas.setAttribute('aria-hidden','true');canvas.dataset.editorRuntime='';canvas.id='codex-browser-ecosystem-flow';
  graph.prepend(canvas,svg);
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t;
  /* pixel traces, one flat level: trunk from the root, a single shared rail,
     four vertical drops — one into each card's top center; child spines/ticks
     use the same 8px orthogonal grammar. */
  const G=8,Q=v=>Math.round(v/G)*G;
  const setLines=()=>{
    const gr=graph.getBoundingClientRect(),rr=root.getBoundingClientRect();
    svg.setAttribute('viewBox',`0 0 ${Math.max(1,gr.width)} ${Math.max(1,gr.height)}`);
    if(matchMedia('(max-width:960px)').matches){
      const trunk=6.5;let bottom=0;
      branches.forEach(branch=>{
        const card=branch.querySelector('.ecosystem-direction-card').getBoundingClientRect();
        const scene=branch.querySelector('.direction-scene').getBoundingClientRect();
        const title=branch.querySelector('.ecosystem-direction-copy').getBoundingClientRect();
        const x=Math.round(card.left-gr.left)-.5;
        const y=Math.round(scene.top-gr.top+scene.height/2)+.5;
        const ty=Math.round(title.top-gr.top+title.height/2)+.5;
        const [main,land,kids,px]=lineSets.get(branch.dataset.ecosystemBranch);
        main.setAttribute('d',`M ${trunk} ${y} H ${x} M ${trunk} ${ty} H ${x}`);
        land.setAttribute('d',`M ${trunk-1.5} ${y-1.5} h 3 v 3 h -3 Z`);
        kids.setAttribute('d','');px.setAttribute('d','');bottom=ty;
      });
      railPath.setAttribute('d',`M ${trunk} -24 V ${bottom}`);
      return;
    }
    const sx=Q(rr.left-gr.left+rr.width/2),sy=Q(rr.bottom-gr.top+4),busY=Q(sy+18),exs=[];
    branches.forEach(branch=>{
      const card=branch.querySelector('.ecosystem-direction-card'),cr=card.getBoundingClientRect(),ex=Q(cr.left-gr.left+cr.width/2),ey=Q(cr.top-gr.top);
      exs.push(ex);
      const [main,land,kids,px]=lineSets.get(branch.dataset.ecosystemBranch);
      main.setAttribute('d',`M ${ex+.5} ${busY+.5} V ${ey+.5}`);
      land.setAttribute('d',`M ${ex-1.5} ${ey-4.5} h 4 v 4 h -4 Z`);
      let dKids='',dPx='';
      const labels=[...branch.querySelectorAll('.ecosystem-child-label')];
      branch.querySelector('.ecosystem-children')?.classList.toggle('ecosystem-children--few',labels.length>0&&labels.length<=2);
      if(labels.length){
        const cols=[];
        labels.forEach(l=>{
          const r=l.getBoundingClientRect(),lh=parseFloat(getComputedStyle(l).lineHeight)||18,x=r.left-gr.left,y=r.top-gr.top+lh/2;
          const col=cols.find(c=>Math.abs(c.x-x)<14);
          if(col){col.x=Math.min(col.x,x);col.ys.push(y)}else cols.push({x,ys:[y]});
        });
        cols.sort((a,b)=>a.x-b.x);
        cols.forEach((col,ci)=>{
          const tickEnd=Q(col.x-8),colX=tickEnd-G;
          const ys=col.ys.map(v=>Math.round(v)),bot=Math.max(...ys);   /* тик ровно на строке своей подписи, без снапа к 8px */
          const top=ci===0?Q(cr.bottom-gr.top):Math.min(...ys)-G;
          dKids+=` M ${colX+.5} ${top+.5} V ${bot+.5}`;
          ys.forEach(y=>{dKids+=` M ${colX+.5} ${y+.5} H ${tickEnd+.5}`;dPx+=` M ${tickEnd-.5} ${y-1.5} h 3 v 3 h -3 Z`});
          if(ci===0){branch.dataset.spineX=colX;branch.dataset.spineY=bot}
        });
      }
      kids.setAttribute('d',dKids);
      px.setAttribute('d',dPx);
    });
    const railA=Math.min(...exs),railB=Math.max(...exs);
    railPath.setAttribute('d',`M ${sx+.5} ${sy+.5} V ${busY+.5}${railB>railA?` M ${railA+.5} ${busY+.5} H ${railB+.5}`:''}`);
  };
  const activate=(branch,on)=>{
    const paths=lineSets.get(branch.dataset.ecosystemBranch)||[];paths.forEach(path=>path.classList.toggle('is-active',on));
  };
  branches.forEach(branch=>{
    branch.addEventListener('pointerenter',()=>activate(branch,true));branch.addEventListener('pointerleave',()=>activate(branch,false));
    branch.addEventListener('focusin',()=>activate(branch,true));branch.addEventListener('focusout',e=>{if(!branch.contains(e.relatedTarget))activate(branch,false)});
    const effect=branch.querySelector('.ecosystem-direction-effect');
    effect?.addEventListener('click',()=>{if(matchMedia('(hover:none)').matches){const open=!branch.classList.contains('is-open');branches.forEach(item=>{item.classList.remove('is-open');item.querySelector('.ecosystem-direction-effect')?.setAttribute('aria-pressed','false')});branch.classList.toggle('is-open',open);effect.setAttribute('aria-pressed',String(open));activate(branch,open)}});
  });
  const ctx=canvas.getContext('2d');
  let W=1,H=1,DPR=1,COLS=1,ROWS=1,moist=new Float32Array(1),obst=new Uint8Array(1),parts=[],visible=false,dirty=true,lastObst=0,prev=performance.now(),mx=-1e4,my=-1e4,boost=1,lastScroll=scrollY,pendingShift=0;
  const CELL_W=7,CELL_H=13,FONT='11px "JetBrains Mono",ui-monospace,monospace',DECAY=.94,DEPOSIT=.13,BANDS=[[.06,'·'],[.22,'~'],[.5,'≈']],POOL_LOW='.:;·',POOL_MID='=+<>{}',POOL_HIGH='01$#',INK='#777d83';
  const hash=(x,y)=>{const s=Math.sin(x*12.9898+y*78.233)*43758.5453;return s-Math.floor(s)};
  const spawn=(p,top=false)=>{p.x=Math.random()*W;p.y=top?-8-Math.random()*36:Math.random()*H;p.vx=0;p.vy=28+Math.random()*28};
  const resize=()=>{
    const r=graph.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);DPR=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);ctx.font=FONT;ctx.textBaseline='top';COLS=Math.ceil(W/CELL_W);ROWS=Math.ceil(H/CELL_H)+2;moist=new Float32Array(COLS*ROWS);obst=new Uint8Array(COLS*ROWS);const count=clamp(Math.round(W*H/2800),36,140);parts=Array.from({length:count},()=>{const p={};spawn(p);return p});dirty=true;setLines();
  };
  const mark=(cx,cy)=>{if(cx>=0&&cx<COLS&&cy>=0&&cy<ROWS)obst[cy*COLS+cx]=1};
  const buildObstacles=()=>{
    obst.fill(0);const gr=graph.getBoundingClientRect(),targets=[root,...branches.map(b=>b.querySelector('.ecosystem-direction-card')),...graph.querySelectorAll('.ecosystem-child-label')];
    targets.forEach(el=>{if(!el)return;const r=el.getBoundingClientRect(),c0=Math.floor((r.left-gr.left)/CELL_W)-1,c1=Math.ceil((r.right-gr.left)/CELL_W)+1,r0=Math.floor((r.top-gr.top)/CELL_H)-1,r1=Math.ceil((r.bottom-gr.top)/CELL_H)+1;for(let cy=r0;cy<=r1;cy++)for(let cx=c0;cx<=c1;cx++){const edge=cy===r0||cy===r1||cx===c0||cx===c1;if(edge&&hash(cx*3,cy*7)<.3)continue;mark(cx,cy)}});dirty=false;
  };
  const isRock=(x,y)=>{const cx=(x/CELL_W)|0,cy=(y/CELL_H)|0;return cx>=0&&cx<COLS&&cy>=0&&cy<ROWS&&obst[cy*COLS+cx]===1};
  const flowAngle=(x,y,t)=>Math.PI/2+Math.sin(y*.006+t*.00022+Math.sin(x*.004+t*.00013)*1.7)*.85;
  const rhythmAt=docY=>{const v=.5+.5*Math.sin(docY*.0011+1.3)*Math.sin(docY*.00041+.4);return .05+.95*Math.pow(v,2.4)};
  const shiftRows=(map,n)=>{if(n>0&&n<ROWS){map.copyWithin(0,n*COLS);map.fill(0,(ROWS-n)*COLS)}else if(n<0&&-n<ROWS){map.copyWithin(-n*COLS,0,(ROWS+n)*COLS);map.fill(0,0,-n*COLS)}else map.fill(0)};
  const step=(dt,time)=>{
    const graphDocTop=graph.getBoundingClientRect().top+scrollY;
    for(const p of parts){const near=Math.hypot(p.x-mx,p.y-my),a=flowAngle(p.x,p.y,time),sp=(44+28*hash(p.x|0,13))*(.72+.28*boost);let ax=Math.cos(a)*sp,ay=Math.sin(a)*sp;if(near<92&&near>1){const f=(1-near/92)*220;ax+=(p.x-mx)/near*f;ay+=(p.y-my)/near*f*.62}p.vx+=(ax-p.vx)*Math.min(dt*4,1);p.vy+=(ay-p.vy)*Math.min(dt*4,1);let nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;if(isRock(nx,ny)){const left=!isRock(nx-CELL_W,p.y),right=!isRock(nx+CELL_W,p.y);nx=p.x+(left===right?(hash(p.x,p.y)<.5?-1:1):right?1:-1)*CELL_W*2*dt*8;ny=p.y;if(isRock(nx,ny)){nx=p.x;ny=p.y-CELL_H*dt*4}}p.x=nx;p.y=ny;if(p.y>H+20||p.x<-30||p.x>W+30){spawn(p,true);continue}const ci=((p.y/CELL_H)|0)*COLS+((p.x/CELL_W)|0);if(ci>=0&&ci<moist.length&&!obst[ci])moist[ci]=Math.min(1,moist[ci]+DEPOSIT*boost*rhythmAt(p.y+graphDocTop))}
  };
  const render=()=>{ctx.clearRect(0,0,W,H);for(let cy=0;cy<ROWS;cy++){const y=cy*CELL_H;for(let cx=0;cx<COLS;cx++){const i=cy*COLS+cx,m=moist[i];if(m<BANDS[0][0]){moist[i]*=DECAY;continue}const pool=m>=BANDS[2][0]?POOL_HIGH:m>=BANDS[1][0]?POOL_MID:POOL_LOW,glyph=pool[(hash(cx*7+1,cy*3+5)*pool.length)|0];ctx.globalAlpha=Math.min(.24,.035+m*.22);ctx.fillStyle=INK;ctx.fillText(glyph,cx*CELL_W,y);moist[i]*=DECAY}}ctx.globalAlpha=1};
  let raf=0;
  const wake=()=>{if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(frame)};
  const suspend=()=>{if(raf)cancelAnimationFrame(raf);raf=0};
  const sync=()=>{if(visible&&!document.hidden){prev=performance.now();wake()}else suspend()};
  const frame=now=>{raf=0;if(document.hidden||!visible)return;const dt=Math.min((now-prev)/1000,.05);prev=now;boost+=(1-boost)*Math.min(dt*1.6,1);if(dirty&&now-lastObst>160){buildObstacles();lastObst=now}step(dt,now);render();wake()};
  graph.addEventListener('pointermove',e=>{if(!matchMedia('(hover:hover) and (pointer:fine)').matches)return;const r=graph.getBoundingClientRect();mx=e.clientX-r.left;my=e.clientY-r.top},{passive:true});graph.addEventListener('pointerleave',()=>{mx=-1e4;my=-1e4},{passive:true});
  addEventListener('scroll',()=>{if(!visible)return;const dy=scrollY-lastScroll;lastScroll=scrollY;boost=Math.min(3.2,boost+Math.abs(dy)/90);pendingShift+=dy;const rows=Math.trunc(pendingShift/CELL_H);if(rows){pendingShift-=rows*CELL_H;shiftRows(moist,rows)}},{passive:true});
  new ResizeObserver(()=>{resize();dirty=true}).observe(graph);new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);if(visible)dirty=true;sync()},{threshold:.02}).observe(graph);addEventListener('resize',()=>{resize();dirty=true},{passive:true});
  document.addEventListener('visibilitychange',sync);
  resize();wake();
})();
