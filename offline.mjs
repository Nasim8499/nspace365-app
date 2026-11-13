import puppeteer from 'puppeteer-core';
const URL='https://nspace-six.vercel.app';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--user-data-dir=/tmp/r'+Date.now()]});
const p=await b.newPage();
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(URL,{waitUntil:'networkidle0'});
await wait(2500);
const reg=await p.evaluate(async()=>{
  const r=await navigator.serviceWorker.getRegistrations();
  const m=await fetch('/manifest.webmanifest').then(x=>x.json()).catch(()=>null);
  return {sw:r.length, scope:r[0]?.scope, manifest:{name:m?.name, icons:m?.icons?.length, display:m?.display}};
});
console.log('pwa', JSON.stringify(reg));
// offline reload
await p.setOfflineMode(true);
try{
  await p.reload({waitUntil:'domcontentloaded',timeout:20000});
  await wait(2000);
  console.log('offline render', await p.evaluate(()=>({root:document.querySelector('#root')?.children.length, welc:!!document.querySelector('.welc'), text:(document.body.innerText||'').slice(0,80).replace(/\n/g,' ')})));
  await p.screenshot({path:'shots/p-offline.png'});
}catch(e){ console.log('offline failed', String(e).slice(0,90)); }
await p.setOfflineMode(false);
await b.close();
