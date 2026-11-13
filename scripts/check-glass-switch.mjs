import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const motionSource = ts.transpileModule(await fs.readFile(new URL('../app/glass-switch-motion.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { switchRect, switchRecoil, SWITCH_MOTION_MS } = await import(`data:text/javascript;base64,${Buffer.from(motionSource).toString('base64')}`);
const target={left:160,top:40,width:40,height:32},travel={x:-120,y:0,width:40,height:32};
assert.deepEqual(switchRect(target,travel,0),{left:40,top:40,width:40,height:32,right:80,bottom:72});
assert(switchRect(target,travel,150).width>target.width*1.4);
assert(switchRecoil(380)>0&&switchRecoil(500)<0);
assert.deepEqual(switchRect(target,travel,SWITCH_MOTION_MS),{...target,right:200,bottom:72});
for(let t=0;t<=SWITCH_MOTION_MS;t++) {
  const rect=switchRect(target,travel,t);assert(Object.values(rect).every(Number.isFinite));assert(rect.width>0&&rect.height>0);
  if(t) {const old=switchRect(target,travel,t-1);assert(Math.abs(rect.left-old.left)<2&&Math.abs(rect.width-old.width)<1);}
}

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.GLASS_SELECTION_ARTIFACTS||'/tmp/bluespherix-glass-switch';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1024,height:820},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.switchFrames=[];const proto=WebGL2RenderingContext.prototype,names=new WeakMap(),get=proto.getUniformLocation;
    proto.getUniformLocation=function(p,n){const l=get.call(this,p,n);if(l)names.set(l,n);return l;};
    const state={};
    for(const key of ['uniform1f','uniform3f','uniform4f']){const original=proto[key];proto[key]=function(location,...values){state[names.get(location)]=values;return original.call(this,location,...values);};}
    const draw=proto.drawArrays;proto.drawArrays=function(...args){if(state.uControlBrightness?.[0]===1.5)window.switchFrames.push({time:performance.now(),rect:state.uRect,projection:state.uProjection,coating:state.uCoating,switchGlass:state.uSwitchGlass,tint:state.uTint});return draw.apply(this,args);};
  });
  const url=process.env.GLASS_SELECTION_URL||'http://127.0.0.1:3001/';
  await page.addInitScript(()=>localStorage.setItem('bluespherix-theme','light'));
  await page.goto(`${url}#overview`);await page.locator('.content[data-ice-glass=ready]').waitFor();
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
  const advance=async ms=>{await page.clock.runFor(2);await page.clock.fastForward(ms);await page.clock.runFor(2);};
  const oneMonth=page.getByRole('button',{name:'1M',exact:true});await oneMonth.click({force:true});await advance(920);
  assert.equal(await oneMonth.getAttribute('data-glass-selection'),'selected');
  const neutralFrames=await page.evaluate(()=>window.switchFrames);
  assert(neutralFrames.some(f=>f.switchGlass?.[0]===1),'selected switch receives the polished theme glass');
  const destination=page.getByRole('button',{name:'1Y',exact:true});await destination.hover();await advance(500);
  const box=await destination.boundingBox(),layoutWidth=await destination.evaluate(el=>el.offsetWidth);await page.evaluate(()=>{window.switchFrames=[];});
  await destination.click({force:true});await advance(150);
  await page.screenshot({path:`${dir}/selector-stretched.png`});
  await advance(230);await page.screenshot({path:`${dir}/selector-recoil.png`});
  await advance(340);await page.screenshot({path:`${dir}/selector-rest.png`});
  assert.equal(await destination.getAttribute('data-glass-selection'),'selected');
  const frames=await page.evaluate(()=>window.switchFrames);
  assert(frames.some(f=>f.rect[2]*(f.projection?.[0]??1)>box.width*1.2),'glass stretches between options');
  const rest=frames.at(-1),scale=rest.projection?.[0]??1;
  const rendered={left:rest.rect[0]-rest.rect[2]*(scale-1)*.5,top:rest.rect[1]-rest.rect[3]*(scale-1)*.5,width:rest.rect[2]*scale,height:rest.rect[3]*scale};
  const canvasBox=await page.locator('.ice-glass-canvas').boundingBox();
  assert(Math.abs(rendered.width-box.width)<.1,'glass returns to the projected control width');
  assert(Math.abs(rendered.left-(box.x-canvasBox.x))<1.5&&Math.abs(rendered.top-(box.y-canvasBox.y))<1.5,'glass follows the lifted card label plane');
  assert.equal(await destination.evaluate(el=>el.offsetWidth),layoutWidth,'text and hit target keep their layout width');
  await page.locator('.welcome h1:visible').click({force:true});await advance(240);
  assert.equal(await destination.getAttribute('data-glass-selection'),null);
  await page.getByRole('button',{name:'Attiva modalità scura'}).click();await advance(700);
  await page.evaluate(()=>{location.hash='risk';});await advance(800);
  const toggle=page.locator('.protection-switch').first(),thumb=toggle.locator('.glass-switch-thumb');
  assert.equal(await page.locator('.glass-switch-thumb').count(),4);
  await toggle.click({force:true});await advance(10);
  assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  const mid=await thumb.evaluate(el=>{const a=el.getAnimations()[0];if(!a)return null;a.pause();a.currentTime=145;const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});
  assert(mid&&mid.width>22,'on/off thumb stretches in its travel direction');
  await advance(20);await page.screenshot({path:`${dir}/switch-stretched.png`});
  await thumb.evaluate(el=>{for(const a of el.getAnimations())a.finish();});await advance(700);
  assert(Math.abs((await thumb.boundingBox()).width-18)<.1);
  await toggle.focus();await page.keyboard.press('Space');await advance(10);assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  assert(await thumb.evaluate(el=>el.getAnimations().length)>0,'keyboard starts the same motion');
  await page.clock.resume();await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion: reduce)').matches && document.querySelector('.protection-switch .glass-switch-thumb').getAnimations().length===0);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));
  await page.locator('.welcome h1:visible').click({force:true});await page.keyboard.press('Escape');await advance(20);
  assert.equal(await page.locator('.protection-switch[data-glass-persistent]').count(),4,'independent on switches keep glass');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{location.hash='lab';});await advance(800);
  const sampleGroup=page.locator('.lab-controls .range-switch').first();
  if(await sampleGroup.getAttribute('data-glass-multiple')!==null) {
    const optionName=await sampleGroup.locator('button[aria-pressed="false"]').first().textContent();
    const option=sampleGroup.getByRole('button',{name:optionName,exact:true});
    await option.click({force:true});await advance(120);
    assert.equal(await sampleGroup.locator('[data-glass-selection]').count(),1,'persistent selector transfers one glass surface');
    await advance(600);await page.locator('.welcome h1:visible').click({force:true});await page.keyboard.press('Escape');await advance(20);
    assert.equal(await option.getAttribute('data-glass-selection'),'selected','Lab active choices retain glass after outside and Escape');
  }
  const costs=page.locator('.lab-cost-toggle'),input=costs.locator('input'),costThumb=costs.locator('.glass-switch-thumb');
  const before=await input.isChecked();await input.focus();await page.keyboard.press('Space');await advance(20);assert.equal(await input.isChecked(),!before);
  assert.equal(await costThumb.evaluate(el=>el.getAnimations().length),0,'reduced motion is immediate');
  await page.clock.resume();await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));await input.focus();await page.keyboard.press('Space');await advance(10);
  assert(await costThumb.evaluate(el=>el.getAnimations().length)>0,'Lab keyboard switch has the same elastic animation');
  await costThumb.evaluate(el=>{for(const a of el.getAnimations())a.finish();});await advance(800);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.locator('canvas').count(),1);assert.deepEqual(errors,[]);
  await page.screenshot({path:`${dir}/mobile-switch.png`});
  const fallback=await browser.newPage({viewport:{width:1024,height:820},reducedMotion:'reduce'});
  await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return t==='webgl2'?null:get.call(this,t,...args);};});
  await fallback.goto(`${url}#lab`);const f=fallback.locator('.lab-cost-toggle input');await f.focus();const checked=await f.isChecked();await fallback.keyboard.press('Space');assert.equal(await f.isChecked(),!checked);
  assert.notEqual(await fallback.locator('.glass-switch-thumb').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
  const report={pass:true,errors,frameCount:frames.length,checks:'directional stretch, recoil, exact rest, stable labels, outside, on/off, keyboard, independent switches, reduced motion, mobile, no WebGL, single canvas'};
  await fs.writeFile(`${dir}/result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
