/* W12 shared script for index / step1–5 / finish.
   Toy logic below is copied unchanged from terms.html (verified 2026-11-22); only wrapped so each toy
   runs only on the page that has its elements. Needs assets/config.js and assets/terms-data.js first. */
(function(){
"use strict";
var CFG = window.W12 || {colabUrl:"", videos:{}};
var TERMS = window.W12_TERMS || [];
var H = window.W12_HEADINGS || {};
var STEP = document.body.getAttribute('data-step') || '';
var $ = function(id){ return document.getElementById(id); };
function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];}); }
function rxEsc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

/* ---------- storage (only this browser, never sent) ---------- */
var KEY = 'w12-card-';
function load(n){ try { return window.localStorage.getItem(KEY + n) || ''; } catch(e){ return ''; } }
function save(n, v){ try { window.localStorage.setItem(KEY + n, v); return true; } catch(e){ return false; } }
function clearAll(){ try { for(var i=0;i<=5;i++) window.localStorage.removeItem(KEY + i); return true; } catch(e){ return false; } }
window.W12store = {load:load, save:save, clearAll:clearAll};

/* ---------- progress bar ---------- */
var PAGES = [["index.html","Start"],["step1.html","Step 1"],["step2.html","Step 2"],["step3.html","Step 3"],["step4.html","Step 4"],["step5.html","Step 5"],["finish.html","Finish"]];
var idx = STEP === 'index' ? 0 : STEP === 'finish' ? 6 : parseInt(STEP,10);
function progHTML(){
  var where = (idx>=1 && idx<=5) ? 'Step ' + idx + ' of 5' : PAGES[idx][1];
  var prev = idx>0 ? '<a href="'+PAGES[idx-1][0]+'" rel="prev">← '+PAGES[idx-1][1]+'</a>' : '';
  var next = idx<6 ? '<a href="'+PAGES[idx+1][0]+'" rel="next">'+PAGES[idx+1][1]+' →</a>' : '';
  var dots = '<ul class="dots">' + PAGES.map(function(p,i){ return '<li><a href="'+p[0]+'"'+(i===idx?' aria-current="page"':'')+'>'+p[1]+'</a></li>'; }).join('') + '<li><a href="terms.html">Terms</a></li></ul>';
  return '<div class="in"><span class="where">'+where+'</span>'+dots+'<span class="pn">'+prev+next+'</span></div>';
}
['progTop','progBot'].forEach(function(id){ var el = $(id); if(el && !isNaN(idx)) el.innerHTML = progHTML(); });

/* ---------- video (only if configured) ---------- */
var vbox = $('video');
if(vbox){
  var vkey = vbox.getAttribute('data-key'), vurl = CFG.videos && CFG.videos[vkey];
  if(vurl){ vbox.querySelector('.vslot').innerHTML = '<video controls preload="metadata" src="'+esc(vurl)+'"></video>'; }
  else { vbox.remove(); }
}

/* ---------- Colab ---------- */
var cbox = $('colabSlot');
if(cbox){
  cbox.innerHTML = CFG.colabUrl
    ? '<a class="btn-official" href="'+esc(CFG.colabUrl)+'" target="_blank" rel="noopener">Open the Colab notebook (new tab) ↗</a>'
    : '<p class="wait">The teacher will give you the link in class. 老師上課會給連結。</p>';
}

