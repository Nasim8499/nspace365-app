import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
const errs=[];
p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));});
p.on('pageerror',e=>errs.push('PAGEERROR '+String(e).slice(0,160)));
await p.setViewport({width:1280,height:1000,deviceScaleFactor:2});
await p.goto(URL,{waitUntil:'networkidle0'});
await wait(2500);
// is the real Google button rendered by GIS?
const g = await p.evaluate(()=>{
  const holder=document.querySelector('div[data-testid="google-holder"]');
  const iframe=document.querySelector('iframe[src*="accounts.google.com"]');
  return { iframes: document.querySelectorAll('iframe').length, gsiLoaded: !!window.google?.accounts?.id, gbtnChildren: (document.querySelector('.authcard')?.querySelectorAll('div[aria-labelledby], div[role="button"]')||[]).length };
});
console.log('google widget', g);
await p.screenshot({path:'shots/G1-auth.png'});
// default admin login
await p.type('[data-testid="auth-email"]','visamotion365@gmail.com');
await p.type('[data-testid="auth-password"]','VisaHOBe1323@');
for(const t of await p.$$('.authtab')){const x=await p.evaluate(e=>e.textContent,t); if(x.includes('Agency')){await t.click();break;}}
await p.click('[data-testid="auth-submit"]');
await p.waitForSelector('.dashstat',{timeout:20000});
console.log('admin', await p.evaluate(()=>({h1:document.querySelector('.h1')?.textContent, role:document.querySelector('.rolechip')?.textContent, email:document.querySelector('.rolechip')?.getAttribute('title')})));
await p.screenshot({path:'shots/G2-admin.png'});
// privacy + terms
await p.goto(URL+'/privacy',{waitUntil:'networkidle0'});
console.log('privacy', await p.evaluate(()=>({h1:document.querySelector('.h1')?.textContent, sections:document.querySelectorAll('.legalcard section').length})));
await p.screenshot({path:'shots/G3-privacy.png'});
await p.goto(URL+'/terms',{waitUntil:'networkidle0'});
console.log('terms', await p.evaluate(()=>document.querySelector('.h1')?.textContent));
console.log('errors',errs.slice(0,5));
await b.close();
