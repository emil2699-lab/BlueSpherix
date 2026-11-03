// Run against a local static preview; optionally set PLAYWRIGHT_MODULE and CHROMIUM_PATH.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const dir=process.env.GLASS_SELECTION_ARTIFACTS || '/tmp/bluespherix-glass-selection';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${process.env.GLASS_SELECTION_URL || 'http://127.0.0.1:3001/'}#journal`);await page.locator('.content[data-ice-glass=ready]').waitFor();
const settled=loc=>loc.locator('xpath=self::*[@data-glass-selection="selected"]').waitFor({timeout:5000});
const cleared=()=>page.waitForFunction(()=>!document.querySelector('[data-glass-selection]:not([data-glass-persistent])'));
const period=page.getByRole('button',{name:'90G',exact:true});await period.click();
await period.locator('xpath=self::*[@data-glass-selection]').waitFor({timeout:2000});
assert.equal(await period.getAttribute('data-glass-selection'),'entering');
await page.screenshot({path:`${dir}/01-coating.png`});
await settled(period);assert.equal(await period.getAttribute('data-glass-selection'),'selected');
assert.equal(await page.locator('[data-glass-selection=selected]:not([data-glass-persistent])').count(),1);
await page.screenshot({path:`${dir}/02-glass.png`});
await page.getByRole('heading',{name:'Diario di trading.'}).click();await cleared();
assert.equal(await page.locator('[data-glass-selection]:not([data-glass-persistent])').count(),0);assert.equal(await period.getAttribute('aria-pressed'),'true');
const negative=page.locator('.diary-loss').first();await negative.click();await settled(negative);
assert.equal(await negative.getAttribute('data-glass-selection'),'selected');
assert.equal(await negative.locator('[data-sign=negative]').count(),1);
await page.screenshot({path:`${dir}/03-negative.png`});
const tag=page.getByRole('button',{name:'Pazienza',exact:true});await tag.click();await settled(tag);assert.equal(await tag.getAttribute('data-glass-selection'),'selected');
await tag.click();await tag.locator('xpath=self::*[not(@data-glass-selection)]').waitFor();assert.equal(await tag.getAttribute('data-glass-selection'),null);
await page.getByRole('button',{name:'30G',exact:true}).focus();await page.keyboard.press('Space');await settled(page.getByRole('button',{name:'30G',exact:true}));assert.equal(await page.getByRole('button',{name:'30G',exact:true}).getAttribute('data-glass-selection'),'selected');
await page.keyboard.press('Escape');await cleared();assert.equal(await page.locator('[data-glass-selection]:not([data-glass-persistent])').count(),0);
await page.locator('.diary-filters .filter-select-control').first().click();await page.getByRole('option',{name:'Da revisionare',exact:true}).click();await settled(page.locator('.diary-filters .filter-select-control').first());
assert.equal(await page.locator('.diary-filters .filter-select-control').first().getAttribute('data-glass-selection'),'selected');
await page.locator('nav').getByRole('button',{name:'Analisi',exact:true}).click();await page.getByRole('button',{name:'90G',exact:true}).click();await settled(page.getByRole('button',{name:'90G',exact:true}));
assert.equal(await page.locator('[data-glass-selection=selected]:not([data-glass-persistent])').count(),1);
const frames=await page.evaluate(()=>new Promise(resolve=>{let last;const times=[];function frame(t){if(last)times.push(t-last);last=t;if(times.length<40)requestAnimationFrame(frame);else {times.sort((a,b)=>a-b);resolve({p50:times[20],p95:times[38]});}}requestAnimationFrame(frame);}));
await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'30G',exact:true}).click();await settled(page.getByRole('button',{name:'30G',exact:true}));
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${dir}/04-mobile.png`});
assert.equal(await page.locator('canvas').count(),1);assert.deepEqual(errors,[]);
const fallback=await browser.newPage({viewport:{width:1024,height:820},reducedMotion:'reduce'});
await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2')return null;return original.call(this,type,...args);};});
await fallback.goto(`${process.env.GLASS_SELECTION_URL || 'http://127.0.0.1:3001/'}#journal`);const f=fallback.getByRole('button',{name:'90G',exact:true});await f.click();await settled(f);assert.equal(await f.getAttribute('data-glass-selection'),'selected');await fallback.getByRole('heading',{name:'Diario di trading.'}).click();await fallback.waitForFunction(()=>!document.querySelector('[data-glass-selection]:not([data-glass-persistent])'));assert.equal(await f.getAttribute('data-glass-selection'),null);
await fs.writeFile(`${dir}/interaction.json`,JSON.stringify({errors,frames,checks:'selection, outside, transfer, negative, toggle, keyboard, Escape, dropdown, navigation, mobile, single canvas, reduced motion, no WebGL'},null,2));await checkCoatingPhases(browser,dir);console.log(JSON.stringify({pass:true,frames,errors}));await browser.close();

