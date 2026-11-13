import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE || 'http://127.0.0.1:4192';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
p.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 160)));
await p.setViewport({ width: 1440, height: 950 });
await p.goto(BASE, { waitUntil: 'networkidle0' });
await p.waitForSelector('[data-testid="auth-name"]');
await p.type('[data-testid="auth-name"]', 'Agency Admin');
await p.type('[data-testid="auth-email"]', 'admin@visamotion365.com');
await p.type('[data-testid="auth-password"]', 'pass1234');
for (const t of await p.$$('.authtab')) { const x = await p.evaluate((e) => e.textContent, t); if (x.includes('Agency')) { await t.click(); break; } }
await wait(200);
await p.type('[data-testid="auth-code"]', 'NSPACE-365');
await p.click('[data-testid="auth-submit"]');
await wait(1000);

const routes = ['dashboard', 'chat', 'visa', 'agents', 'automations', 'artifacts', 'memory', 'me', 'download', 'studio'];
const report = {};
for (const r of routes) {
  errors.length = 0;
  await p.evaluate((x) => { location.hash = `#/${x}`; }, r);
  await wait(900);
  const info = await p.evaluate(() => ({
    h1: document.querySelector('.h1')?.textContent || document.querySelector('.h2')?.textContent || '',
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    empty: document.body.innerText.trim().length < 60,
    buttons: document.querySelectorAll('button').length,
  }));
  await p.screenshot({ path: `shots/r-${r}.png` });
  report[r] = { ...info, errors: [...errors] };
}
// mobile sweep
await p.setViewport({ width: 390, height: 844 });
const mob = {};
for (const r of ['dashboard', 'chat', 'visa', 'agents', 'automations', 'artifacts', 'me']) {
  errors.length = 0;
  await p.evaluate((x) => { location.hash = `#/${x}`; }, r);
  await wait(700);
  mob[r] = await p.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    bottomBar: !!document.querySelector('.mobiletabbar'),
  }));
  await p.screenshot({ path: `shots/m-${r}.png` });
  if (errors.length) mob[r].errors = [...errors];
}
console.log(JSON.stringify({ desktop: report, mobile: mob }, null, 2));
await b.close();
