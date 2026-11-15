import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--user-data-dir=/tmp/r'+Date.now()]});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,120)));
await p.setViewport({width:430,height:900,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(URL,{waitUntil:'networkidle0'}); await wait(600);
await p.evaluate(()=>document.querySelector('.welc-skip')?.click()); await wait(400);
await p.screenshot({path:'shots/v4-auth-mobile.png'});
await p.click('[data-testid=auth-tab-signup]'); await wait(250);
await p.type('[data-testid=auth-name]','Mobile Tester');
await p.type('[data-testid=auth-email]','mobile.flow@nspaces.studio');
await p.type('[data-testid=auth-password]','Mobile123');
await p.click('[data-testid=auth-submit]'); await wait(800);
await p.screenshot({path:'shots/v5-inbox-mobile.png'});
const href=await p.$eval('[data-testid=verify-open]',a=>a.getAttribute('href'));
await p.evaluate(h=>{location.hash=h.replace(/^#/,'');},href); await wait(900);
await p.waitForFunction(()=>!!document.querySelector('.dashstat'),{timeout:8000}).catch(()=>{});
const app=await p.evaluate(()=>!!document.querySelector('.dashstat'));
// reload: session should persist (already verified, no second prompt)
await p.reload({waitUntil:'networkidle0'}); await wait(1200);
const persisted=await p.evaluate(()=>!!document.querySelector('.dashstat'));
// reuse the same link: must be refused
await p.evaluate(h=>{location.hash='#/chat';},null); await wait(300);
await p.evaluate(h=>{location.hash=h.replace(/^#/,'');},href); await wait(900);
const refused=await p.evaluate(()=>/already been used|not valid/.test(document.body.innerText));
console.log('reached app',app,'session persisted',persisted,'reused link refused',refused,'errors',errs.slice(0,2));
await b.close();
