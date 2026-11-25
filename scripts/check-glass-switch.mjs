import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { importTestAccount } from './mt5-test-fixture.mjs';
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
  await importTestAccount(page, url);
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
  assert.equal(await destination.getAttribute('data-glass-selection'),'selected','exclusive switch keeps glass after outside click');
  assert.notEqual(await destination.getAttribute('data-glass-persistent'),null);
  await page.clock.resume();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'3M',exact:true}).focus();
  await page.keyboard.press('Space');
  assert.equal(await page.getByRole('button',{name:'3M',exact:true}).getAttribute('aria-pressed'),'true');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.locator('canvas').count(),1);assert.deepEqual(errors,[]);
  await page.screenshot({path:`${dir}/mobile-switch.png`});
  const fallback=await browser.newPage({viewport:{width:1024,height:820},reducedMotion:'reduce'});
  await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return t==='webgl2'?null:get.call(this,t,...args);};});
  await importTestAccount(fallback, url);
  await fallback.goto(`${url}#overview`);
  const selector=fallback.getByRole('button',{name:'1Y',exact:true});
  await selector.focus();await fallback.keyboard.press('Space');
  assert.equal(await selector.getAttribute('aria-pressed'),'true');
  assert.equal(await fallback.locator('.content').getAttribute('data-ice-glass'),'fallback');
  const report={pass:true,errors,frameCount:frames.length,checks:'directional stretch, recoil, exact rest, stable labels, outside, keyboard, reduced motion, mobile, no WebGL, single canvas'};
  await fs.writeFile(`${dir}/result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