async function checkCoatingPhases(browser,dir) {
const p=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{
  window.glassFrames=[];
  const proto=WebGL2RenderingContext.prototype;
  const original=proto.uniform4f;
  const locations=new WeakMap();const get=proto.getUniformLocation;
  proto.getUniformLocation=function(pr,name){const l=get.call(this,pr,name);if(l)locations.set(l,name);return l;};
  proto.uniform4f=function(l,...values){if(locations.get(l)==='uCoating'&&values[1])window.glassFrames.push({time:performance.now(),values});return original.call(this,l,...values);};
});
await p.goto(`${process.env.GLASS_SELECTION_URL || 'http://127.0.0.1:3001/'}#journal`);await p.locator('.content[data-ice-glass=ready]').waitFor();await p.waitForTimeout(1200);
await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+100));
const period=p.getByRole('button',{name:'90G',exact:true});const box=await period.boundingBox();
await period.click({position:{x:box.width*.2,y:box.height*.25}});await p.clock.runFor(120);
let state=await period.evaluate(el=>({phase:el.dataset.glassSelection,x:el.style.getPropertyValue('--glass-origin-x'),y:el.style.getPropertyValue('--glass-origin-y'),tint:el.style.getPropertyValue('--glass-control-tint'),border:getComputedStyle(el).borderColor,shadow:getComputedStyle(el).boxShadow}));
assert.equal(state.phase,'entering');assert(Math.abs(parseFloat(state.x)-20)<2);assert(Math.abs(parseFloat(state.y)-25)<5);assert.equal(state.shadow,'none');assert(state.border.includes('0)'));
await p.screenshot({path:`${dir}/01-spreading.png`});
await p.clock.runFor(200);assert.equal(await period.getAttribute('data-glass-selection'),'lifting');await p.screenshot({path:`${dir}/02-lifting.png`});
await p.clock.fastForward(400);assert.equal(await period.getAttribute('data-glass-selection'),'selected');await p.screenshot({path:`${dir}/03-convex.png`});
const frames=await p.evaluate(()=>window.glassFrames);assert(frames.some(f=>f.values[0]>0&&f.values[0]<1&&f.values[3]===0));assert(frames.some(f=>f.values[0]===1&&f.values[3]>0&&f.values[3]<1));assert(frames.some(f=>f.values[3]===1));
await p.getByRole('heading',{name:'Diario di trading.'}).click();await p.clock.runFor(300);
const neg=p.locator('.diary-loss').first();await neg.click();await p.clock.runFor(2);await p.clock.fastForward(800);const negative=await neg.evaluate(el=>({tint:el.style.getPropertyValue('--glass-control-tint'),border:getComputedStyle(el).borderColor,shadow:getComputedStyle(el).boxShadow}));assert(negative.tint.split(' ').map(Number)[0]>negative.tint.split(' ').map(Number)[1]*1.5);assert.equal(negative.shadow,'none');await p.screenshot({path:`${dir}/04-red-glass.png`});
const check=p.locator('.diary-checks label').first();await check.click();await p.clock.runFor(120);assert.equal(await check.getAttribute('data-glass-selection'),'entering');await p.clock.runFor(200);assert.equal(await check.getAttribute('data-glass-selection'),'lifting');await p.clock.fastForward(400);assert.equal(await check.getAttribute('data-glass-selection'),'selected');await check.click();await p.clock.runFor(300);assert.equal(await check.getAttribute('data-glass-selection'),null);
await p.locator('nav').getByRole('button',{name:/^Lab/}).click();await p.clock.fastForward(1000);const lab=p.locator('.lab-experiments button').nth(1);await lab.click();await p.clock.runFor(2);await p.clock.fastForward(800);const violet=await lab.evaluate(el=>el.style.getPropertyValue('--glass-control-tint'));const rgb=violet.split(' ').map(Number);assert(rgb[2]>rgb[1]*1.4);await p.screenshot({path:`${dir}/05-violet-glass.png`});
assert.equal(await p.locator('canvas').count(),1);assert.deepEqual(errors,[]);
await fs.writeFile(`${dir}/phases.json`,JSON.stringify({state,negative,violet,frames,errors},null,2));await p.close();

}
