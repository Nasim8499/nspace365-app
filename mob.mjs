import puppeteer from 'puppeteer-core';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.goto('https://nspace-six.vercel.app',{waitUntil:'domcontentloaded'});
const snap=()=>p.evaluate(()=>{
  const q=(s)=>document.querySelector(s);
  const op=(e)=>e?getComputedStyle(e).opacity:'-';
  const card=q('.welc-inner');
  const rect=card?card.getBoundingClientRect():null;
  const btn=q('.welc-go');
  const br=btn?btn.getBoundingClientRect():null;
  return {brand:op(q('.welc-brand')),tile:op(q('.welc-tile')),cta:op(q('.welc-cta')),
    cardH:Math.round(rect?rect.height:0),cardBottom:Math.round(rect?rect.bottom:0),vh:innerHeight,
    btnInView:br?br.bottom<=innerHeight:false};
});
for (const t of [700,900,1000]) { await wait(t); console.log('t+'+(t), JSON.stringify(await snap())); }
await p.screenshot({path:'shots/M1.png'});
await wait(2600);
console.log('after', JSON.stringify(await p.evaluate(()=>({welc:!!document.querySelector('.welc'),auth:!!document.querySelector('.authcard'),gsi:!!document.querySelector('iframe')}))));
await p.screenshot({path:'shots/M3-auth.png'});
await b.close();