/* ---------- term cards (same rendering as terms.html) ---------- */
var STAGE_LONG = {"0":"Overview","1":"Stage 1 · Tokenization","2":"Stage 2 · Embeddings","3":"Stage 3 · Attention & layers","4":"Stage 4 · Sampling","5":"Stage 5 · Chat, thinking & tools"};
var MARK = {1:"⭐",2:"🔹",3:"💤"};
var bySlug = {}; TERMS.forEach(function(t){ bySlug[t.s] = t; });
var amap = new Map();
TERMS.forEach(function(t){ (t.al||[]).forEach(function(a){ if(!amap.has(a)) amap.set(a,t.s); }); });
var aliases = Array.from(amap.keys()).sort(function(a,b){return b.length-a.length;});
var RX = aliases.length ? new RegExp('(?<![A-Za-z0-9_])(?:' + aliases.map(rxEsc).join('|') + ')(?:es|s)?(?![A-Za-z0-9_])','g') : null;
function lookup(m){
  if(amap.has(m)) return amap.get(m);
  if(/es$/.test(m) && amap.has(m.slice(0,-2))) return amap.get(m.slice(0,-2));
  if(/s$/.test(m) && amap.has(m.slice(0,-1))) return amap.get(m.slice(0,-1));
  return null;
}
function linkify(text, used){
  if(!RX) return esc(text);
  var out = "", last = 0, mm; RX.lastIndex = 0;
  while((mm = RX.exec(text)) !== null){
    var slug = lookup(mm[0]);
    if(slug && !used.has(slug)){
      used.add(slug);
      out += esc(text.slice(last, mm.index)) + '<a class="tl" href="#term-' + slug + '">' + esc(mm[0]) + '</a>';
      last = mm.index + mm[0].length;
    }
    if(mm[0].length === 0) RX.lastIndex++;
  }
  return out + esc(text.slice(last));
}
function whereHTML(t){
  return t.w.map(function(k){ return '<span>' + esc(STAGE_LONG[k.charAt(0)]) + ' → under the heading “' + esc(H[k]) + '”</span>'; }).join('<br>');
}
function cardHTML(t){
  var used = new Set([t.s]);
  var stages = Array.from(new Set(t.w.map(function(k){return k.charAt(0);})));
  var h = '<details class="card t' + t.tier + '" id="term-' + t.s + '">';
  h += '<summary><span class="sumline"><span class="tiermark" aria-label="tier">' + MARK[t.tier] + '</span><span class="term">' + esc(t.t) + '</span><span class="stagechip">' + esc(STAGE_LONG[stages[0]]) + '</span></span>';
  h += '<p class="qline"><b>Answers:</b> ' + esc(t.q) + '</p></summary><div class="cardbody">';
  h += '<p class="def en">' + esc(t.p) + '</p><p class="def zh" lang="zh-Hant">' + esc(t.zh) + '</p><dl class="fields">';
  if(t.an) h += '<dt>Everyday analogy</dt><dd>' + linkify(t.an, used) + '</dd>';
  if(t.ex) h += '<dt>Worked example</dt><dd>' + linkify(t.ex, used) + '</dd>';
  h += '<dt>Where you\'ll see it</dt><dd>' + whereHTML(t) + '</dd>';
  if(t.m) h += '<dt>Common mix-up</dt><dd>' + linkify(t.m, used) + '</dd>';
  if(t.skip) h += '<dt>Why it\'s OK to skip</dt><dd>' + linkify(t.skip, used) + '</dd>';
  if(t.r && t.r.length) h += '<dt>Related</dt><dd class="related">' + t.r.map(function(s){ var r = bySlug[s]; return r ? '<a href="#term-' + s + '">' + MARK[r.tier] + ' ' + esc(r.t) + '</a>' : ''; }).join(' ') + '</dd>';
  h += '</dl>';
  if(t.st) h += '<details class="selftest"><summary>Self-test: ' + esc(t.st[0]) + '</summary><p>' + esc(t.st[1]) + '</p></details>';
  return h + '</div></details>';
}
var cores = $('cores');
if(cores){
  cores.innerHTML = cores.getAttribute('data-slugs').split(' ').map(function(s){ return bySlug[s] ? cardHTML(bySlug[s]) : ''; }).join('');
}
/* a #term-x link opens the card if it is on this page; otherwise go to the dictionary page */
function openLocal(id){
  var el = document.getElementById(id);
  if(!el) return false;
  el.open = true; el.scrollIntoView({block:'start'});
  el.classList.add('flash'); setTimeout(function(){ el.classList.remove('flash'); }, 1600);
  return true;
}
document.addEventListener('click', function(e){
  var a = e.target.closest ? e.target.closest('a[href^="#term-"]') : null;
  if(!a) return;
  e.preventDefault();
  var id = a.getAttribute('href').slice(1);
  if(!openLocal(id)) location.href = 'terms.html#' + id;
});
if(location.hash.indexOf('#term-') === 0) openLocal(location.hash.slice(1));

