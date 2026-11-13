import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140));});
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
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
await p.evaluate(()=>document.querySelector('button[title="New chat"]')?.click());
await wait(700);
await p.evaluate(()=>{
  const items=[...document.querySelectorAll('button.conv')];
  (items.find(i=>/Passport/i.test(i.textContent||''))||items[0])?.click();
});
await wait(1200);
console.log('textarea', await p.evaluate(()=>document.querySelectorAll('textarea').length));
const ta=await p.$('textarea');
if(ta){
  await ta.click();
  await p.keyboard.type('Reply with one short line to confirm live chat.');
  await p.keyboard.press('Enter');
  const t0=Date.now(); let last=''; let stable=0;
  while(Date.now()-t0<60000){
    const cur=await p.evaluate(()=>{const m=[...document.querySelectorAll('.msgcard,.bubble,.message,.mbody')]; return m.length?m[m.length-1].textContent.trim():'';});
    if(cur && cur!==last){last=cur;stable=0;} else if(cur){stable++;}
    if(cur.length>25 && !/Reply with one short line/.test(cur)) break;
    await wait(1000);
  }
  console.log('reply ('+Math.round((Date.now()-t0)/1000)+'s):', last.replace(/\s+/g,' ').slice(0,160));
  await p.screenshot({path:'shots/p-chat-reply.png'});
  const url=await p.evaluate(()=>location.hash);
  console.log('route', url);
}
console.log('errors', errs.slice(0,4));
await b.close();
