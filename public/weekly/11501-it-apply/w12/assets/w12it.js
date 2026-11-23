/* 資訊科技與應用 W12 一步一頁站共用腳本（改寫自 student.html 內嵌腳本＋概論 W12 進度條） */

/* 進度條：上一步／下一步、目前第幾步 */
(function(){
var PAGES=[["index.html","開始"],["step1.html","1"],["step2.html","2"],["step3.html","3"],["step4.html","4"],["step5.html","5"],["step6.html","6"],["step7.html","7"],["finish.html","收尾"]];
var EXTRA=[["more.html","選做"],["help.html","卡住了"]];
var cur=document.body.getAttribute('data-page');
var idx=-1;PAGES.forEach(function(p,i){if(p[0]===cur)idx=i;});
var where=idx>=1&&idx<=7?'第 '+idx+' 步／共 7 步':idx===0?'開始':idx===8?'收尾':(cur==='more.html'?'選做':'卡住怎麼辦');
var lab=function(i){return i>=1&&i<=7?'第 '+i+' 步':PAGES[i][1];};
var prev='',next='';
if(idx>0)prev='<a href="'+PAGES[idx-1][0]+'" rel="prev">← 上一步（'+lab(idx-1)+'）</a>';
if(idx>=0&&idx<8)next='<a href="'+PAGES[idx+1][0]+'" rel="next">下一步（'+lab(idx+1)+'）→</a>';
if(idx<0)prev='<a href="index.html">← 回開始頁</a>';
var dots='<ul class="dots">'+PAGES.concat(EXTRA).map(function(p){return '<li><a href="'+p[0]+'"'+(p[0]===cur?' aria-current="page"':'')+'>'+p[1]+'</a></li>';}).join('')+'</ul>';
var html='<div class="in"><span class="where">'+where+'</span>'+dots+'<span class="pn">'+prev+next+'</span></div>';
['progTop','progBot'].forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML=html;});
})();
(function(){'use strict';
var $=function(id){return document.getElementById(id);};
document.querySelectorAll('pre.copy').forEach(function(p){var b=document.createElement('button');b.type='button';b.className='cbtn';b.textContent='複製';b.addEventListener('click',function(){var t=p.innerText.replace(/\n$/,'');var done=function(){b.textContent='已複製';setTimeout(function(){b.textContent='複製';},1500);};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,function(){fallback(t,done);});}else{fallback(t,done);}});(p.parentElement.classList.contains('cbox')?p.parentElement:p).appendChild(b);});
function fallback(t,done){var a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();try{document.execCommand('copy');done();}catch(e){}document.body.removeChild(a);}
var checks=Array.prototype.slice.call(document.querySelectorAll('input[data-check]'));var saved={};var key='it-w12-checks';
try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(e){saved={};$('storage-note').textContent='這個瀏覽器無法讀取紀錄，關頁後勾選會消失；本頁照樣能用。';}
function progress(){var n=checks.filter(function(c){return c.checked;}).length;var all=0;for(var k in saved){if(saved[k])all++;}$('progress').textContent='學習記錄（全站）'+all+' / 25';}
checks.forEach(function(c){c.checked=!!saved[c.dataset.check];c.addEventListener('change',function(){saved[c.dataset.check]=c.checked;try{localStorage.setItem(key,JSON.stringify(saved));}catch(e){$('storage-note').textContent='這個瀏覽器無法儲存，關頁後勾選會消失；本頁照樣能用。';}progress();});});progress();
var root=document.documentElement;try{var th=localStorage.getItem('it-w12-theme');if(th)root.setAttribute('data-theme',th);}catch(e){}
$('theme').addEventListener('click',function(){var dark=root.getAttribute('data-theme')?root.getAttribute('data-theme')==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var next=dark?'light':'dark';root.setAttribute('data-theme',next);try{localStorage.setItem('it-w12-theme',next);}catch(e){}});
})();
