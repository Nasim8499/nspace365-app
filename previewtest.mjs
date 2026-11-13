import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 140)));
await p.setViewport({ width: 1440, height: 950 });
await p.goto(BASE, { waitUntil: 'networkidle0' });
await p.waitForSelector('[data-testid="auth-name"]');
await p.type('[data-testid="auth-name"]', 'Preview Tester');
await p.type('[data-testid="auth-email"]', 'preview@nspace.app');
await p.type('[data-testid="auth-password"]', 'pass1234');
await p.click('[data-testid="auth-submit"]');
await p.waitForSelector('.dashstat');

await p.evaluate(() => { location.hash = '#/agents'; });
await wait(900);
const count = await p.evaluate(() => document.querySelectorAll('[data-testid="preview-agent"]').length);
console.log('preview buttons', count);
await p.evaluate(() => document.querySelector('[data-testid="preview-agent"]').click());
await p.waitForSelector('[data-testid="agent-preview"]');
await wait(400);
console.log('modal', await p.evaluate(() => ({ open: !!document.querySelector('[data-testid="agent-preview"]'), skills: document.querySelectorAll('.apskills .badge').length, prompt: (document.querySelector('.apprompt')?.textContent || '').slice(0, 60) })));
await p.evaluate(() => document.querySelector('.apchips .chip').click());
let txt = '';
for (let i = 0; i < 50; i++) {
  await wait(300);
  txt = await p.evaluate(() => document.querySelector('[data-testid="ap-answer"]')?.innerText || '');
  if (txt.length > 220) break;
}
console.log('streamed', { chars: txt.length, head: txt.slice(0, 90) });
await p.screenshot({ path: 'shots/41-agent-preview.png' });

// visible visa agent skills
await p.evaluate(() => document.querySelector('.apskills')?.scrollIntoView());
await wait(200);
await p.screenshot({ path: 'shots/42-agent-preview-visa.png' });

// mobile /me overflow recheck
await p.setViewport({ width: 390, height: 844 });
await p.evaluate(() => { location.hash = '#/me'; });
await wait(800);
console.log('mobile me', await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 2, scrollW: document.documentElement.scrollWidth })));
await p.screenshot({ path: 'shots/43-mobile-me.png' });
await p.evaluate(() => { location.hash = '#/dashboard'; });
await wait(600);
await p.screenshot({ path: 'shots/44-mobile-dashboard2.png' });
console.log('errors', errs);
await b.close();
