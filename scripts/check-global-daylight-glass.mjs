import assert from "node:assert/strict";
import fs from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const url = process.env.GLASS_GLOBAL_URL || "http://127.0.0.1:3000/";
const artifacts = process.env.GLASS_GLOBAL_ARTIFACTS || "/tmp/bluespherix-global-glass";
await fs.mkdir(artifacts, { recursive: true });

const views = ["overview", "portfolio", "analytics", "positions", "risk", "lab", "journal", "calendar"];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.globalGlassFrames = [];
    const prototype = WebGL2RenderingContext.prototype;
    const names = new WeakMap();
    const originalLocation = prototype.getUniformLocation;
    prototype.getUniformLocation = function(program, name) {
      const location = originalLocation.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    const state = {};
    for (const method of ["uniform1f", "uniform4f"]) {
      const original = prototype[method];
      prototype[method] = function(location, ...values) {
        state[names.get(location)] = values;
        return original.call(this, location, ...values);
      };
    }
    const originalDraw = prototype.drawArrays;
    prototype.drawArrays = function(...args) {
      if (state.uCoating?.[1] === 1 && state.uCoating?.[2] > 0) {
        window.globalGlassFrames.push({ projection: state.uProjection?.[0] ?? 1, rect: state.uRect });
      }
      return originalDraw.apply(this, args);
    };
  });
  await page.addInitScript(() => localStorage.setItem("bluespherix-theme", "light"));
  await page.goto(`${url}#overview`);
  await page.locator(".content[data-ice-glass=ready]").waitFor();

  const report = {};
  for (const view of views) {
    await page.evaluate(next => { location.hash = next; }, view);
    await page.waitForTimeout(850);
    const surfaces = page.locator(".content :is(.glass-card,.calendar-strip,.demo-notice):visible");
    const surfaceCount = await surfaces.count();
    assert(surfaceCount > 0, `${view} exposes daylight glass surfaces`);

    const labelled = page.locator(".content :is(.glass-card,.calendar-strip,.demo-notice):visible :is([data-glass-label],[data-glass-auto-label])");
    const labelCount = await labelled.count();
    assert(labelCount > 0, `${view} exposes a semantic label plane`);

    const card = surfaces.filter({ has: page.locator(":scope :is([data-glass-label],[data-glass-auto-label])") }).first();
    const label = card.locator(":scope :is([data-glass-label],[data-glass-auto-label])").first();
    const cardBefore = await card.boundingBox();
    const labelBefore = await label.boundingBox();
    await card.hover({ position: { x: Math.min(80, cardBefore.width / 2), y: Math.min(60, cardBefore.height / 2) } });
    await page.waitForFunction(element => Number.parseFloat(getComputedStyle(element).scale) > 1.02,
      await label.elementHandle(), { timeout: 6000 });
    const cardAfter = await card.boundingBox();
    const labelAfter = await label.boundingBox();
    const labelScale = await label.evaluate(element => getComputedStyle(element).scale);
    assert(Math.abs(cardAfter.x-cardBefore.x) < 1.5 && Math.abs(cardAfter.y-cardBefore.y) < 1.5,
      `${view} keeps the semantic card and hit target on the base (${cardBefore.x},${cardBefore.y} -> ${cardAfter.x},${cardAfter.y})`);
    assert(labelAfter.width > labelBefore.width * 1.01 && labelScale !== "none",
      `${view} projects text and controls on the half-height label plane (${labelBefore.width} -> ${labelAfter.width}, scale ${labelScale})`);

    const staticVisual = page.locator(".content :is(.equity-chart,.mini-chart,.allocation-bar,[class*='heatmap'],[class*='orbit'],[class*='ring']):visible").first();
    if (await staticVisual.count()) {
      assert.equal(await staticVisual.getAttribute("data-glass-auto-label"), null,
        `${view} keeps charts and visual data off the label plane`);
    }

    await page.screenshot({ path: `${artifacts}/${view}.png`, fullPage: false });
    report[view] = { surfaceCount, labelCount, labelScale };
    await page.mouse.move(4, 4);
    await page.waitForTimeout(260);
  }

  await page.evaluate(() => { location.hash = "overview"; });
  await page.waitForTimeout(850);
  const nestedControl = page.locator(".position-table .table-row:not(.table-header)").first();
  await nestedControl.scrollIntoViewIfNeeded();
  assert(await nestedControl.evaluate(element => element.closest("[data-glass-label],[data-glass-auto-label]") === null),
    "nested table control deliberately has labels on its children, not on itself");
  await page.evaluate(() => { window.globalGlassFrames = []; });
  await nestedControl.click();
  await nestedControl.locator("xpath=self::*[@data-glass-selection='selected']").waitFor({ timeout: 5000 });
  await page.waitForFunction(() => window.globalGlassFrames.some(frame => frame.projection > 1.02));
  assert(await page.evaluate(() => window.globalGlassFrames.some(frame => frame.projection > 1.02)),
    "a nested selected control follows its host card label plane");

  await page.evaluate(() => { location.hash = "analytics"; });
  await page.waitForTimeout(850);
  const dataCard = page.locator(".instruments-card");
  const dataLabel = dataCard.locator(".instrument-row").first().locator(":scope > div").first();
  const dataTrack = dataCard.locator(".instrument-track").first();
  await dataCard.scrollIntoViewIfNeeded();
  const trackBefore = await dataTrack.boundingBox();
  await dataCard.hover();
  await page.waitForFunction(element => Number.parseFloat(getComputedStyle(element).scale) > 1.02,
    await dataLabel.elementHandle(), { timeout: 6000 });
  const trackAfter = await dataTrack.boundingBox();
  assert(Math.abs(trackAfter.x-trackBefore.x) < .5 && Math.abs(trackAfter.y-trackBefore.y) < .5
    && Math.abs(trackAfter.width-trackBefore.width) < .5 && Math.abs(trackAfter.height-trackBefore.height) < .5,
  "data bars remain fixed on the dashboard plane while their labels lift");

  assert.equal(await page.locator(".ice-glass-canvas").count(), 1, "all views share one WebGL canvas");
  assert.deepEqual(errors, []);
  await fs.writeFile(`${artifacts}/result.json`, JSON.stringify({ pass: true, views: report, errors }, null, 2));
  console.log(JSON.stringify({ pass: true, views: report, errors }));
} finally {
  await browser.close();
}
