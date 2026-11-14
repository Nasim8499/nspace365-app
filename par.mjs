import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--user-data-dir=/tmp/par'+Date.now()]});
const p=await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('P '+String(e).slice(0,160))); p.on('console',m=>{if(m.type()==='error')errs.push('C '+m.text().slice(0,160));});
await p.setViewport({width:1440,height:900,deviceScaleFactor:1.5});
await p.goto(URL,{waitUntil:'networkidle0'});
await wait(700);
await p.evaluate(()=>document.querySelector('.welc-skip')?.click());
await p.waitForSelector('.authcard');
await p.click('[data-testid="auth-fill-admin"]');
await p.type('[data-testid="auth-password"]','VisaHOBe1323@');
await p.click('[data-testid="auth-submit"]');
await p.waitForSelector('.dashstat',{timeout:20000});
await p.evaluate(()=>{location.hash='#/chat';});
await wait(900);
console.log('rail items', await p.evaluate(()=>document.querySelectorAll('.rail .navbtn').length), 'tabbar visible', await p.evaluate(()=>{const t=document.querySelector('.tabbar');return t?getComputedStyle(t).display:'none';}));
await p.screenshot({path:'shots/r1-chat.png'});
// plus menu
await p.evaluate(()=>document.querySelector('.plusgreen')?.click());
await wait(400);
console.log('plus items', await p.evaluate(()=>document.querySelectorAll('.plusitem').length));
await p.screenshot({path:'shots/r2-plus.png'});
await p.keyboard.press('Escape');
// open a chat and skills
await p.evaluate(()=>document.querySelector('button[title="New chat"]')?.click());
await wait(600);
await p.evaluate(()=>{document.querySelectorAll('button.conv')[0]?.click();});
await wait(1200);
const ta=await p.$('textarea'); if(ta) await ta.type('Hello');
await wait(200);
await p.evaluate(()=>{document.querySelector('button[title="Skills"]')?.click();});
await wait(500);
console.log('skills rows', await p.evaluate(()=>document.querySelectorAll('.skillrow').length));
await p.screenshot({path:'shots/r3-skills.png'});
await p.evaluate(()=>document.querySelector('.skillssheet .iconbtn')?.click());
// pages
for (const [r,f] of [['/discover','r4-discover'],['/automations','r5-auto'],['/memory','r6-memory'],['/artifacts','r7-artifacts']]){
  await p.evaluate(x=>{location.hash='#'+x;},r);
  await wait(900);
  const o=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  console.log(r,'overflow',o);
  await p.screenshot({path:`shots/${f}.png`});
}
// mobile
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.evaluate(()=>{location.hash='#/chat';});
await wait(900);
console.log('mobile tabs', await p.evaluate(()=>[...document.querySelectorAll('.tabbtn span')].map(s=>s.textContent).join('/')), 'rail', await p.evaluate(()=>getComputedStyle(document.querySelector('.rail')).display));
await p.screenshot({path:'shots/r8-mobile.png'});
console.log('errors', errs.slice(0,5));
await b.close();
