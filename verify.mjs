import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--user-data-dir=/tmp/v'+Date.now()]});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
await p.setViewport({width:1440,height:960,deviceScaleFactor:1.4,isMobile:false});
await p.goto(URL,{waitUntil:'networkidle0'}); await wait(700);
await p.evaluate(()=>document.querySelector('.welc-skip')?.click()); await wait(400);
await p.screenshot({path:'shots/v1-auth.png'});
await p.click('[data-testid=auth-tab-signup]'); await wait(300);
await p.type('[data-testid=auth-name]','Test Applicant');
await p.type('[data-testid=auth-email]','verify.test@nspaces.studio');
await p.type('[data-testid=auth-password]','TestPass123');
await p.click('[data-testid=auth-submit]'); await wait(900);
const inbox = await p.evaluate(()=>document.body.innerText.includes('Check your inbox'));
await p.screenshot({path:'shots/v2-inbox.png'});
const href = await p.$eval('[data-testid=verify-open]',a=>a.getAttribute('href')).catch(()=>null);
if (href){ await p.evaluate(h=>{location.hash=h.replace(/^#/,'');},href); }
await wait(900);
const verified = await p.evaluate(()=>document.body.innerText.includes('Email verified'));
await p.screenshot({path:'shots/v3-verified.png'});
await wait(2200);
const inApp = await p.evaluate(()=>!!document.querySelector('.dashstat'));
// reused link
const p2=await b.newPage(); await p2.goto(URL,{waitUntil:'networkidle0'}); await wait(900);
await p2.evaluate(h=>{location.hash='#/chat';},null); await wait(200);
// sign out then re-signin with password
await p.evaluate(()=>{location.hash='#/me';}); await wait(900);
const signed = await p.evaluate(()=>document.body.innerText.includes('Sign out')||document.body.innerText.includes('Log out')||document.body.innerText.includes('Account'));
console.log('inbox',inbox,'verified',verified,'reachedApp',inApp,'hasHref',!!href,'profile',signed);
console.log('errors',errs.slice(0,3));
await b.close();