/* ---------- write one sentence ---------- */
document.querySelectorAll('textarea[data-box]').forEach(function(ta){
  var n = ta.getAttribute('data-box'), msg = document.getElementById('saved' + n), timer = null;
  ta.value = load(n);
  ta.addEventListener('input', function(){
    clearTimeout(timer);
    var ok = save(n, ta.value);
    if(msg) msg.textContent = ok ? 'Saved in this browser only. 已存在這台電腦的瀏覽器。' : 'This browser cannot save; copy your sentence onto paper. 這個瀏覽器存不了，請抄在紙上。';
    timer = setTimeout(function(){ if(msg) msg.textContent = ''; }, 2500);
  });
});

/* ---------- quiz (same items and wording as terms.html) ---------- */
var QUIZ = [
  {q:"Token IDs 5866 (▁cat) and 5867 are next to each other. Are their meanings close?", o:["Yes, close numbers mean close meanings","No, an ID is just a position in the list"], a:1, why:"IDs are positions in the list; meaning comes from embeddings in Stage 2.", link:"token-id", opt:false},
  {q:"You lower temperature from 1.0 to 0.2. What happens?", o:["The model knows more facts","The top choice gets an even bigger share, so answers repeat more","Answers become more random"], a:1, why:"Low temperature sharpens the peak; it doesn't add knowledge.", link:"temperature", opt:false},
  {q:"In “…because it was too big”, when the model is at “it”, can it see “big”?", o:["Yes, it reads the whole sentence at once","No, the causal mask hides later words"], a:1, why:"Gemma 4 is decoder-only: each word looks only backward. “big” links things up when it arrives.", link:"causal-mask", opt:false},
  {q:"Chances 50%, 30%, 15%, 5%. With Top-P = 0.9, how many candidates survive?", o:["1","2","3","4"], a:2, why:"50 → 80 → 95. The running total first reaches 90 at the third one.", link:"top-p", opt:true},
  {q:"In a tool call, who actually runs the tool?", o:["The model runs it inside itself","Your program runs it and pastes the result back"], a:1, why:"The model only writes the request and reads the reply.", link:"tool-call", opt:true}
];
var qb = $('quizBox');
if(qb){
  var pick = (qb.getAttribute('data-q') || '0 1 2 3 4').split(' ').map(Number), answered = {};
  pick.forEach(function(n){
    var item = QUIZ[n], d = document.createElement('div'); d.className = 'qz';
    var h = '<fieldset><legend>' + (n+1) + '. ' + esc(item.q) + (item.opt ? '<span class="opt-tag">optional</span>' : '<span class="opt-tag">in class</span>') + '</legend>';
    item.o.forEach(function(o,i){ h += '<label><input type="radio" name="qz' + n + '" value="' + i + '"> ' + esc(o) + '</label>'; });
    h += '</fieldset><div class="fb" id="fb' + n + '" aria-live="polite"></div>';
    d.innerHTML = h; qb.appendChild(d);
    d.querySelectorAll('input').forEach(function(inp){
      inp.addEventListener('change', function(){
        var ok = parseInt(inp.value,10) === item.a, fb = document.getElementById('fb' + n);
        fb.className = 'fb ' + (ok ? 'ok' : 'bad');
        fb.innerHTML = (ok ? '✓ Right. ' : '✗ Not quite. ') + esc(item.why) + ' <a href="#term-' + item.link + '">Open the card</a>';
        answered[n] = ok;
        var sc = $('quizScore');
        if(sc){ var keys = Object.keys(answered); sc.textContent = keys.filter(function(k){return answered[k];}).length + ' right out of ' + keys.length + ' answered.'; }
      });
    });
  });
}

