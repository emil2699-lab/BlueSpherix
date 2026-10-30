import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    resolve(process.cwd(), "node_modules/playwright"),
    "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {}
  }
  throw new Error("Playwright non trovato. Installa playwright o imposta PLAYWRIGHT_MODULE.");
}

function argsFrom(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    if (key) result[key] = argv[index + 1];
  }
  return result;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] || 0;
}

const args = argsFrom(process.argv.slice(2));
const url = args.url;
if (!url) throw new Error("Parametro richiesto: --url");
const outDir = resolve(args.out || "/tmp/visual-glass-testing");
const [width, height] = (args.viewport || "1440x1000").split("x").map(Number);
if (!width || !height) throw new Error("Formato viewport non valido; usa LARGHEZZAxALTEZZA");

await mkdir(outDir, { recursive: true });
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

const consoleMessages = [];
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.setDefaultTimeout(15_000);
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) {
    consoleMessages.push({ type: message.type(), text: message.text() });
  }
});
page.on("pageerror", (error) => consoleMessages.push({ type: "pageerror", text: error.message }));

try {
  await page.addInitScript(() => {
    window.__visualGlassPointer = null;
    window.__visualGlassLongTasks = [];
    addEventListener("pointermove", (event) => {
      window.__visualGlassPointer = { x: event.clientX, y: event.clientY, timeStamp: event.timeStamp };
    }, { passive: true });
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          window.__visualGlassLongTasks.push(...list.getEntries().map((entry) => entry.duration));
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {}
    }
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready);
  const meaningfulText = (await page.locator("body").innerText()).trim();
  if (meaningfulText.length < 20) throw new Error("La pagina non contiene contenuto significativo");
  await page.evaluate(() => { window.__visualGlassLongTasks = []; });

  const positions = [
    { x: Math.round(width * 0.22), y: Math.round(height * 0.32) },
    { x: Math.round(width * 0.52), y: Math.round(height * 0.55) },
    { x: Math.round(width * 0.82), y: Math.round(height * 0.74) },
  ];
  const captures = [];
  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    await page.mouse.move(position.x, position.y);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done())));
    const observed = await page.evaluate(() => window.__visualGlassPointer);
    const file = resolve(outDir, `cursor-${String(index + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: file, fullPage: false, animations: "disabled" });
    captures.push({ requested: position, observed, file });
  }

  await page.evaluate(() => {
    window.__visualGlassFramePromise = new Promise((done) => {
      const samples = [];
      let previous = performance.now();
      const start = previous;
      const tick = (now) => {
        samples.push(now - previous);
        previous = now;
        if (now - start >= 1000) done(samples);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });
  for (let step = 0; step <= 24; step += 1) {
    const progress = step / 24;
    await page.mouse.move(
      Math.round(width * (0.12 + progress * 0.76)),
      Math.round(height * (0.24 + Math.sin(progress * Math.PI) * 0.48)),
    );
    await page.waitForTimeout(24);
  }
  const frameTimes = await page.evaluate(() => window.__visualGlassFramePromise);
  const longTasks = await page.evaluate(() => window.__visualGlassLongTasks || []);
  const manifest = {
    url: page.url(),
    title: await page.title(),
    viewport: { width, height, deviceScaleFactor: 1 },
    userAgent: await page.evaluate(() => navigator.userAgent),
    captures,
    consoleMessages,
    performance: {
      frames: frameTimes.length,
      frameTimeP50Ms: Number(percentile(frameTimes, 0.5).toFixed(2)),
      frameTimeP95Ms: Number(percentile(frameTimes, 0.95).toFixed(2)),
      slowFramesOver25Ms: frameTimes.filter((value) => value > 25).length,
      longTasksOver50Ms: longTasks.filter((value) => value >= 50).length,
    },
  };
  await writeFile(resolve(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, outDir, ...manifest.performance }, null, 2));
  if (consoleMessages.some((message) => ["error", "pageerror"].includes(message.type))) process.exitCode = 2;
} finally {
  await browser.close();
}
