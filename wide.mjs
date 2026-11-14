import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--user-data-dir=/tmp/w'+Date.now()]});
const p=await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
await p.setViewport({width:1440,height:900});
await p.goto(URL,{waitUntil:'networkidle0'});
await wait(700); await p.evaluate(()=>document.querySelector('.welc-skip')?.click());
await p.waitForSelector('.authcard');
await p.click('[data-testid=auth-fill-admin]'); await p.type('[data-testid=auth-password]','VisaHOBe1323@'); await p.click('[data-testid=auth-submit]');
await p.waitForSelector('.dashstat',{timeout:20000});
const sizes=[[1440,900],[1280,800],[1024,768],[820,1180],[768,1024]];
const routes=['/chat','/discover','/automations','/memory','/artifacts','/agents','/visa'];
for (const [w,h] of sizes){
  await p.setViewport({width:w,height:h});
  const row=[];
  for (const r of routes){
    await p.evaluate(x=>{location.hash='#'+x;},r); await wait(500);
    const m=await p.evaluate(()=>{
      const rail=document.querySelector('.rail'), tab=document.querySelector('.tabbar');
      const o=document.documentElement.scrollWidth-innerWidth;
      const railW=rail?Math.round(rail.getBoundingClientRect().width):0;
      const tabD=tab?getComputedStyle(tab).display:'none';
      const main=document.querySelector('.chatwrap,.page');
      const mw=main?Math.round(main.getBoundingClientRect().width):0;
      return {o,railW,tabD,mw};
    });
    row.push(`${r} o=${m.o} rail=${m.railW} tab=${m.tabD} main=${m.mw}`);
  }
  console.log(`== ${w}x${h}`, row.join(' | '));
}
await b.close();
console.log('errs', errs.slice(0,3));