/* ---------- Toy 2: meaning map ---------- */
if($('vecBtns')) (function(){
var WORDS = [
  {w:"cat",    v:[0.90,0.10,0.10], x:95,  y:85},
  {w:"kitten", v:[0.85,0.05,0.20], x:150, y:60},
  {w:"dog",    v:[0.90,0.15,0.05], x:70,  y:140},
  {w:"car",    v:[0.10,0.90,0.05], x:300, y:85},
  {w:"truck",  v:[0.05,0.95,0.10], x:335, y:140},
  {w:"banana", v:[0.10,0.05,0.95], x:205, y:250}
];
function cos(a,b){ var d=0,na=0,nb=0; for(var i=0;i<a.length;i++){ d+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; } return d/Math.sqrt(na*nb); }
var vecSel = 0;
var vecBtns = document.getElementById('vecBtns');
WORDS.forEach(function(o,i){
  var b = document.createElement('button'); b.type='button'; b.className='wbtn'; b.textContent=o.w;
  b.addEventListener('click', function(){ vecSel = i; drawVec(); });
  vecBtns.appendChild(b);
});
function drawVec(){
  var s = WORDS[vecSel], svg = document.getElementById('vecMap'), parts = [];
  vecBtns.querySelectorAll('button').forEach(function(b,i){ b.setAttribute('aria-pressed', i===vecSel?'true':'false'); });
  WORDS.forEach(function(o,i){
    if(i===vecSel) return;
    var c = cos(s.v,o.v);
    parts.push('<line x1="'+s.x+'" y1="'+s.y+'" x2="'+o.x+'" y2="'+o.y+'" stroke="var(--accent)" stroke-opacity="'+(0.2+0.8*Math.max(0,c)).toFixed(2)+'" stroke-width="'+(1+4*Math.max(0,c)).toFixed(1)+'"/>');
    var mx=(s.x+o.x)/2, my=(s.y+o.y)/2;
    parts.push('<text x="'+mx+'" y="'+(my-4)+'" font-size="12" text-anchor="middle" fill="var(--muted)">'+c.toFixed(2)+'</text>');
  });
  WORDS.forEach(function(o,i){
    parts.push('<circle cx="'+o.x+'" cy="'+o.y+'" r="'+(i===vecSel?9:6)+'" fill="'+(i===vecSel?'var(--warm)':'var(--accent)')+'"/>');
    parts.push('<text x="'+o.x+'" y="'+(o.y+24)+'" font-size="15" text-anchor="middle" fill="var(--ink)" font-weight="'+(i===vecSel?'700':'400')+'">'+o.w+'</text>');
  });
  parts.push('<text x="8" y="16" font-size="11" fill="var(--muted)">hand-drawn layout · made-up numbers</text>');
  svg.innerHTML = parts.join('');
  var rows = WORDS.map(function(o,i){ return {o:o, c:cos(s.v,o.v), i:i}; }).filter(function(r){return r.i!==vecSel;}).sort(function(a,b){return b.c-a.c;});
  document.getElementById('vecBars').innerHTML = rows.map(function(r){
    return '<div class="bar"><span class="name">'+r.o.w+'</span><span class="track"><span class="fill" style="width:'+(Math.max(0,r.c)*100).toFixed(1)+'%"></span></span><span class="pct">'+r.c.toFixed(2)+'</span></div>';
  }).join('');
  document.getElementById('vecExplain').innerHTML = '<b>'+s.w+'</b> = ['+s.v.join(', ')+'] (animal, vehicle, food — invented). Closest: <b>'+rows[0].o.w+'</b> ('+rows[0].c.toFixed(2)+'); farthest: <b>'+rows[rows.length-1].o.w+'</b> ('+rows[rows.length-1].c.toFixed(2)+'). Scores near 1 = pointing the same way; near 0 = at right angles.';
}
drawVec();
})();

