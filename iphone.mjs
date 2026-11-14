import puppeteer from 'puppeteer-core';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--user-data-dir=/tmp/ip'+Date.now()]});
const p=await b.newPage();
const errs=[];
p.on('pageerror',e=>errs.push('PE '+String(e).slice(0,140)));
p.on('console',m=>{if(m.type()==='error')errs.push('C '+m.text().slice(0,140));});
p.on('requestfailed',r=>errs.push('FAIL '+r.url().slice(0,90)));
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.goto('https://nspace-six.vercel.app/',{waitUntil:'networkidle0'});
await wait(1500);
console.log('state', JSON.stringify(await p.evaluate(()=>({
  root:document.querySelector('#root')?.children.length,
  welc:!!document.querySelector('.welc'),
  body:(document.body.innerText||'').slice(0,90).replace(/\s+/g,' '),
}))));
await wait(3500);
console.log('after', JSON.stringify(await p.evaluate(()=>({welc:!!document.querySelector('.welc'), auth:!!document.querySelector('.authcard')}))));
console.log('errors', JSON.stringify(errs.slice(0,5)));
await b.close();
