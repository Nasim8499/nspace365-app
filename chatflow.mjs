import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
const errs=[];
p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,150));});
p.on('pageerror',e=>errs.push('PAGEERR '+String(e).slice(0,150)));
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
// open the agent picker
await p.evaluate(()=>{
  const nb=[...document.querySelectorAll('button')].find(b=>/new chat/i.test(b.textContent||b.title||''));
  (nb||document.querySelector('button[title="New chat"]'))?.click();
});
await wait(700);
const agents=await p.evaluate(()=>[...document.querySelectorAll('button,.pickcard,.agentcard')].map(e=>(e.textContent||'').trim().slice(0,26)).filter(t=>t.length>3).slice(0,12));
console.log('picker items', JSON.stringify(agents));
// click the first real agent option
await p.evaluate(()=>{
  const cards=[...document.querySelectorAll('.pickagent, .agentpick, .agentcard, .pickcard, button')];
  const c=cards.find(e=>/Passport|Visa|Intake|Writer/i.test(e.textContent||''));
  c?.click();
});
await wait(1200);
const hasTA=await p.evaluate(()=>document.querySelectorAll('textarea').length);
console.log('composer textarea count', hasTA);
if(hasTA){
  const ta=await p.$('textarea');
  await ta.click();
  await p.keyboard.type('Draft one line confirming you are live.');
  await p.keyboard.press('Enter');
  const t0=Date.now(); let last='';
  while(Date.now()-t0<50000){
    last=await p.evaluate(()=>{const m=[...document.querySelectorAll('.msgcard,.bubble,.message')]; return m.length?m[m.length-1].textContent.trim().slice(0,150):'';});
    if(last && !/Draft one line confirming you are live\.$/.test(last) && last.length>20) break;
    await wait(1000);
  }
  console.log('reply('+Math.round((Date.now()-t0)/1000)+'s):', last.slice(0,140));
  await p.screenshot({path:'shots/p-chat-reply.png'});
}
console.log('errors',errs.slice(0,4));
await b.close();