/* ---------- Toy 3: attention ---------- */
if($('attnWords')) (function(){
var ATT = {
  A: {
    words: ["Leo","lifted","the","trophy","out","of","the","suitcase","and","{V}","it","carefully","."],
    toggle: ["polished","zipped"], q: 10,
    fixed: {
      polished: {10:{3:48,9:18,7:9,10:8,1:5,0:4,8:3,2:2,6:1,4:1,5:1}},
      zipped:   {10:{7:50,9:18,3:8,10:8,1:4,0:3,8:3,2:2,6:2,4:1,5:1}}
    },
    say: function(v,qi){
      if(qi===10) return v==="polished" ? 'In this illustration, from “it”, the strongest link is <b>trophy</b>: the verb “polished” came <i>before</i> “it”, and you polish trophies. “carefully” and “.” come later, so they are masked (0%).' : 'In this illustration, from “it”, the strongest link is now <b>suitcase</b>: “zipped” came before “it”, and suitcases have zips. Only the earlier verb changed.';
      return 'This word can only look back at itself and earlier words. Click “it” to see the interesting case.';
    }
  },
  B: {
    words: ["The","trophy","didn't","fit","in","the","suitcase","because","it","was","too","{V}","."],
    toggle: ["big","small"], q: 8,
    fixed: {
      big:   {8:{0:3,1:30,2:6,3:10,4:3,5:3,6:29,7:8,8:8}, 11:{1:32,8:22,10:11,11:10,6:8,3:6,9:4,2:2,7:2,0:1,4:1,5:1}},
      small: {8:{0:3,1:30,2:6,3:10,4:3,5:3,6:29,7:8,8:8}, 11:{6:32,8:22,10:11,11:10,1:8,3:6,9:4,2:2,7:2,0:1,4:1,5:1}}
    },
    say: function(v,qi){
      if(qi===8) return 'In this illustration, at “it”, the clue (“'+v+'”) has not arrived yet — the causal mask hides it. So <b>trophy and suitcase stay almost tied</b>, whether the sentence ends in big or small. Now click “'+v+'”.';
      if(qi===11) return v==="big" ? 'In this illustration, “big” looks back at “it” and <b>trophy</b>: too big → the trophy is what didn\'t fit. The later word does the linking.' : 'In this illustration, “small” looks back at “it” and <b>suitcase</b>: too small → the suitcase was the problem. The later word does the linking.';
      return 'This word can only look back at itself and earlier words. Try “it”, then the last clue word.';
    }
  }
};
var att = {part:"A", v:{A:"polished",B:"big"}, qi:10};
function genericWeights(i){
  var raw = {}, tot = 0;
  for(var j=0;j<=i;j++){ var s = (j===i)?5:(j===i-1)?4:1; raw[j]=s; tot+=s; }
  var out = {}; for(var k in raw) out[k] = raw[k]*100/tot; return out;
}
function drawAtt(){
  var P = ATT[att.part], v = att.v[att.part];
  document.getElementById('partA').setAttribute('aria-pressed', att.part==="A"?'true':'false');
  document.getElementById('partB').setAttribute('aria-pressed', att.part==="B"?'true':'false');
  var tg = document.getElementById('attnToggle');
  tg.innerHTML = '<span class="count">'+(att.part==="A"?'Verb before “it”:':'Last word:')+'</span>';
  P.toggle.forEach(function(opt){
    var b = document.createElement('button'); b.type='button'; b.className='chip-btn'; b.textContent=opt;
    b.setAttribute('aria-pressed', opt===v?'true':'false');
    b.addEventListener('click', function(){ att.v[att.part]=opt; drawAtt(); });
    tg.appendChild(b);
  });
  var words = P.words.map(function(w){ return w==="{V}" ? v : w; });
  var wbox = document.getElementById('attnWords'); wbox.innerHTML='';
  words.forEach(function(w,i){
    var b = document.createElement('button'); b.type='button'; b.className='wbtn'+(i>att.qi?' masked':''); b.textContent=w;
    b.setAttribute('aria-pressed', i===att.qi?'true':'false');
    b.addEventListener('click', function(){ att.qi=i; drawAtt(); });
    wbox.appendChild(b);
  });
  var W = (P.fixed[v] && P.fixed[v][att.qi]) ? P.fixed[v][att.qi] : genericWeights(att.qi);
  document.getElementById('attnBars').innerHTML = '<p style="margin:.2rem 0"><b>Looking back from “'+esc(words[att.qi])+'”</b> (illustrative %):</p>' + words.map(function(w,i){
    if(i>att.qi) return '<div class="bar masked"><span class="name">'+esc(w)+'</span><span class="track"></span><span class="pct">0% masked</span></div>';
    var p = W[i]||0;
    return '<div class="bar"><span class="name">'+esc(w)+'</span><span class="track"><span class="fill" style="width:'+p.toFixed(1)+'%"></span></span><span class="pct">'+Math.round(p)+'%</span></div>';
  }).join('') + '<p class="count" style="margin:.2rem 0">Hatched = causal mask: can\'t see later words.</p>';
  document.getElementById('attnExplain').innerHTML = P.say(v, att.qi);
}
document.getElementById('partA').addEventListener('click', function(){ att.part="A"; att.qi=ATT.A.q; drawAtt(); });
document.getElementById('partB').addEventListener('click', function(){ att.part="B"; att.qi=ATT.B.q; drawAtt(); });
drawAtt();
})();

