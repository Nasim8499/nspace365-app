import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,120)));
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
await wait(1000);
const before=await p.evaluate(()=>({
  newChatBtns:[...document.querySelectorAll('button')].filter(b=>/new chat/i.test(b.textContent||'')).length,
  titleBtns:document.querySelectorAll('button[title="New chat"]').length,
  modals:document.querySelectorAll('.modal, .sheet, [class*=modal]').length,
}));
console.log('before', JSON.stringify(before));
const clicked=await p.evaluate(()=>{
  const b1=document.querySelector('button[title="New chat"]');
  if(b1){b1.click();return 'title';}
  const b2=[...document.querySelectorAll('button')].find(b=>/new chat/i.test(b.textContent||''));
  if(b2){b2.click();return 'text';}
  return 'none';
});
await wait(900);
console.log('clicked via', clicked, 'modals now', await p.evaluate(()=>document.querySelectorAll('.modal, .sheet, [class*=modal], [class*=picker]').length));
console.log('pane text', await p.evaluate(()=>(document.body.innerText||'').slice(0,220).replace(/\n+/g,' | ')));
await p.screenshot({path:'shots/p-chat-picker.png'});
console.log('errors', errs.slice(0,3));
await b.close();
