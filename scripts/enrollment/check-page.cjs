const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const template=fs.readFileSync(__dirname+'/page.template.html','utf8');
const live=JSON.parse(fs.readFileSync(__dirname+'/../../public/enrollment/11501/history.json','utf8'));
function run(data,search=''){
 const nodes=new Map();
 function el(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:id==='history-data'?JSON.stringify(data):'',innerHTML:'',listeners:{},append(){},addEventListener(t,f){this.listeners[t]=f}});return nodes.get(id)}
 const document={documentElement:{},getElementById:el,querySelectorAll:()=>[],createElement:()=>({click(){}})};
 const context={document,location:{search},window:{print(){}},URLSearchParams,Intl,Date,Blob,URL,setTimeout};vm.createContext(context);
 vm.runInContext(template.split('<script>')[1].split('</script>')[0],context);
 return el;
}
assert.equal(live.courses.length,9);assert.equal(live.days[0].status,'baseline');
assert.ok(Object.values(live.days[0].courses).every(c=>Number.isInteger(c.count)&&c.count>=0&&c.added===null&&c.left===null));
for(const course of live.courses){const el=run(live,'?course='+course.code);assert.equal(el('course-title').textContent,course.name);assert.ok(el('cards').innerHTML.includes('—'));assert.ok(!el('cards').innerHTML.includes('NaN'));}
const en=run(live,'?course=GC__6753AA&lang=en');assert.ok(en('course-title').textContent.includes('Artificial'));assert.equal(en('status').textContent,'Baseline');
assert.ok(en('schedule').textContent.includes('Monday'));assert.ok(en('schedule').textContent.includes('Science and Engineering'));
const model=JSON.parse(JSON.stringify(live));const first=model.days[0],base=first.courses,all={};for(const [code,c] of Object.entries(base))all[code]={...c,count:c.count+1,added:2,left:1,retained:c.count-1,net:1,comparedAt:c.capturedAt,capturedAt:'2026-09-08T18:00:00+08:00'};
model.days.push({date:'2026-09-07',status:'missing',courses:null},{date:'2026-09-08',status:'interval',comparedWith:'2026-09-06',gapDays:2,capturedAt:'2026-09-08T18:00:00+08:00',courses:all});
const el=run(model);assert.ok(el('comparison').textContent.includes('整個區間'));assert.ok(el('cards').innerHTML.includes('+1'));
el('date').value='2026-09-07';el('date').listeners.change();assert.ok(el('comparison').textContent.includes('無法計算'));assert.ok(!el('cards').innerHTML.includes('NaN'));
assert.ok(!el('cards').innerHTML.includes('建立基準'));assert.ok(el('cards').innerHTML.includes('尚未取得完整快照'));
el('lang').onclick();assert.equal(el('status').textContent,'No complete snapshot');
assert.ok(!template.includes('https://cdn'));console.log('PASS: 9 course deep links, baseline null changes, EMI English, missing date, interval labels, date selection and language switch.');