/* ---------- Toy 4: sampling ---------- */
if($('sampBars')) (function(){
var CANDS = [["noodles",3.0],["rice",2.6],["dumplings",2.2],["pizza",1.6],["salad",0.9],["ice cream",0.4],["homework",-0.8],["a chair",-2.0]];
var hist = [];
var sT = document.getElementById('sT'), sK = document.getElementById('sK'), sP = document.getElementById('sP');
function computeSamp(){
  var T = parseFloat(sT.value), K = parseInt(sK.value,10), P = parseFloat(sP.value), n = CANDS.length, base = [], i;
  if(T === 0){
    var mx = 0; for(i=1;i<n;i++) if(CANDS[i][1] > CANDS[mx][1]) mx = i;
    for(i=0;i<n;i++) base.push(i===mx?1:0);
  } else {
    var m = -Infinity; for(i=0;i<n;i++) m = Math.max(m, CANDS[i][1]/T);
    var e = [], s = 0; for(i=0;i<n;i++){ e.push(Math.exp(CANDS[i][1]/T - m)); s += e[i]; }
    for(i=0;i<n;i++) base.push(e[i]/s);
  }
  var order = base.map(function(p,i){return i;}).sort(function(a,b){return base[b]-base[a];});
  var keepK = order.slice(0, K), sumK = 0; keepK.forEach(function(i){ sumK += base[i]; });
  var keep = [], cum = 0;
  for(var j=0;j<keepK.length;j++){ var ii = keepK[j]; keep.push(ii); cum += base[ii]/sumK; if(cum >= P - 1e-9) break; }
  var sumKeep = 0; keep.forEach(function(i){ sumKeep += base[i]; });
  var fin = base.map(function(p,i){ return keep.indexOf(i)!==-1 ? p/sumKeep : 0; });
  return {T:T,K:K,P:P,base:base,fin:fin,keep:keep,cutK:n-keepK.length,cutP:keepK.length-keep.length};
}
function drawSamp(){
  var r = computeSamp();
  document.getElementById('oT').textContent = r.T===0 ? '0 (greedy)' : r.T.toFixed(2);
  document.getElementById('oK').textContent = r.K===8 ? '8 (keeps all)' : String(r.K);
  document.getElementById('oP').textContent = r.P.toFixed(2);
  document.getElementById('sampBars').innerHTML = CANDS.map(function(c,i){
    var cut = r.fin[i] === 0 && r.keep.indexOf(i)===-1;
    return '<div class="bar'+(cut?' cut':'')+'"><span class="name">'+esc(c[0])+'</span><span class="track"><span class="ghost" style="width:'+(r.base[i]*100).toFixed(2)+'%"></span><span class="fill" style="width:'+(r.fin[i]*100).toFixed(2)+'%"></span></span><span class="pct">'+(cut?'✂ cut':(r.fin[i]*100).toFixed(1)+'%')+'</span></div>';
  }).join('');
  var top = 0; for(var i=1;i<CANDS.length;i++) if(r.fin[i]>r.fin[top]) top=i;
  var msg = 'Top choice “'+CANDS[top][0]+'” has '+(r.fin[top]*100).toFixed(1)+'%. ';
  if(r.T===0) msg += 'Temperature 0 = greedy: always the same pick. ';
  else if(r.T<0.6) msg += 'Low temperature sharpens the peak. ';
  else if(r.T>1.4) msg += 'High temperature flattens the chances, so odd picks appear. ';
  msg += r.keep.length + ' of 8 candidates survive (Top-K cut ' + r.cutK + ', Top-P cut ' + r.cutP + ').';
  document.getElementById('sampExplain').textContent = msg;
  drawHist();
}
function drawHist(){
  document.getElementById('sampHist').innerHTML = hist.length ? hist.map(function(h){ return '<span>'+esc(h)+'</span>'; }).join('') : '<span>(none yet)</span>';
}
function sampleOnce(){
  var r = computeSamp(), x = Math.random(), acc = 0, pick = r.keep[0];
  for(var i=0;i<CANDS.length;i++){ acc += r.fin[i]; if(r.fin[i]>0 && x < acc){ pick = i; break; } }
  hist.unshift(CANDS[pick][0] + ' (T ' + (r.T===0?'0':r.T.toFixed(2)) + ')');
  if(hist.length > 10) hist.length = 10;
}
[sT,sK,sP].forEach(function(el){ el.addEventListener('input', drawSamp); });
document.getElementById('sampOnce').addEventListener('click', function(){ sampleOnce(); drawHist(); });
document.getElementById('samp10').addEventListener('click', function(){ for(var i=0;i<10;i++) sampleOnce(); drawHist(); });
document.getElementById('sampDefaults').addEventListener('click', function(){ sT.value='1'; sK.value='8'; sP.value='0.95'; drawSamp(); });
document.getElementById('sampClear').addEventListener('click', function(){ hist = []; drawHist(); });
drawSamp();
})();

