import puppeteer from 'puppeteer-core';
const URL = 'https://nspace-six.vercel.app';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 140)));
await p.setViewport({ width: 1440, height: 950, deviceScaleFactor: 2 });
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.waitForSelector('[data-testid="auth-name"]');
await p.screenshot({ path: 'shots/L1-auth.png' });
await p.type('[data-testid="auth-name"]', 'Agency Admin');
await p.type('[data-testid="auth-email"]', 'admin@visamotion365.com');
await p.type('[data-testid="auth-password"]', 'pass1234');
for (const t of await p.$$('.authtab')) { const x = await p.evaluate((e) => e.textContent, t); if (x.includes('Agency')) { await t.click(); break; } }
await wait(200);
await p.type('[data-testid="auth-code"]', 'NSPACE-365');
await p.click('[data-testid="auth-submit"]');
await p.waitForSelector('.dashstat', { timeout: 15000 });
console.log('dashboard', await p.evaluate(() => ({ h1: document.querySelector('.h1')?.textContent, role: document.querySelector('.rolechip')?.textContent })));
await p.screenshot({ path: 'shots/L2-dashboard.png' });

// agent preview streaming on the live site
await p.evaluate(() => { location.hash = '#/agents'; });
await wait(1200);
await p.evaluate(() => document.querySelector('[data-testid="preview-agent"]').click());
await p.waitForSelector('[data-testid="agent-preview"]');
await p.evaluate(() => document.querySelector('.apchips .chip').click());
let txt = '';
for (let i = 0; i < 50; i++) { await wait(300); txt = await p.evaluate(() => document.querySelector('[data-testid="ap-answer"]')?.innerText || ''); if (txt.length > 260) break; }
console.log('live preview stream', { chars: txt.length, head: txt.slice(0, 70) });
await p.screenshot({ path: 'shots/L3-agent-preview.png' });

// visa page basic
await p.evaluate(() => { location.hash = '#/visa'; });
await wait(1000);
console.log('visa', await p.evaluate(() => ({ h1: document.querySelector('.h1')?.textContent, buttons: document.querySelectorAll('button').length })));
await p.screenshot({ path: 'shots/L4-visa.png' });

// mobile
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.evaluate(() => { location.hash = '#/dashboard'; });
await wait(800);
console.log('mobile', await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 2 })));
await p.screenshot({ path: 'shots/L5-mobile.png' });
console.log('errors', errs);
await b.close();
