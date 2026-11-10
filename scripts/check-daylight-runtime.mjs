import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const modules = {};
for (const name of ["ice-glass-volume", "ice-glass-shader", "ice-glass-daylight", "ice-glass-daylight-shader", "ice-glass-daylight-renderer"]) {
  const source = await readFile(resolve("app", `${name}.ts`), "utf8");
  modules[`./${name}`] = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="256" height="192"></canvas><svg><defs></defs></svg><div id="card"></div>');
  const results = await page.evaluate(async modules => {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const cache = {};
    const load = name => {
      name = name.replace(/\.ts$/, "");
      if (cache[name]) return cache[name].exports;
      const loadedModule = { exports: {} }; cache[name] = loadedModule;
      new Function("module", "exports", "require", modules[name])(loadedModule, loadedModule.exports, load);
      return loadedModule.exports;
    };
    const { DaylightRenderer, LensFilters } = load("./ice-glass-daylight-renderer");
    const { createLensMaps, LENS_MAP_NEUTRAL } = load("./ice-glass-daylight");
    const gl = document.querySelector("canvas").getContext("webgl2");
    check(gl, "WebGL2 unavailable");
    let draws = 0;
    const draw = gl.drawArrays.bind(gl);
    gl.drawArrays = (...args) => { if (args[2] > 6) draws++; return draw(...args); };
    const scene = [{ left: 16, top: 16, width: 200, height: 140, radius: 18, lift: 0 }];
    const renderer = new DaylightRenderer(gl);
    renderer.update(256,192,1,scene);
    const initial = draws;
    check(initial > 0, "Initial sunlight was not rendered");
    renderer.update(256,192,1,structuredClone(scene));
    check(draws === initial, "Stationary scene redrew caustics");
    for (const property of ["left", "top", "width", "height", "radius", "lift"]) {
      scene[0][property] += property === "lift" ? .5 : 1;
      const before = draws;
      renderer.update(256,192,1,scene);
      check(draws > before, `${property} failed to invalidate irradiance`);
    }
    const beforeDPR = draws;
    renderer.update(512,384,2,scene);
    check(draws > beforeDPR, "DPR failed to invalidate irradiance");
    renderer.dispose(); renderer.dispose();
    check(gl.getError() === 0, "Renderer produced a WebGL error");

    const allocationFailures = [];
    for (const method of ["createTexture", "createFramebuffer", "createProgram", "createShader", "createBuffer", "createVertexArray", "createTransformFeedback"]) {
      const original = gl[method]; gl[method] = () => null;
      let instance, message = "";
      try { instance = new DaylightRenderer(gl); instance.update(256,192,1,scene); }
      catch (error) { message = error.message; }
      finally { gl[method] = original; instance?.dispose(); }
      check(message.includes("unavailable"), `${method} did not enter the fallback`);
      check(gl.getError() === 0, `${method} left a WebGL error`);
      allocationFailures.push(method);
    }

    const shape = { width: 256, height: 160, radius: 18 };
    let minJacobian=Infinity;
    for(const geometry of [shape,{width:354,height:800,radius:18},{width:1130,height:44,radius:14}]) {
    const maps = createLensMaps(geometry);
    check(maps, "Lens maps unavailable");
    const decoded=[];
    for (const src of [maps.baseURL, maps.gapURL]) {
      const image = new Image(); image.src = src; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image,0,0);
      decoded.push({data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height});
      const xs=[Math.floor((canvas.width-1)/2),Math.ceil((canvas.width-1)/2)];
      const ys=[Math.floor((canvas.height-1)/2),Math.ceil((canvas.height-1)/2)];
      for (const channel of [0,1]) {
        let center=0;
        for(const x of xs)for(const y of ys)center+=ctx.getImageData(x,y,1,1).data[channel]/4;
        check(Math.abs(center-128)<.01,"Optical axis is not neutral");
      }
    }
    const {width:mw,height:mh}=decoded[0];
    const displacement=(x,y,c)=>(decoded[0].data[(y*mw+x)*4+c]+decoded[1].data[(y*mw+x)*4+c]-256)/255*maps.scale;
    for(let y=0;y<mh-1;y++)for(let x=0;x<mw-1;x++) {
      const xx=(displacement(x+1,y,0)-displacement(x,y,0))/(maps.width/mw);
      const yx=(displacement(x+1,y,1)-displacement(x,y,1))/(maps.width/mw);
      const xy=(displacement(x,y+1,0)-displacement(x,y,0))/(maps.height/mh);
      const yy=(displacement(x,y+1,1)-displacement(x,y,1))/(maps.height/mh);
      minJacobian=Math.min(minJacobian,(1+xx)*(1+yy)-xy*yx);
    }
    }
    check(minJacobian>.25,"Refraction folds or reverses text near an edge");
    const defs = document.querySelector("defs"), element = document.querySelector("#card");
    const filters = new LensFilters(defs);
    for (const lift of [.1,.5,1]) {
      filters.update(element,shape,lift);
      const mix = defs.querySelector("feComposite");
      const neutral = (Number(mix.getAttribute("k2"))+Number(mix.getAttribute("k3")))*LENS_MAP_NEUTRAL+Number(mix.getAttribute("k4"));
      check(Math.abs(neutral-.5) < .00001, "Combining maps displaced the optical axis");
    }
    check(defs.children.length === 1, "Lens map was recreated during lift");
    filters.update(element,shape,0);
    check(element.style.getPropertyValue("--glass-lens") === "none", "Lens did not reset");
    filters.dispose();
    check(!defs.children.length && !element.style.getPropertyValue("--glass-lens"), "Lens resources leaked");
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind,...args) { return kind === "2d" ? null : getContext.call(this,kind,...args); };
    try {
      const fallback = new LensFilters(defs);
      fallback.update(element,shape,1); fallback.update(element,shape,.5);
      check(!defs.children.length, "Unavailable Canvas2D created a broken lens");
      fallback.dispose();
    } finally { HTMLCanvasElement.prototype.getContext = getContext; }
    return { cachedScene: true, invalidation: true, allocationFailures, neutralAxis: true, canvas2dFallback: true, minJacobian };
  }, modules);
  console.log(JSON.stringify(results));
  await page.close();

  if (process.env.DAYLIGHT_URL) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.addInitScript(() => {
      localStorage.setItem("bluespherix-theme", "light"); window.causticDraws = 0;
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function(mode,start,count) { if(count>6)window.causticDraws++;return draw.call(this,mode,start,count); };
    });
    await page.goto(process.env.DAYLIGHT_URL, { waitUntil: "networkidle" });
    await page.waitForSelector('.content[data-ice-glass="ready"]');
    await page.waitForTimeout(1200);
    const before = await page.evaluate(() => window.causticDraws);
    await page.mouse.move(15,15); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.causticDraws), before, "Stationary dashboard redrew sunlight");
    const card = page.locator(".metric-card").first();
    const box = await card.boundingBox();
    await card.hover(); await page.waitForFunction(() => document.querySelector('.metric-card')?.style.getPropertyValue('--glass-lens').includes('url'));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.mouse.move(15,15); await page.waitForTimeout(300);
    assert.equal(await card.evaluate(el => getComputedStyle(el).filter), "none", "Reduced motion retained refraction");
    assert.equal(await card.evaluate(el => el.style.getPropertyValue("--glass-lens")), "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await card.hover(); await page.waitForTimeout(300);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.waitForFunction(() => document.querySelector('.metric-card')?.style.getPropertyValue('--glass-lens') === 'none');
    assert.deepEqual(await card.boundingBox(), box, "Card moved during refraction");
    assert.equal(await page.locator(".ice-glass-canvas").count(),1);
    assert.equal(await page.locator(".ice-glass-canvas").evaluate(c=>c.getContext("webgl2").getError()),0);
    assert.deepEqual(errors,[]);
    console.log("Dashboard: cached sunlight, live reduced motion, blur reset, stationary content and WebGL passed");
    await page.close();
  }
} finally { await browser.close(); }
