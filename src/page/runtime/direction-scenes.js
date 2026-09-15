
/* Approved direction-card scenes transferred from direction-lab.html.
   Main-page wording and links stay in the markup above. */
(() => {
  const cards=[...document.querySelectorAll('.ecosystem-direction-card')], reduced=false;
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t,ease=t=>t*t*(3-2*t),TAU=Math.PI*2;
  /* Exact paths selected in the open Pencil file: Vector 5 is the head contour;
     Vector 6 is the single eye.  They are used verbatim, only scaled to canvas. */
  const PENCIL_HEAD_PATH='M12.41606 31.43814c0.09729-0.47597 0.47041-1.20313 0.97727-1.92382 0.70139-0.99728 0.76943-2.29175 0.67236-3.65143-0.0326-0.4566-0.04475-1.14549-0.00817-1.57835 0.05078-0.60099 1.3704-1.68799 3.29158-3.33357 1.23474-1.05761 2.08421-2.45635 3.08998-4.22079 1.02286-1.79442 1.03368-4.63736 0.95379-7.40904-0.07841-2.72007-1.5825-4.70753-2.2985-5.51887-0.79469-0.90051-2.013-1.84969-4.60502-3.14479-2.82769-1.41285-6.38564-0.22694-8.33673 0.56604-3.62349 1.47269-4.33564 3.21859-5.27527 4.8625-0.79561 1.39195-0.78962 4.88005-0.87667 8.62346m8.58124 7.34043c-0.21921-0.37044-1.67968-0.93672-3.97149-2.4312m4.71453 8.57087c-0.3878-0.18725 0.46773-4.09362-0.74304-6.13967m1.32929 6.19054c-0.19396 0.04766-0.39772 0.04017-0.58625-0.05087m1.50218-0.97169c-0.21425 0.4774-0.51154 0.92319-0.91593 1.02256m0.83586-4.01157c0.0786 0.8235 0.48878 2.0783 0.08007 2.98901m0.19683-3.2744c-0.12167-0.03014-0.29408 0.10541-0.2769 0.28539m1.13577 6.43315c-0.22668-2.43315-0.08244-6.5262-0.85887-6.71854m1.05226 7.31023c-0.10614-0.13275-0.16962-0.33662-0.19339-0.59169m0.62888 0.74013c-0.15907 0.03651-0.32935-0.01569-0.43549-0.14844m0.85214-0.26572c-0.11486 0.25083-0.25757 0.37764-0.41665 0.41416m0.84668-1.71903c-0.2325 0.68302-0.31518 1.05404-0.43003 1.30487m-8.31794-11.36929c-1.56866-1.02291-4.66297-2.62049-4.60975-4.90923';
  const PENCIL_EYE_PATH='M1.42689 0.24579c-0.22989 0.05947-0.90463 0.58694-1.25544 1.21631-0.14232 0.25532-0.15131 0.55165-0.16943 0.8884-0.02484 0.46165 0.18121 0.9181 0.52598 1.23868 0.61529 0.57213 1.84802 0.5973 2.77705 0.52275 0.7351-0.05899 1.16887-0.82105 1.52099-1.40037 0.18104-0.29785 0.17286-0.89485 0.1428-1.55514-0.018-0.39552-0.29593-0.61586-0.63538-0.83248-0.45773-0.21977-1.01763-0.34914-1.65135-0.31982-0.339 0.04552-0.71334 0.15323-1.14158 0.2642';
  const pencilHeadPath=new Path2D(PENCIL_HEAD_PATH),pencilEyePath=new Path2D(PENCIL_EYE_PATH);
  /* Keep the exact Pencil curves, but expose their actual control points so a
     cursor can deform the face instead of only moving a static Path2D around. */
  const parsePencilCurves=path=>{const tokens=path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi)||[];let i=0,cmd='',x=0,y=0,ops=[];const isNum=()=>i<tokens.length&&!/^[a-zA-Z]$/.test(tokens[i]),num=()=>Number(tokens[i++]);while(i<tokens.length){if(/^[a-zA-Z]$/.test(tokens[i]))cmd=tokens[i++];const rel=cmd===cmd.toLowerCase(),kind=cmd.toLowerCase();if(kind==='m'){let first=true;while(isNum()){const a=num(),b=num();x=rel?x+a:a;y=rel?y+b:b;ops.push({k:first?'M':'L',x,y});first=false}}else if(kind==='c'){while(isNum()){const a=num(),b=num(),d=num(),e=num(),f=num(),g=num(),x1=rel?x+a:a,y1=rel?y+b:b,x2=rel?x+d:d,y2=rel?y+e:e,ex=rel?x+f:f,ey=rel?y+g:g;ops.push({k:'C',x1,y1,x2,y2,x:ex,y:ey});x=ex;y=ey}}else break}return ops};
  const pencilHeadCurves=parsePencilCurves(PENCIL_HEAD_PATH);
  const traceCurves=(c,ops,map)=>{c.beginPath();ops.forEach(op=>{if(op.k==='M'){const p=map(op.x,op.y);c.moveTo(p.x,p.y)}else if(op.k==='L'){const p=map(op.x,op.y);c.lineTo(p.x,p.y)}else{const a=map(op.x1,op.y1),b=map(op.x2,op.y2),d=map(op.x,op.y);c.bezierCurveTo(a.x,a.y,b.x,b.y,d.x,d.y)}})};
  const seeded=seed=>{let n=seed>>>0;return()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296)};
  const states=cards.map((card,i)=>{
    const cv=card.querySelector('canvas'),c=cv.getContext('2d',{alpha:false,desynchronized:true});
    let w=1,h=1,dpr=1,px=.62,py=.45,tx=.62,ty=.45,inside=false,visible=true;
    const random=seeded(7703+i*809);
    const state={card,c,w:()=>w,h:()=>h,px:()=>px,py:()=>py,inside:()=>inside,visible:()=>visible,kind:i,trace:[],imprints:[],pulse:0,mode:0,rings:[],discoveries:[],crew:0,engage:0,formation:0,retreating:false,cells:Array.from({length:46},(_,n)=>({angle:random()*TAU,radius:.12+random()*.34,speed:.45+random()*.85,size:n%9===0?8:3+random()*4,phase:random()*TAU,kind:n%4})),fragments:Array.from({length:78},(_,n)=>({x:random(),y:random(),angle:random()*TAU,len:5+random()*22,phase:random()*TAU,bright:n%11===0})),fibers:Array.from({length:26},(_,n)=>({y:.1+random()*.78,amp:.022+random()*.075,wave:1.05+random()*2.25,phase:random()*TAU,speed:.42+random()*.82,group:n%5,detail:(n%4)-1.5,accent:n%9===0})),signals:Array.from({length:112},(_,n)=>({lane:n%6,phase:random(),speed:.42+random()*.8,length:4+random()*16,weight:n%13===0?2:1,tone:n%9===0?'#bf0909':n%4===0?'#6B7280':'#1F2937'})),walkers:Array.from({length:10},(_,n)=>({phase:random(),speed:.44+random()*.72,lane:.18+random()*.42,homeX:.16+random()*.38,homeY:.17+random()*.46,curve:(random()-.5)*.16,size:.72+random()*.58,step:random()*TAU,travel:-n*.045,delay:n*.045,direction:1,exited:false,selected:false,leader:n===2||n===7}))};
    const sceneEl=card.querySelector('.direction-scene')||card;   /* текст снаружи — сцена меряется по своей коробке */
    const hoverArea=matchMedia('(min-width:961px)').matches?(card.closest('.ecosystem-direction-branch')||card):card;
    const resize=()=>{const r=sceneEl.getBoundingClientRect();w=Math.max(1,r.width);h=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,2);cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);c.setTransform(dpr,0,0,dpr,0,0)};
    new ResizeObserver(resize).observe(sceneEl);addEventListener('load',resize);resize();   /* коробка сцены меняется после поздних стилей — меряем её, а не карточку */
    const p=e=>{const r=sceneEl.getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width),y:clamp((e.clientY-r.top)/r.height)}};
    const record=q=>{if(i!==0)return;state.trace.push({x:q.x,y:q.y,a:1});if(state.trace.length>72)state.trace.shift()};
    hoverArea.addEventListener('pointerenter',e=>{inside=true;const q=p(e);tx=q.x;ty=q.y;record(q);if(i===3){state.crew=0;state.mode=0;state.retreating=false;state.walkers.forEach(d=>{d.travel=-d.delay;d.direction=1;d.exited=false;d.selected=false})}});
    hoverArea.addEventListener('pointermove',e=>{const q=p(e);tx=q.x;ty=q.y;record(q)},{passive:true});
    hoverArea.addEventListener('pointerleave',()=>{inside=false;if(i===3){state.mode=0;state.retreating=true;state.walkers.forEach(d=>d.direction=-1)}});
    card.addEventListener('pointerdown',e=>{const q=p(e);tx=q.x;ty=q.y;record(q);if(i===1){state.mode++;state.rings.push({x:q.x,y:q.y,age:0});if(state.rings.length>3)state.rings.shift()}if(i===2){state.mode++;state.discoveries.push({x:q.x,y:q.y,age:0});if(state.discoveries.length>3)state.discoveries.shift()}if(i===3){state.mode=(state.mode+1)%2;if(state.mode===1)state.walkers.forEach(d=>d.selected=d.travel>=0&&!d.exited);state.pulse=1}if(i===0){state.imprints.push({x:q.x,y:q.y,age:0});if(state.imprints.length>4)state.imprints.shift();state.pulse=1}},{passive:true});
    new IntersectionObserver(es=>{visible=es.some(e=>e.isIntersecting);if(visible){safeDraw(state,performance.now(),0);wakeDirections();}},{threshold:.02}).observe(card);
    state.step=()=>{if(!inside){tx=.62;ty=.45}px=mix(px,tx,.07);py=mix(py,ty,.07);state.engage=mix(state.engage,inside?1:0,.055);if(i===3){const moving=inside||state.retreating;state.crew=mix(state.crew,moving?1:0,.065);state.formation=mix(state.formation,inside&&state.mode?1:0,.042);if(!state.mode&&state.formation<.012)state.walkers.forEach(d=>d.selected=false);if(moving)state.walkers.forEach(d=>{if(d.exited)return;const velocity=.018*d.speed*(1+state.pulse*.22);if(state.retreating){d.travel-=velocity;if(d.travel<-d.delay){d.travel=-d.delay;d.exited=true}}else d.travel=Math.min(.98,d.travel+velocity)});if(state.retreating&&state.walkers.every(d=>d.exited)){state.retreating=false;state.crew=0}}};
    return state;
  });
  function bg(s){const{c}=s,w=s.w(),h=s.h();c.fillStyle='#111210';c.fillRect(0,0,w,h)}
  function learning(s,t){
    const{c}=s,w=s.w(),h=s.h(),mx=s.px()*w,my=s.py()*h;
    c.fillStyle='#101110';c.fillRect(0,0,w,h);c.lineJoin='round';c.lineCap='round';
    /* Exact motion law of the accepted earlier direction: four imperfect rehearsals
       gather into one personal line; the user's gesture and a click remain visible. */
    const restPoint=(u,pass)=>{const q=u*TAU,cx=w*.67,cy=h*.49,rx=w*(.185-pass*.009),ry=h*(.27-pass*.012),drift=Math.sin(q*2+pass*1.7)*w*.028+Math.sin(q*4.2-pass)*w*.012;return{x:cx+Math.cos(q)*rx+drift,y:cy+Math.sin(q)*ry*(.72+.13*Math.cos(q*3+pass))}};
    const markPoint=(u,pass)=>{let{x,y}=restPoint(u,pass);const d=Math.hypot(x-mx,y-my),pull=s.inside()?ease(1-d/(w*.22)):0;x+=(mx-x)*pull*.12;y+=(my-y)*pull*.12;return{x,y,pull}};
    const strokePass=(pass,main)=>{c.beginPath();let hot=0;for(let i=0;i<=170;i++){const p=markPoint(i/170,pass);hot=Math.max(hot,p.pull);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)}c.strokeStyle=main?'rgba(239,238,229,.92)':`rgba(203,209,199,${.11+pass*.045})`;c.lineWidth=main?2.35:1.05;c.stroke();if(main&&hot>.02){c.strokeStyle=`rgba(191,9,9,${hot*.72})`;c.lineWidth=3.3;c.stroke()}};
    for(let pass=0;pass<4;pass++)strokePass(pass,false);strokePass(4,true);
    s.imprints.forEach(mark=>{mark.age+=.012;const fade=Math.max(.2,.92-mark.age*.04);c.beginPath();for(let i=0;i<=26;i++){const p=restPoint((mark.u-.105+i/26*.21+1)%1,4);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)}c.strokeStyle=`rgba(191,9,9,${fade})`;c.lineWidth=3.1;c.stroke();const p=restPoint(mark.u,4);c.fillStyle='#bf0909';c.fillRect(p.x-3,p.y-3,6,6)});
    s.imprints=s.imprints.filter(mark=>mark.age<18);
    s.trace.forEach(p=>p.a-=.018);while(s.trace[0]&&s.trace[0].a<=0)s.trace.shift();for(let i=1;i<s.trace.length;i++){const a=s.trace[i-1],b=s.trace[i];c.strokeStyle=`rgba(191,9,9,${b.a*.88})`;c.lineWidth=1.2+b.a*2.4;c.beginPath();c.moveTo(a.x*w,a.y*h);c.lineTo(b.x*w,b.y*h);c.stroke()}
    c.save();c.translate(mx,my);c.rotate(Math.atan2(my-h*.49, mx-w*.67));c.fillStyle='#bf0909';c.beginPath();c.moveTo(11,0);c.lineTo(-7,-5);c.lineTo(-7,5);c.closePath();c.fill();c.restore();c.lineCap='butt';
  }
  function learningLogo(s,t){
    const{c}=s,w=s.w(),h=s.h(),mx=s.px()*w,my=s.py()*h;
    c.fillStyle='#101110';c.fillRect(0,0,w,h);c.lineJoin='round';c.lineCap='round';
    /* Controlled logo comparison.  This is not a circle: a continuous human
       half shares one axis with a discretised agent half. Their eyes are
       intentionally different, like in the voxel version of the mark. */
    const cx=w*.67,cy=h*.47,rx=w*.184,ry=h*.278;
    const humanPoint=(u,pass)=>{const a=Math.PI*.5+u*Math.PI,rr=1-pass*.018,rawX=cx+Math.cos(a)*rx*rr,rawY=cy+Math.sin(a)*ry*rr,d=Math.hypot(rawX-mx,rawY-my),pull=s.inside()?ease(1-d/(w*.23)):0;return{x:rawX+(mx-rawX)*pull*.055,y:rawY+(my-rawY)*pull*.055,pull}};
    const humanPass=(pass,main)=>{c.beginPath();let hot=0;for(let i=0;i<=100;i++){const p=humanPoint(i/100,pass);hot=Math.max(hot,p.pull);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)}c.strokeStyle=main?'rgba(241,240,233,.98)':`rgba(203,209,199,${.09+pass*.04})`;c.lineWidth=main?3.4:1.05;c.stroke();if(main&&hot>.05){c.strokeStyle=`rgba(191,9,9,${hot*.55})`;c.lineWidth=4.5;c.stroke()}};
    for(let pass=0;pass<4;pass++)humanPass(pass,false);humanPass(4,true);
    /* central seam and the lower, slightly weighted "nose" of the sign */
    c.strokeStyle='#f1f0e9';c.lineWidth=2.25;c.beginPath();c.moveTo(cx,cy-ry*.985);c.lineTo(cx,cy+ry*1.01);c.bezierCurveTo(cx,cy+ry*1.16,cx-w*.006,cy+ry*1.22,cx-w*.004,cy+ry*1.30);c.stroke();
    /* Agent half: a real pixel field shaped as a half-oval, never an outline.
       Its cells pull apart locally under the cursor and re-form afterwards. */
    const cols=11,rows=17;for(let row=0;row<rows;row++){const yn=(row/(rows-1)-.5)*2;for(let col=0;col<cols;col++){const xn=col/(cols-1);if(xn*xn+yn*yn>1.04)continue;const bx=cx+xn*rx,by=cy+yn*ry,dx=bx-mx,dy=by-my,d=Math.max(1,Math.hypot(dx,dy)),force=s.inside()?ease(1-d/(w*.20)):0,drift=Math.sin(t*.0008+row*1.7+col*.9)*.9;const size=(col<2?2.1:2.7)+(row%4===0?.45:0);c.globalAlpha=.22+xn*.66+force*.12;c.fillStyle=force>.45?'#bf0909':'#f1f0e9';c.fillRect(bx+dx/d*force*7+drift-size*.5,by+dy/d*force*7-size*.5,size,size)}}c.globalAlpha=1;
    /* Different eyes: the human side is open; the agent side is a compact
       horizontal shutter embedded in its pixel field. */
    c.fillStyle='#f1f0e9';c.beginPath();c.arc(cx-rx*.48,cy,4.7,0,TAU);c.fill();c.fillRect(cx+rx*.38-5,cy-1,10,2);c.fillRect(cx+rx*.38-1,cy-3,2,6);
    s.imprints.forEach(mark=>{mark.age+=.012;const fade=Math.max(.12,.88-mark.age*.05),x=mark.x*w,y=mark.y*h;c.strokeStyle=`rgba(191,9,9,${fade})`;c.lineWidth=1.5;c.beginPath();c.arc(x,y,7+mark.age*3,0,TAU);c.stroke()});s.imprints=s.imprints.filter(mark=>mark.age<14);
    s.trace.forEach(p=>p.a-=.018);while(s.trace[0]&&s.trace[0].a<=0)s.trace.shift();for(let i=1;i<s.trace.length;i++){const a=s.trace[i-1],b=s.trace[i];c.strokeStyle=`rgba(191,9,9,${b.a*.54})`;c.lineWidth=1.1+b.a*1.8;c.beginPath();c.moveTo(a.x*w,a.y*h);c.lineTo(b.x*w,b.y*h);c.stroke()}c.lineCap='butt';
  }
  function learningHead(s,t){
    const{c}=s,w=s.w(),h=s.h(),mx=s.px()*w,my=s.py()*h;
    c.fillStyle='#101110';c.fillRect(0,0,w,h);c.lineCap='round';c.lineJoin='round';
    /* The accepted rehearsal field returns first: several former routes stay
       quiet behind the learner instead of resetting when the cursor leaves. */
    const active=s.engage,routePoint=(u,pass)=>{const q=u*TAU,rawX=w*.34+Math.cos(q)*w*(.20-pass*.009)+Math.sin(q*2+pass)*w*.024+Math.sin(q*4.2-pass)*w*.01,rawY=h*.45+Math.sin(q)*h*(.225-pass*.011)*(.72+.13*Math.cos(q*3+pass)),d=Math.hypot(rawX-mx,rawY-my),pull=active*ease(1-d/(w*.22));return{x:rawX+(mx-rawX)*pull*.12,y:rawY+(my-rawY)*pull*.12,pull}};
    const trail=(pass,main)=>{c.beginPath();for(let i=0;i<=132;i++){const p=routePoint(i/132,pass);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)}c.strokeStyle=main?'rgba(241,240,233,.38)':`rgba(203,209,199,${.055+pass*.009})`;c.lineWidth=main?.82:.46;c.stroke()};for(let pass=0;pass<10;pass++)trail(pass,false);trail(10,true);
    /* The Pencil head stays a recognisable body, not a static logo. It moves
       within the field with a soft lag; the one eye looks where the learner is
       going, while the lime pointer remains the navigation instrument. */
    const faceX=clamp(s.px(),.16,.50),faceY=clamp(s.py(),.15,.58),headX=mix(w*.34,faceX*w,active*.54+.035*(1-active)),headY=mix(h*.39,faceY*h,active*.48+.035*(1-active)),scale=Math.min(w*.348/24,h*.684/31),headW=24*scale,headH=31*scale;
    /* The face itself is now a deformable pencil curve: the cursor pulls its
       control geometry, so it can melt, stretch and settle into new states. */
    const deform=(x,y,variant=0,amount=1)=>{const nx=(x-12)/12,ny=(y-15)/15,gx=12+(faceX-.67)*30,gy=15+(faceY-.36)*34,dx=x-gx,dy=y-gy,pull=Math.exp(-(dx*dx+dy*dy)/52),phase=t*.00155+variant*1.91,energy=amount*(.18+active*.82),waveX=Math.sin(phase+y*.47+nx*1.7),waveY=Math.cos(phase*1.16+x*.41-ny*1.4),dragX=(faceX-.67)*17,dragY=(faceY-.36)*19;return{x:x+energy*(waveX*(.65+pull*5.5)+dragX*pull+ny*variant*.44),y:y+energy*(waveY*(.8+pull*5.1)+dragY*pull+nx*variant*.52)}};
    c.save();c.translate(headX-headW*.5,headY-headH*.46);c.scale(scale,scale);for(let pass=0;pass<7;pass++){const offset=pass-3;c.save();c.translate(offset*1.15+Math.sin(t*.00042+pass)*.55,offset*.58+Math.cos(t*.00036+pass)*.42);c.strokeStyle=`rgba(203,209,199,${.042+Math.abs(offset)*.012})`;c.lineWidth=.18;traceCurves(c,pencilHeadCurves,(x,y)=>deform(x,y,offset*.82,.42+Math.abs(offset)*.085));c.stroke();c.restore()}c.strokeStyle=`rgba(241,240,233,${1-active*.88})`;c.lineWidth=.46;traceCurves(c,pencilHeadCurves,(x,y)=>deform(x,y,0,active));c.stroke();if(active>.01){c.strokeStyle=`rgba(191,9,9,${active})`;c.lineWidth=.58;traceCurves(c,pencilHeadCurves,(x,y)=>deform(x,y,0,1));c.stroke()}
    const eyeBase=deform(3.63,8.74,0,active),eyeDX=(mx-headX)/Math.max(1,w)*1.7*active,eyeDY=(my-headY)/Math.max(1,h)*1.35*active;c.save();c.translate(eyeBase.x+eyeDX,eyeBase.y+eyeDY);c.rotate(-Math.PI/6);c.strokeStyle='#f1f0e9';c.lineWidth=.52;c.stroke(pencilEyePath);c.restore();c.restore();
    /* Prior interactions are retained as small route markers, never as UI. */
    s.imprints.forEach(mark=>{mark.age+=.012;const fade=Math.max(.12,.86-mark.age*.055),x=mark.x*w,y=mark.y*h;c.strokeStyle=`rgba(191,9,9,${fade})`;c.lineWidth=1.25;c.beginPath();c.arc(x,y,6+mark.age*3,0,TAU);c.stroke()});s.imprints=s.imprints.filter(mark=>mark.age<13);
    s.trace.forEach(p=>p.a-=.018);while(s.trace[0]&&s.trace[0].a<=0)s.trace.shift();for(let i=1;i<s.trace.length;i++){const a=s.trace[i-1],b=s.trace[i];c.strokeStyle=`rgba(191,9,9,${b.a*.82})`;c.lineWidth=1.2+b.a*2.15;c.beginPath();c.moveTo(a.x*w,a.y*h);c.lineTo(b.x*w,b.y*h);c.stroke()}
    const restArrowX=headX+headW*.08+4,restArrowY=headY-headH*.09-4,targetAngle=Math.atan2(my-h*.45,mx-w*.34),arrowX=mix(restArrowX,mx,active),arrowY=mix(restArrowY,my,active),restAngle=.063,arrowAngle=mix(restAngle,targetAngle,active);c.save();c.translate(arrowX,arrowY);c.rotate(arrowAngle);c.fillStyle='#bf0909';c.beginPath();c.moveTo(13,0);c.lineTo(-8,-4.7);c.lineTo(-8,4.7);c.closePath();c.fill();c.restore();c.lineCap='butt';c.lineJoin='miter';
  }
  function platform(s,t,dt){
    const{c}=s,w=s.w(),h=s.h(),mx=s.px()*w,my=s.py()*h,cx=w*.51,cy=h*.44;
    c.fillStyle='#eaf1f3';c.fillRect(0,0,w,h);
    /* Directly transferred from the established {space} field: every item has
       its own orbit, two local relations and a local response to the visitor. */
    const positions=s.cells.map((cell,i)=>{const breath=1+Math.sin(t*.0011+cell.phase)*(.06+s.rings.length*.025),a=cell.angle+Math.sin(t*.00025*cell.speed+cell.phase)*.28;let x=cx+Math.cos(a)*cell.radius*w*breath,y=cy+Math.sin(a*1.13)*cell.radius*h*1.18*breath;const dx=x-mx,dy=y-my,d=Math.max(1,Math.hypot(dx,dy));if(s.inside()&&d<125){const force=(1-d/125)*(s.mode%2?-24:18);x+=dx/d*force;y+=dy/d*force}return{x,y,cell,i}});
    positions.forEach((from,i)=>{const nearest=positions.map((to,j)=>({to,j,d:Math.hypot(to.x-from.x,to.y-from.y)})).filter(v=>v.j!==i).sort((a,b)=>a.d-b.d).slice(0,2);nearest.forEach(({to,j,d})=>{if(j<i||d>Math.min(w,h)*.38)return;const hot=s.inside()&&Math.min(Math.hypot(from.x-mx,from.y-my),Math.hypot(to.x-mx,to.y-my))<100;c.strokeStyle=hot?'rgba(14,138,160,.9)':`rgba(${i%4?107:14},${i%4?114:138},${i%4?128:160},.38)`;c.lineWidth=hot?1.7:1;c.beginPath();c.moveTo(from.x,from.y);c.quadraticCurveTo((from.x+to.x)/2+Math.sin(i)*12,(from.y+to.y)/2+Math.cos(j)*12,to.x,to.y);c.stroke()})});
    positions.forEach(({x,y,cell,i})=>{const color=i%7===0?'#bf0909':i%4===0?'#6B7280':'#0E8AA0',size=cell.size*(1+s.rings.length*.08);c.fillStyle=color;if(cell.kind===0)c.fillRect(x-size,y-size,size*2,size*2);else if(cell.kind===1){c.strokeStyle=color;c.lineWidth=1.3;c.strokeRect(x-size,y-size,size*2,size*2)}else{c.beginPath();c.arc(x,y,size,0,TAU);cell.kind===2?c.fill():c.stroke()}});
    s.rings.forEach(r=>r.age+=dt*.001);s.rings=s.rings.filter(r=>r.age<1.45);s.rings.forEach(r=>{const q=r.age/1.45;c.strokeStyle=`rgba(191,9,9,${(1-q)*.85})`;c.lineWidth=2;c.beginPath();c.arc(r.x*w,r.y*h,q*Math.min(w,h)*.62,0,TAU);c.stroke()});
  }
  function research(s,t,dt){
    const{c}=s,w=s.w(),h=s.h(),mx=s.px()*w,my=s.py()*h,r=Math.min(w,h)*.32;
    // The lens follows the visitor freely in both axes. Its light interior
    // keeps the factual title legible when it passes behind the text.
    const ly=my;
    c.fillStyle='#ffffff';c.fillRect(0,0,w,h);c.lineCap='round';c.lineJoin='round';
    /* The exterior is one moving sample. Inside the lens only its nearest
       fibres remain; they grow, split and scatter, but meet their source again
       at the exact rim of the instrument. */
    const fibreY=(f,u)=>h*(f.y+Math.sin(u*TAU*f.wave+t*.00038*f.speed+f.phase)*f.amp+Math.sin(u*TAU*(f.wave*.43)+t*.00023+f.phase*.6)*.018);
    const drawRaw=(f,i)=>{c.beginPath();for(let n=0;n<=76;n++){const u=n/76,x=(-.08+u*1.16)*w,y=fibreY(f,u);n?c.lineTo(x,y):c.moveTo(x,y)}c.strokeStyle=f.accent?'rgba(112,25,40,.82)':`rgba(158,23,39,${.22+(i%5)*.035})`;c.lineWidth=f.accent?1.45:.74+(i%3)*.14;c.stroke()};
    s.fibers.forEach(drawRaw);
    const focusU=clamp(mx/w),closest=[...s.fibers].sort((a,b)=>Math.abs(fibreY(a,focusU)-ly)-Math.abs(fibreY(b,focusU)-ly)).slice(0,9),explosion=.58+(s.mode%2)*.34+Math.sin(focusU*TAU*1.7+ly/h*2.2)*.1;
    c.save();c.beginPath();c.arc(mx,ly,r,0,TAU);c.clip();c.fillStyle='rgba(249,249,245,.94)';c.fillRect(mx-r,ly-r,r*2,r*2);
    closest.forEach((f,i)=>{
      const direction=(i-(closest.length-1)/2)/Math.max(1,closest.length-1),phase=Math.sin(t*.0011+i*1.87)*r*.035;
      const point=q=>{const u=clamp(focusU+q*r/w),x=mx+q*r,raw=fibreY(f,u),pull=ease(1-Math.min(1,Math.abs(q))),zoomed=ly+(raw-ly)*(1+pull*3.6),spread=direction*r*(.12+explosion*.82)*pull+phase*pull;return{x,y:mix(raw,zoomed+spread,pull)}};
      const base=f.accent?1.28:i%4===0?1.05:.88;
      c.strokeStyle=f.accent?'#bf0909':i%4===0?'#9E1727':'rgba(191,9,9,.9)';
      for(let n=1;n<=68;n++){
        const a=point(-1.07+(n-1)/68*2.14),b=point(-1.07+n/68*2.14),centre=ease(1-Math.min(1,Math.abs((a.x+b.x)*.5-mx)/r));
        if(centre>.18&&i%2===0){const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy)),offset=(.38+centre*1.9)*(i%3+1)/3;c.strokeStyle='rgba(112,25,40,.52)';c.lineWidth=Math.max(.32,base*.34);for(const side of[-1,1]){const ox=-dy/len*offset*side,oy=dx/len*offset*side;c.beginPath();c.moveTo(a.x+ox,a.y+oy);c.lineTo(b.x+ox,b.y+oy);c.stroke()}c.strokeStyle=f.accent?'#bf0909':i%4===0?'#9E1727':'rgba(191,9,9,.9)'}
        c.lineWidth=base*(1+centre*3);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
      }
    });
    c.restore();
    s.discoveries.forEach(d=>{d.age+=dt*.001;const a=Math.max(0,1-d.age/11),x=d.x*w,y=d.y*h,rr=Math.min(w,h)*.075;if(!a)return;c.strokeStyle=`rgba(158,23,39,${a*.62})`;c.lineWidth=1.4;c.strokeRect(x-rr,y-rr,rr*2,rr*2);c.fillStyle=`rgba(191,9,9,${a*.8})`;c.fillRect(x-2,y-2,4,4)});s.discoveries=s.discoveries.filter(d=>d.age<11);
    c.strokeStyle='#111210';c.lineWidth=1.8;c.beginPath();c.arc(mx,ly,r,0,TAU);c.stroke();
    c.strokeStyle='rgba(158,23,39,.58)';c.lineWidth=.9;c.setLineDash([2,3]);c.beginPath();c.arc(mx,ly,Math.max(0,r-5),Math.PI*.12,Math.PI*.88);c.stroke();c.setLineDash([]);c.fillStyle='#9E1727';c.fillRect(mx-3,ly-3,6,6);c.lineCap='butt';
  }
  function consulting(s,t){
    const{c}=s,w=s.w(),h=s.h(),mx=s.px()*w,my=s.py()*h;
    c.fillStyle='#eaf1f3';c.fillRect(0,0,w,h);c.lineCap='round';c.lineJoin='round';
    const near=s.inside()?s.crew:0,guideX=w*.78,guideY=h*.43,visibleCrew=s.crew,formation=s.formation;
    /* A small recurring crew comes in from the left. The cursor bends their
       route; a click sends a concentrated burst toward the receiving hand. */
    const walker=(x,y,z,phase,leader,direction)=>{const bob=Math.sin(phase)*z*.044;c.save();c.translate(x,y+bob);c.scale(direction,1);c.fillStyle='#1F2937';c.beginPath();c.ellipse(-z*.06,0,z*.52,z*.29,-.11,0,TAU);c.fill();c.strokeStyle='#1F2937';c.lineWidth=Math.max(.85,z*.12);for(const a of[-.55,0,.55]){c.beginPath();c.moveTo(z*.05,-z*.05);c.quadraticCurveTo(z*(.20+a*.18),-z*(.76-Math.abs(a)*.1),z*(.38+a*.25),-z*(.82-Math.abs(a)*.2));c.stroke()}c.lineWidth=Math.max(.7,z*.09);for(const a of[-.24,.26]){c.beginPath();c.moveTo(-z*.08,z*.15);c.lineTo(z*(.03+a),z*.48+Math.sin(phase+a*6)*z*.016);c.stroke()}if(leader){c.fillStyle='#bf0909';c.fillRect(z*.13,-z*.16,z*.18,z*.18)}c.restore()};
    const crew=[];s.walkers.forEach((d,n)=>{const rawQ=d.travel;if(rawQ<0||rawQ>1||d.exited||visibleCrew<.015)return;const q=ease(rawQ),baseX=mix(-w*.09,w*d.homeX,q),baseY=mix(h*d.lane,h*d.homeY,q)+Math.sin(q*Math.PI)*h*d.curve,focus=near*ease(1-Math.abs(q-.52)/.42),marchX=baseX+(mx-baseX)*focus*.15,marchY=baseY+(my-baseY)*focus*.44,ringA=n/Math.max(1,s.walkers.length)*TAU+t*.00022*d.speed,ringR=Math.min(w,h)*(.125+Math.sin(d.step)*.018),memberFormation=d.selected?formation:0,x=mix(marchX,mx+Math.cos(ringA)*ringR,memberFormation),y=mix(marchY,my+Math.sin(ringA)*ringR,memberFormation),z=w*(.031+d.size*.024);crew.push({x,y,z,focus,d,n,memberFormation});walker(x,y,z,t*.010*d.speed+d.step,d.leader,d.direction)});
    if(near&&crew.length){const close=crew.map(v=>({...v,d:Math.hypot(v.x-mx,v.y-my)})).filter(v=>v.d<w*.29).sort((a,b)=>a.d-b.d).slice(0,4);if(close.length>1){c.strokeStyle=`rgba(191,9,9,${.55*(1-formation*.35)})`;c.lineWidth=1.1;c.setLineDash([2,3]);c.beginPath();c.moveTo(close[0].x,close[0].y);close.slice(1).forEach(v=>c.lineTo(v.x,v.y));c.stroke();c.setLineDash([]);c.strokeStyle=`rgba(191,9,9,${.44*(1-formation*.25)})`;c.lineWidth=.9;c.beginPath();c.arc(mx,my,Math.min(w,h)*.055,0,TAU);c.stroke()}if(formation>.02&&crew.some(v=>v.d.selected)){c.strokeStyle=`rgba(191,9,9,${formation*.62})`;c.lineWidth=1.15;c.setLineDash([3,3]);c.beginPath();c.arc(mx,my,Math.min(w,h)*.125,0,TAU);c.stroke();c.setLineDash([])}}
    const targetX=Math.max(w*.64,Math.min(w*.91,mx)),targetY=Math.max(h*.16,Math.min(h*.47,my)),driftX=(targetX-guideX)*.10*near,driftY=(targetY-guideY)*.07*near,lift=(Math.sin(t*.0007)*.5+.5)*h*.012*(1-near)+s.pulse*h*.018;
    /* Same silhouette as the walkers, enlarged by 15% so it reads as the
       receiving figure rather than another ornamental line. */
    c.save();c.translate(driftX,lift+driftY);c.translate(guideX,guideY);c.scale(1.15,1.15);c.translate(-guideX,-guideY);
    c.strokeStyle='#1F2937';c.lineWidth=Math.max(28,w*.115);c.beginPath();c.moveTo(w*1.09,h*.62);c.bezierCurveTo(w*.95,h*.59,w*.86,h*.55,w*.77,h*.53);c.stroke();
    c.fillStyle='#1F2937';c.beginPath();c.moveTo(w*.51,h*.57);c.bezierCurveTo(w*.57,h*.46,w*.67,h*.40,w*.78,h*.42);c.bezierCurveTo(w*.87,h*.44,w*.91,h*.51,w*.89,h*.58);c.bezierCurveTo(w*.85,h*.65,w*.74,h*.67,w*.64,h*.65);c.bezierCurveTo(w*.57,h*.63,w*.54,h*.60,w*.51,h*.57);c.fill();
    c.strokeStyle='#1F2937';c.lineWidth=Math.max(14,w*.052);c.beginPath();c.moveTo(w*.66,h*.48);c.quadraticCurveTo(w*.66,h*.27,w*.69,h*.20);c.moveTo(w*.75,h*.48);c.quadraticCurveTo(w*.77,h*.23,w*.81,h*.17);c.moveTo(w*.82,h*.50);c.quadraticCurveTo(w*.87,h*.31,w*.90,h*.27);c.stroke();c.restore();
    const carriedX=guideX+w*.002+driftX,carriedY=h*.34+lift+driftY;
    c.fillStyle='rgba(191,9,9,.18)';c.fillRect(carriedX-w*.085,carriedY+h*.056,w*.17,h*.045);c.fillStyle='#bf0909';c.fillRect(carriedX-w*.025,carriedY-w*.025,w*.05,w*.05);c.fillStyle='#f4f4ef';c.fillRect(carriedX-w*.008,carriedY-w*.008,w*.016,w*.016);
    if(s.pulse>0){s.pulse=Math.max(0,s.pulse-.006);const q=1-s.pulse;c.strokeStyle=`rgba(191,9,9,${s.pulse*.7})`;c.lineWidth=1.5;c.beginPath();c.arc(mx,my,w*(.045+q*.20),0,TAU);c.stroke()}c.lineCap='butt';c.lineJoin='miter';
  }
  let previous=performance.now();const draw=(s,t,dt)=>{s.step();if(s.kind===0)learningHead(s,t);else if(s.kind===1)platform(s,t,dt);else if(s.kind===2)research(s,t,dt);else consulting(s,t)};
  /* Одно исключение внутри draw раньше останавливало общий rAF-цикл, и все
     четыре сцены застывали пустыми. Кадр каждой сцены теперь изолирован, а
     вырожденный размер канваса (карточка ещё не разложена) просто пропускаем:
     именно он давал arc() с отрицательным радиусом. */
  function safeDraw(s,t,dt){if(!s.visible())return;if(s.w()<24||s.h()<24)return;try{draw(s,t,dt)}catch(err){if(!safeDraw.warned){safeDraw.warned=true;console.warn('direction scene frame skipped',err)}}}
  let running=false;
  function wakeDirections(){if(!running&&!document.hidden&&states.some(s=>s.visible())){running=true;previous=performance.now();requestAnimationFrame(frame);}}
  function frame(t){if(document.hidden||!states.some(s=>s.visible())){running=false;return;}const dt=Math.min(34,t-previous||16);previous=t;states.forEach(s=>safeDraw(s,t,dt));if(!reduced)requestAnimationFrame(frame);else running=false;}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)wakeDirections();});
  wakeDirections();
})();
