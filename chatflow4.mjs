import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--user-data-dir=/tmp/prof-'+Date.now()]});
const p=await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
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
await wait(600);
await p.evaluate(()=>{const i=[...document.querySelectorAll('button.conv')]; (i.find(x=>/Passport/i.test(x.textContent||''))||i[0])?.click();});
await wait(1100);
const ta=await p.$('textarea');
await ta.click();
await p.keyboard.type('Say hello in one line.');
await p.keyboard.press('Enter');
const t0=Date.now(); let rows=0, text='';
while(Date.now()-t0<30000){
  const s=await p.evaluate(()=>{
    const rs=[...document.querySelectorAll('.msgrow')];
    return {n:rs.length, last:rs.length?rs[rs.length-1].innerText.replace(/\s+/g,' ').slice(0,200):''};
  });
  rows=s.n; text=s.last;
  if(rows>=2 && text.length>30) break;
  await wait(700);
}
console.log('rows', rows, 'last:', text);
await p.screenshot({path:'shots/p-chat-reply.png'});
console.log('errors', errs.slice(0,3));
await b.close();