/* ---------- Toy 5: autoregressive loop ---------- */
if($('loopStep')) (function(){
var PROMPT = ["H","ual","ien"," is"," famous"," for"];  /* real Gemma 4 split (Colab 2026-11-23) */
var STEPS = [
  [[" Taroko",41],[" its",33],[" the",14]],
  [[" Gorge",88],[" National",6],[",",2]],
  [[" and",52],[",",27],[".",15]],
  [[" its",38],[" the",35],[" beautiful",12]],
  [[" ocean",44],[" coastline",29],[" mountains",17]],
  [[" views",61],[" scenery",22],[" breeze",9]],
  [[".",83],[",",9],[" from",3]],
  [["<turn|>",71],[" It",19],[" The",6]]
];
var loopN = 0;
function drawLoop(){
  var gen = STEPS.slice(0, loopN).map(function(s){ return s[0][0]; });
  var html = PROMPT.map(function(t){ return '<span class="tok">'+esc(t)+'</span>'; }).join('');
  html += gen.map(function(t,i){ var cls = 'tok gen' + (i===gen.length-1?' new':'') + (t==='<turn|>'?' stop':''); return '<span class="'+cls+'">'+esc(t)+'</span>'; }).join('');
  document.getElementById('loopInput').innerHTML = html;
  var done = loopN >= STEPS.length;
  document.getElementById('loopStep').disabled = done;
  document.getElementById('loopPass').textContent = done ? 'Finished after ' + STEPS.length + ' runs' : 'Next: run #' + (loopN+1);
  var cb = document.getElementById('loopCands'), ex = document.getElementById('loopExplain');
  if(loopN === 0){
    cb.innerHTML = '';
    ex.innerHTML = 'The input is just the prompt (6 pieces, the real Gemma 4 split). Press <b>Step</b> to run the model once.';
    return;
  }
  var s = STEPS[loopN-1];
  cb.innerHTML = '<p style="margin:.2rem 0"><b>Run #'+loopN+' — top guesses (made-up chances):</b></p>' + s.map(function(c,i){
    return '<div class="bar"><span class="name">'+esc(c[0])+'</span><span class="track"><span class="fill" style="width:'+c[1]+'%"></span></span><span class="pct">'+c[1]+'%'+(i===0?' ✓':'')+'</span></div>';
  }).join('');
  if(s[0][0] === '<turn|>') ex.innerHTML = 'The model picked <b>&lt;turn|&gt;</b>, the end-of-turn marker (ID 106, from the guide). The loop stops. ' + STEPS.length + ' new pieces took ' + STEPS.length + ' runs.';
  else ex.innerHTML = 'Picked “' + esc(s[0][0]) + '” → <b>fed back</b>: it is now the last piece of the input (highlighted). Run #' + (loopN+1) + ' will read all ' + (PROMPT.length+loopN) + ' pieces to guess the next one.';
}
document.getElementById('loopStep').addEventListener('click', function(){ if(loopN < STEPS.length){ loopN++; drawLoop(); } });
document.getElementById('loopReset').addEventListener('click', function(){ loopN = 0; drawLoop(); });
drawLoop();
})();

/* ---------- finish page: five-box summary ---------- */
if($('summary')) (function(){
  function draw(){
    document.querySelectorAll('#summary .answer').forEach(function(el){
      var v = load(el.getAttribute('data-box'));
      el.textContent = v || '(empty — go back to that step and write one sentence) 還沒寫';
      el.classList.toggle('empty', !v);
    });
  }
  draw();
  $('printCard').addEventListener('click', function(){ window.print(); });
  $('clearCard').addEventListener('click', function(){
    if(!window.confirm('Clear all six boxes in this browser? 確定清除這台電腦上的五格卡？')) return;
    clearAll(); draw();
    $('clearMsg').textContent = 'Cleared. 已清除。';
  });
})();
})();
