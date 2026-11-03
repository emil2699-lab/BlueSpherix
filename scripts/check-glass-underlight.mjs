import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = process.env.GLASS_SELECTION_ARTIFACTS || '/tmp/bluespherix-underlight';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const instrument = () => {
  window.underlightFrames = [];
  const proto = WebGL2RenderingContext.prototype;
  const get = proto.getUniformLocation, put = proto.uniform2f, put4 = proto.uniform4f, draw = proto.drawArrays;
  const locations = new WeakMap(); let underlight = [0, 0], spill = [0,0,0,0], rect = [0,0,0,0];
  proto.getUniformLocation = function (program, name) { const l = get.call(this, program, name); if (l) locations.set(l, name); return l; };
  proto.uniform2f = function (location, ...values) { if (locations.get(location) === 'uUnderlight') underlight = values; return put.call(this, location, ...values); };
  proto.uniform4f = function(location,...values) { if(locations.get(location)==='uSpill') spill=values; if(locations.get(location)==='uRect') rect=values; return put4.call(this,location,...values); };
  proto.drawArrays = function (...args) { window.underlightFrames.push({ time: performance.now(), values: [...underlight], spill: [...spill], rect: [...rect] }); return draw.call(this, ...args); };
};
await page.addInitScript(instrument); page.on('pageerror', e => errors.push(e.message));
const url = process.env.GLASS_SELECTION_URL || 'http://127.0.0.1:3001/';
await page.goto(`${url}#overview`); await page.locator('.content[data-ice-glass=ready]').waitFor();
// Freeze unrelated CSS hover/layout transitions for comparable light-only frames.
await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important;}' });
await page.waitForTimeout(1000); await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 100));
const step = async ms => { await page.clock.fastForward(ms); await page.clock.runFor(50); };
const negative = page.locator('.position-table button.negative-row');
await negative.click(); await page.clock.runFor(2); await step(1000);
await page.mouse.move(260, 90); await step(500);
await page.screenshot({ path: `${dir}/red-00.png` });
await step(7000); await page.screenshot({ path: `${dir}/red-07.png` });
await step(7000); await page.screenshot({ path: `${dir}/red-14.png` });
const active = await page.evaluate(() => window.underlightFrames.filter(f => f.values[0] > 0));
const expected = Number(await negative.getAttribute('data-glass-underlight'));
assert(expected >= .25 && expected <= 1);
assert(active.every(f=>Math.abs(f.values[0]-expected)<1e-6),'negative P&L ceiling reaches shader');
assert(active.length > 2); assert(active.at(-1).values[1] - active[0].values[1] > 12);
for (const delta of [-160, 160]) {
  await page.evaluate(y => { window.underlightFrames = []; window.scrollBy(0,y); }, delta); await step(200);
  const alignment = await negative.evaluate(el => {
    const row=el.getBoundingClientRect(),canvas=document.querySelector('.ice-glass-canvas').getBoundingClientRect();
    const frame=window.underlightFrames.findLast(f=>f.values[0]>0);
    return frame ? Math.max(Math.abs(frame.rect[0]-(row.left-canvas.left)),Math.abs(frame.rect[1]-(row.top-canvas.top)),Math.abs(frame.rect[2]-row.width),Math.abs(frame.rect[3]-row.height)) : Infinity;
  });
  assert(alignment < .1, 'underlight and curved rim remain attached during scrolling');
}
// Other position ceilings are read from their own numerical result, not labels.
for (const row of await page.locator('.position-table button.table-row').all()) {
  await row.click(); await page.clock.runFor(2); await step(1000);
  await page.evaluate(()=>{window.underlightFrames=[];}); await step(100);
  const ceiling=Number(await row.getAttribute('data-glass-underlight'));
  assert(await page.evaluate(v=>window.underlightFrames.some(f=>Math.abs(f.values[0]-v)<1e-6),ceiling));
}
// A full-strength neutral control can illuminate neighbouring card rims.
await page.getByRole('button',{name:'3M',exact:true}).click(); await page.clock.runFor(2); await step(1000);
assert(await page.evaluate(()=>window.underlightFrames.some(f=>f.spill[0]===1 && f.spill[3]===1)),'neighbour receivers use selected emitter');
await page.screenshot({path:`${dir}/neighbour-rims.png`});
await step(7000); await page.screenshot({path:`${dir}/neighbour-rims-07.png`});
await step(7000); await page.screenshot({path:`${dir}/neighbour-rims-14.png`});
await page.keyboard.press('Escape'); await step(1000); await step(1000);
await page.evaluate(() => { window.underlightFrames = []; }); await page.clock.runFor(200);
assert.equal(await page.evaluate(() => window.underlightFrames.length), 0, 'no idle animation after deselection');
const sections = [
  ['Portafoglio', '[aria-label="Filtra conti"] button'],
  ['Analisi', '.analytics-period button'],
  ['Operazioni', '[aria-label="Periodo operazioni"] button'],
  ['Rischio', '.stress-tabs button'],
  ['Lab', '.lab-experiments button'],
  ['Diario', '[aria-label="Periodo diario"] button'],
];
for (const [name, selector] of sections) {
  await page.locator('nav').getByRole('button', { name: name === 'Lab' ? /^Lab/ : name, exact: true }).click(); await step(1200);
  await page.evaluate(() => { window.underlightFrames = []; });
  await page.mouse.move(500, 100); await step(200);
  assert(await page.evaluate(() => window.underlightFrames.every(f => f.values[0] === 0 && f.spill[3] === 0)), `${name}: navigation clears the old emitter`);
  await page.locator(selector).first().click(); await page.clock.runFor(2); await step(1000);
  await page.evaluate(() => { window.underlightFrames = []; }); await step(200);
  assert(await page.evaluate(() => window.underlightFrames.some(f => f.values[0] === 1)), `${name}: selected control emits`);
  assert(await page.evaluate(() => window.underlightFrames.some(f => f.spill[0] === 1 && f.spill[3] === 1)), `${name}: neighbouring cards receive light`);
  await page.screenshot({ path: `${dir}/${name.toLowerCase()}.png` });
  // Financial rows keep the same P&L ceiling in every view that displays them.
  const rows = page.locator('[data-glass-underlight]:visible');
  if (await rows.count()) {
    const row = rows.first(); await row.click(); await page.clock.runFor(2); await step(1000);
    await page.evaluate(() => { window.underlightFrames = []; }); await step(200);
    const ceiling = Number(await row.getAttribute('data-glass-underlight'));
    assert(await page.evaluate(v => window.underlightFrames.some(f => Math.abs(f.values[0] - v) < 1e-6), ceiling), `${name}: P&L ceiling reaches shader`);
  }
  await page.keyboard.press('Escape'); await step(1000); await step(1000);
  await page.evaluate(() => { window.underlightFrames = []; }); await page.clock.runFor(200);
  assert.equal(await page.evaluate(() => window.underlightFrames.length), 0, `${name}: no idle animation after deselection`);
}
assert.equal(await page.locator('canvas').count(), 1);
const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await reduced.addInitScript(instrument); reduced.on('pageerror', e => errors.push(e.message));
await reduced.goto(`${url}#overview`); await reduced.locator('.content[data-ice-glass=ready]').waitFor();
await reduced.getByRole('button', { name: '3M', exact: true }).click(); await reduced.waitForTimeout(1000);
assert(await reduced.evaluate(() => window.underlightFrames.some(f => f.values[0] === 1)));
assert(await reduced.evaluate(() => window.underlightFrames.every(f => f.values[1] === 0)), 'reduced motion freezes light');
assert(await reduced.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await reduced.screenshot({ path: `${dir}/mobile-reduced.png` });
await reduced.locator('nav').getByRole('button', { name: 'Diario', exact: true }).evaluate(button => button.click());
await reduced.getByRole('button', { name: '90G', exact: true }).click(); await reduced.waitForTimeout(1000);
assert(await reduced.evaluate(() => window.underlightFrames.some(f => f.values[0] === 1)), 'mobile journal emits');
assert(await reduced.evaluate(() => window.underlightFrames.every(f => f.values[1] === 0)), 'all sections respect reduced motion');
await reduced.screenshot({ path: `${dir}/mobile-journal-reduced.png` });
assert.deepEqual(errors, []);
await fs.writeFile(`${dir}/browser.json`, JSON.stringify({ pass: true, errors, active, checks: 'slow time evolution, red glass, stops on deselection, all seven sections, navigation reset, P&L ceiling across views, reduced motion, mobile, single canvas' }, null, 2));
console.log(JSON.stringify({ pass: true, errors, samples: active.length })); await browser.close();
