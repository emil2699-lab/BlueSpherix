// Regression checks for zoom, constrained WebGL buffers and flat pseudo layers.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = process.env.GLASS_SELECTION_ARTIFACTS || '/tmp/bluespherix-glass-zoom';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  window.glassProbe = { failAllocation: false, sample: false, control: null, draws: 0 };
  const proto = WebGL2RenderingContext.prototype;
  const get = proto.getUniformLocation, put1 = proto.uniform1f, put2 = proto.uniform2f, put4 = proto.uniform4f, draw = proto.drawArrays;
  const locations = new WeakMap();
  let rect = [], resolution = [], coating = [], dpr = 1;
  proto.getUniformLocation = function (program, name) { const location = get.call(this, program, name); if (location) locations.set(location, name); return location; };
  proto.uniform1f = function (location, value) { if (locations.get(location) === 'uDPR') { dpr = value; window.glassProbe.dpr = value; } return put1.call(this, location, value); };
  proto.uniform2f = function (location, ...values) { if (locations.get(location) === 'uResolution') resolution = values; return put2.call(this, location, ...values); };
  proto.uniform4f = function (location, ...values) { if (locations.get(location) === 'uRect') rect = values; if (locations.get(location) === 'uCoating') coating = values; return put4.call(this, location, ...values); };
  // Model a browser refusing a backing-store allocation, without losing the
  // application or needing a particular device's GPU memory configuration.
  for (const name of ['drawingBufferWidth', 'drawingBufferHeight']) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, name);
    Object.defineProperty(proto, name, { configurable: true, get() { return window.glassProbe.failAllocation ? 0 : descriptor.get.call(this); } });
  }
  proto.drawArrays = function (...args) {
    draw.call(this, ...args); window.glassProbe.draws++;
    if (coating[1] && window.glassProbe.sample) {
      const pixel = new Uint8Array(4);
      this.readPixels(Math.floor((rect[0] + rect[2] / 2) * dpr), Math.floor(this.drawingBufferHeight - (rect[1] + rect[3] / 2) * dpr), 1, 1, this.RGBA, this.UNSIGNED_BYTE, pixel);
      window.glassProbe.control = { rect, resolution, dpr, alpha: pixel[3], error: this.getError() };
      window.glassProbe.sample = false;
    }
  };
});
const url = process.env.GLASS_SELECTION_URL || 'http://127.0.0.1:3001/';
await page.goto(`${url}#risk`);
await page.locator('.content[data-ice-glass=ready]').waitFor();
const cell = page.locator('button.correlation-cell').first();
await cell.click(); await cell.locator('xpath=self::*[@data-glass-selection="selected"]').waitFor();
const material = await cell.evaluate(el => ({ background: getComputedStyle(el).backgroundImage, pseudo: getComputedStyle(el, '::before').backgroundImage, tint: el.style.getPropertyValue('--glass-control-tint') }));
assert.equal(material.background, 'none'); assert.equal(material.pseudo, 'none');
const tint = material.tint.split(' ').map(Number);
assert(tint[0] > tint[1] * 1.5, 'the red pseudo-layer palette transfers to the glass');
await cell.screenshot({ path: `${dir}/correlation-glass.png` });
const samples = [];
async function sample(label) {
  await cell.scrollIntoViewIfNeeded();
  await page.evaluate(() => { window.glassProbe.sample = true; window.dispatchEvent(new Event('resize')); });
  await page.waitForFunction(() => !window.glassProbe.sample);
  const state = await cell.evaluate(el => {
    const canvas = document.querySelector('.ice-glass-canvas'), c = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { ready: document.querySelector('.content').dataset.iceGlass, canvas: [canvas.width, canvas.height], rect: [r.left-c.left, r.top-c.top, r.width, r.height], ...window.glassProbe.control };
  });
  assert.equal(state.ready, 'ready', `${label}: optical material is visible`);
  assert(state.alpha > 0, `${label}: the selected glass reaches the framebuffer`);
  assert.equal(state.error, 0, `${label}: no WebGL error`);
  assert(state.canvas[0] * state.canvas[1] <= 8_388_608, `${label}: bounded physical pixel allocation`);
  assert.deepEqual(state.resolution, state.canvas);
  const alignment = await cell.evaluate(el => {
    const r = el.getBoundingClientRect(), c = document.querySelector('.ice-glass-canvas').getBoundingClientRect();
    return Math.max(...[r.left-c.left, r.top-c.top, r.width, r.height].map((v,i) => Math.abs(v-window.glassProbe.control.rect[i])));
  });
  assert(alignment < .1, `${label}: geometry remains aligned`);
  samples.push({ label, ...state, alignment }); console.log(label, 'checked');
}
await sample('default');
const client = await page.context().newCDPSession(page);
// Page-zoom equivalent: CSS viewport and DPR change together. Also test the
// Safari case in which a large viewport retains a high device pixel ratio.
for (const [label, width, height, deviceScaleFactor] of [
  ['zoom-out', 1920, 1333, .75], ['zoom-in', 960, 667, 1.5],
  ['retina-large-viewport', 1920, 1600, 2], ['default-restored', 1440, 1000, 1],
]) {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
  await sample(label);
}
await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.6 });
await sample('pinch-zoom');
await page.screenshot({ path: `${dir}/pinch-zoom.png` });
await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
// A DPR change with identical CSS dimensions must still repaint at rest.
await page.waitForTimeout(900);
await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1.25, mobile: false });
await page.waitForFunction(() => Math.abs(window.glassProbe.dpr - 1.25) < .001);
// Failed allocation must expose the static glass fallback, never empty cards.
await page.evaluate(() => { window.glassProbe.failAllocation = true; window.dispatchEvent(new Event('resize')); });
await page.locator('.content:not([data-ice-glass=ready])').waitFor();
assert.equal(await page.locator('.ice-glass-canvas').evaluate(el => getComputedStyle(el).visibility), 'hidden');
assert.notEqual(await cell.evaluate(el => getComputedStyle(el).backgroundImage), 'none');
await page.evaluate(() => { window.glassProbe.failAllocation = false; window.dispatchEvent(new Event('resize')); });
await page.locator('.content[data-ice-glass=ready]').waitFor();
await sample('allocation-recovered');
await page.evaluate(() => {
  const gl = document.querySelector('.ice-glass-canvas').getContext('webgl2');
  const get = gl.getParameter.bind(gl);
  gl.getParameter = parameter => parameter === gl.MAX_VIEWPORT_DIMS ? new Int32Array([1024,1024])
    : parameter === gl.MAX_RENDERBUFFER_SIZE || parameter === gl.MAX_TEXTURE_SIZE ? 1024 : get(parameter);
  window.glassLoss = gl.getExtension('WEBGL_lose_context'); window.glassLoss.loseContext();
});
await page.locator('.content:not([data-ice-glass=ready])').waitFor();
await page.waitForTimeout(150); await page.evaluate(() => window.glassLoss.restoreContext());
await page.locator('.content[data-ice-glass=ready]').waitFor();
await sample('context-restored');
assert(samples.at(-1).canvas.every(side => side <= 1024), 'restoration rechecks hardware axis limits');
await page.keyboard.press('Escape');
assert.notEqual(await cell.evaluate(el => getComputedStyle(el, '::before').backgroundImage), 'none', 'flat palette returns on deselection');
assert.equal(await cell.getAttribute('aria-selected'), 'true', 'deselection keeps the functional filter value');
assert.equal(await page.locator('canvas').count(), 1);
assert.deepEqual(errors, []);
await fs.writeFile(`${dir}/zoom.json`, JSON.stringify({ pass: true, material, samples, errors, safariNative: false }, null, 2));
console.log(JSON.stringify({ pass: true, scenarios: samples.length, errors })); await browser.close();
