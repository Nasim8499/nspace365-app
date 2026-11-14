import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--user-data-dir=/tmp/f'+Date.now()]});
const p=await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,120))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120));});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.goto(URL,{waitUntil:'networkidle0'});
await wait(1400);
await p.screenshot({path:'shots/f1-open.png'});
await p.evaluate(()=>document.querySelector('.welc-skip')?.click());
await p.waitForSelector('.authcard',{timeout:15000});
await wait(1600);
console.log('auth mobile', await p.evaluate(()=>({
  tabs:[...document.querySelectorAll('.authtab')].map(t=>t.textContent.trim()),
  quick:!!document.querySelector('[data-testid="auth-fill-admin"]'),
  google:!!document.querySelector('iframe'),
  overflow:document.documentElement.scrollWidth-innerWidth
})));
await p.screenshot({path:'shots/f2-auth.png'});
// sign in and check dash + tabbar
await p.click('[data-testid="auth-fill-admin"]');
await p.type('[data-testid="auth-password"]','VisaHOBe1323@');
await p.click('[data-testid="auth-submit"]');
await p.waitForSelector('.dashstat',{timeout:20000});
await wait(600);
await p.screenshot({path:'shots/f3-dash.png'});
console.log('signed', await p.evaluate(()=>document.querySelector('.h1')?.textContent));
// favicon fetched by the page
const icons=await p.evaluate(()=>[...document.querySelectorAll('link[rel*=icon]')].map(l=>l.getAttribute('href')));
console.log('icon links', icons.join(' , '));
const sw=await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistrations();const c=await caches.keys();return {sw:r.length, caches:c};});
console.log('sw', JSON.stringify(sw));
console.log('errors', errs.slice(0,3));
await b.close();
