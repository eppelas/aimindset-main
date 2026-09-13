
/* Measured optical punctuation and decorative native-hyphen marks. Authored text and native hyphens:auto remain intact; runtime nodes are removed for editing and serialization. */
(function(){
  // Use measured fallback consistently: CSS.supports does not prove optical alignment.
  var SEL='main .lead, #approach>.approach-context>p, #manifesto .manifesto-rest>p', PUNCT=/[,.;:!?»)…]/;
  function unwrap(el){ el.querySelectorAll('.hang-native-mark').forEach(function(mark){mark.remove();}); el.classList.remove('hang-native'); [].slice.call(el.querySelectorAll('span.hang')).forEach(function(sp){ sp.replaceWith(document.createTextNode(sp.textContent)); }); el.normalize(); }
  function nextText(tn,root){ var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null); w.currentNode=tn; var x; while((x=w.nextNode())){ if(/\S/.test(x.nodeValue)) return x; } return null; }
  function hang(el){
    unwrap(el);
    if(el.isContentEditable || getComputedStyle(el).textAlign!=='justify') return;
    if(window.CSS && CSS.supports('hyphenate-character','""')) el.classList.add('hang-native');
    var walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null), nodes=[], n; while((n=walker.nextNode())) nodes.push(n);
    var r=document.createRange();
    for(var k=nodes.length-1;k>=0;k--){ var tn=nodes[k], txt=tn.nodeValue;
      for(var i=txt.length-1;i>=0;i--){ if(!PUNCT.test(txt.charAt(i))) continue;
        if(i+1<txt.length && !/\s/.test(txt.charAt(i+1))) continue;
        var first=i; while(first>0 && PUNCT.test(txt.charAt(first-1))) first--;
        r.setStart(tn,first); r.setEnd(tn,i+1); var rc=r.getClientRects()[0]; if(!rc||!rc.width) continue;
        var j=i+1; while(j<txt.length && /\s/.test(txt.charAt(j))) j++;
        var last=false, rn=null;
        if(j<txt.length){ r.setStart(tn,j); r.setEnd(tn,j+1); rn=r.getClientRects()[0]; last=!!rn && rn.top>rc.top+2; }
        else { var nx=nextText(tn,el); if(nx){ var ni=/\S/.exec(nx.nodeValue).index; r.setStart(nx,ni); r.setEnd(nx,ni+1); rn=r.getClientRects()[0]; last=!!rn && rn.top>rc.top+2; } }
        if(!last) continue;
        r.setStart(tn,first); r.setEnd(tn,i+1); var sp=document.createElement('span'); sp.className='hang'; sp.style.setProperty('--hang-width', -rc.width + 'px');
        try{ r.surroundContents(sp); }catch(e){}
        i=first;
      } }
  }
  /* после выноса строка может подтянуть следующее слово — тогда знак уже не последний: такой спан снимаем (без качелей) */
  function verify(el){ [].slice.call(el.querySelectorAll('span.hang')).forEach(function(sp){ var tn=sp.nextSibling; while(tn&&tn.nodeType===3&&!/\S/.test(tn.nodeValue)) tn=tn.nextSibling;
      if(!tn){ var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null); w.currentNode=sp.firstChild||sp; var x; while((x=w.nextNode())){ if(/\S/.test(x.nodeValue)&&!sp.contains(x)){ tn=x; break; } } }
      if(!tn) return; var r=document.createRange(); if(tn.nodeType===3){ var m=/\S/.exec(tn.nodeValue); r.setStart(tn,m?m.index:0); r.setEnd(tn,(m?m.index:0)+1); } else r.selectNode(tn);
      var rn=r.getClientRects()[0], rs=sp.getBoundingClientRect(); if(rn&&rn.top<=rs.top+2) sp.replaceWith(document.createTextNode(sp.textContent)); }); el.normalize(); }
  // Native dictionary and break positions remain browser-owned. Empty native glyph
  // frees the optical edge; decorative marks never enter copied or saved text.
  function nativeMarks(el){
    if(!el.classList.contains('hang-native')) return;
    var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null),n,chars=[],r=document.createRange();
    while((n=w.nextNode())) for(var i=0;i<n.length;i++) chars.push({node:n,i:i,char:n.data[i]});
    var box=el.getBoundingClientRect(), letter=/[A-Za-zА-Яа-яЁё]/;
    for(var j=1;j<chars.length;j++){
      var a=chars[j-1],b=chars[j]; if(!letter.test(a.char)||!letter.test(b.char)) continue;
      r.setStart(a.node,a.i);r.setEnd(a.node,a.i+1);var ar=r.getClientRects()[0];
      r.setStart(b.node,b.i);r.setEnd(b.node,b.i+1);var br=r.getClientRects()[0];
      if(!ar||!br||br.top<=ar.top+2) continue;
      r.setStart(a.node,a.i+1);r.setEnd(b.node,b.i);
      if(r.cloneContents().querySelector('br')) continue;
      var style=getComputedStyle(a.node.parentElement), mark=document.createElement('span');
      mark.className='hang-native-mark';mark.setAttribute('aria-hidden','true');mark.setAttribute('data-editor-runtime','');
      mark.style.left=(ar.right-box.left-el.clientLeft)+'px';mark.style.top=(ar.top-box.top-el.clientTop)+'px';
      mark.style.font=style.font;mark.style.lineHeight=ar.height+'px';mark.style.color=style.color;
      // Inverted inline highlights must carry their own background under the mark.
      var owner=a.node.parentElement;while(owner&&owner!==el){var bg=getComputedStyle(owner).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent'){mark.style.backgroundColor=bg;break;}owner=owner.parentElement;}
      el.appendChild(mark);
    }
  }
  var els=[], tmr=null;
  function all(){ els=[].slice.call(document.querySelectorAll(SEL)); if(matchMedia("(max-width:960px)").matches){els=els.filter(function(el){if(el.matches("#hero>.lead"))return true;unwrap(el);return false;});} els.forEach(hang); els.forEach(verify); els.forEach(nativeMarks); }
  function later(){ clearTimeout(tmr); tmr=setTimeout(all,120); }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(later); else later();
  addEventListener('load',later); addEventListener('resize',later);
  document.addEventListener('focusin',function(e){ var el=e.target&&e.target.closest&&e.target.closest(SEL); if(el&&el.isContentEditable) unwrap(el); });
  document.addEventListener('focusout',function(e){ var el=e.target&&e.target.closest&&e.target.closest(SEL); if(el) later(); });
  window.__w19Hang=all;
})();
