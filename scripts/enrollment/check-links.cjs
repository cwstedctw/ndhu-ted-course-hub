const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const index=JSON.parse(fs.readFileSync(path.join(root,'content/courses.json'),'utf8'));
const metadata=JSON.parse(fs.readFileSync(path.join(__dirname,'course-metadata.json'),'utf8'));
const supported=new Set(metadata.map(c=>c.code));let checked=0;
for(const entry of index.courses){
 if(!entry.courseDir?.startsWith('11501-'))continue;
 const data=JSON.parse(fs.readFileSync(path.join(root,'content/courses',entry.courseDir,'course.json'),'utf8'));
 const section=entry.sectionId?data.sections.find(s=>s.id===entry.sectionId):data.sections[0];
 if(!section?.code)continue;
 assert.ok(supported.has(section.code),`No enrollment data for ${section.code}`);
 const page=fs.readFileSync(path.join(root,'out/courses',entry.slug,'index.html'),'utf8');
 assert.ok(page.includes(`/enrollment/11501/index.html?course=${section.code}`),`Missing enrollment link: ${entry.slug}`);
 if(section.langProfile?.primary==='en')assert.ok(page.includes(`course=${section.code}&amp;lang=en`),`Missing EMI language parameter: ${entry.slug}`);
 checked++;
}
assert.ok(checked>0);assert.ok(fs.statSync(path.join(root,'out/enrollment/11501/index.html')).size>0);
console.log(`PASS: ${checked} exported course pages contain enrollment deep links; target page exists.`);
