// Runs the production GLSL in a float framebuffer; debug output is test-only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = ts.transpileModule(await fs.readFile(new URL('../app/ice-glass-shader.ts',import.meta.url),'utf8'),
  {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/\bexport /g,'');
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage();
  const result = await page.evaluate(source => {
    const {glassVertex,glassFragment} = new Function(source+';return {glassVertex,glassFragment};')();
    const W=384,H=192,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    const gl=canvas.getContext('webgl2');
    if(!gl?.getExtension('EXT_color_buffer_float')) throw Error('Float WebGL2 target unavailable');
    const make = fragment => {
      const program=gl.createProgram();
      for(const [type,source] of [[gl.VERTEX_SHADER,glassVertex],[gl.FRAGMENT_SHADER,fragment]]) {
        const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
        gl.attachShader(program,shader);
      }
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      return program;
    };
    const production=make(glassFragment);
    const field=make(glassFragment.split('void main()')[0]+`void main(){
      vec2 p=vec2(gl_FragCoord.x,uResolution.y-gl_FragCoord.y);
      float level=underlightLevel(p,uRect.zw,uCoatingOrigin,uUnderlight.y);
      outColor=vec4(vec3(level),1.0);
    }`);
    gl.bindVertexArray(gl.createVertexArray());gl.disable(gl.BLEND);gl.viewport(0,0,W,H);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,W,H,0,gl.RGBA,gl.FLOAT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw Error('Incomplete framebuffer');
    const draw=(program,time=0,power=0,spill=false,sourceX=-120)=>{
      gl.useProgram(program);const u=n=>gl.getUniformLocation(program,n);
      gl.uniform2f(u('uResolution'),W,H);gl.uniform1f(u('uDPR'),1);gl.uniform4f(u('uRect'),0,0,W,H);
      gl.uniform4f(u('uCoating'),1,spill?0:1,1,1);gl.uniform2f(u('uCoatingOrigin'),.5,.5);
      gl.uniform2f(u('uUnderlight'),spill?0:power,time);
      gl.uniform4f(u('uSpillRect'),sourceX,60,100,64);gl.uniform2f(u('uSpillOrigin'),.5,.5);
      gl.uniform3f(u('uSpillTint'),1,.34,.43);gl.uniform4f(u('uSpill'),power,time,1,spill?1:0);
      gl.uniform1f(u('uRadius'),24);gl.uniform1f(u('uCrownHeight'),38);
      gl.uniform1f(u('uBodyOpacity'),.14);gl.uniform3f(u('uTint'),1,.34,.43);gl.uniform3f(u('uLight'),120,-100,1);
      gl.uniform4f(u('uGlass'),1.5,14,.21,.58);gl.uniform4f(u('uOptics'),.8,.05,.88,.22);
      gl.uniform4f(u('uEnergy'),.055,1.95,48,340);gl.uniform3f(u('uFinish'),38,.12,4);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
      const data=new Float32Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,data);return data;
    };
    const at=(a,x,y,c=0)=>a[((H-1-y)*W+x)*4+c];
    const times=[];
    for(let t=0;t<=180;t+=2) times.push({t,value:at(draw(field,t),192,96)});
    const probe=draw(field,10),next=draw(field,10.1);
    let shortStep=0;for(let i=0;i<probe.length;i+=4) shortStep=Math.max(shortStep,Math.abs(probe[i]-next[i]));
    const base=draw(production),lit=draw(production,10,1);
    let alphaDiff=0,outside=0;for(let i=0;i<base.length;i+=4){alphaDiff=Math.max(alphaDiff,Math.abs(base[i+3]-lit[i+3]));if(base[i+3]===0)outside=Math.max(outside,Math.abs(base[i]-lit[i]));}
    const receiver=draw(production,0,0,true);
    let peak={t:0,value:0};
    for(let t=0;t<=90;t+=3){const a=draw(production,t,1,true),v=at(a,2,92)-at(receiver,2,92);if(v>peak.value)peak={t,value:v};}
    const near=draw(production,peak.t,1,true),far=draw(production,peak.t,1,true,-420),dim=draw(production,peak.t,.25,true);
    let spillAlpha=0,dimDiff=0,spillOutside=0;
    for(let i=0;i<receiver.length;i+=4){spillAlpha=Math.max(spillAlpha,Math.abs(receiver[i+3]-near[i+3]));for(let c=0;c<3;c++){dimDiff=Math.max(dimDiff,Math.abs(receiver[i+c]-dim[i+c]));if(receiver[i+3]===0)spillOutside=Math.max(spillOutside,Math.abs(receiver[i+c]-near[i+c]));}}
    return {times,shortStep,alphaDiff,outside,spill:{peak,far:at(far,2,92)-at(receiver,2,92),red:at(near,2,92)-at(receiver,2,92),green:at(near,2,92,1)-at(receiver,2,92,1),centre:at(near,192,96)-at(receiver,192,96),spillAlpha,dimDiff,spillOutside},error:gl.getError()};
  },source);
  assert.equal(result.error,0);assert.equal(result.alphaDiff,0);assert.equal(result.outside,0);
  assert(Math.min(...result.times.map(s=>s.value))===0,'a fixed local point extinguishes completely');
  assert(Math.max(...result.times.map(s=>s.value))>.9,'same point can reach high intensity');
  const states=result.times.map(s=>s.value===0?'off':s.value>.7?'bright':'soft');
  const off=states.indexOf('off');assert(off>=0 && states.slice(off+1).includes('bright'),'relights after extinction');
  const bright=states.indexOf('bright');assert(states.slice(bright+1).includes('off'),'extinguishes after being bright');
  assert(result.shortStep<.04,'continuous slow temporal evolution');
  const s=result.spill;assert(s.peak.value>.001 && s.peak.value<.07);
  assert(s.far<s.peak.value*.35 && s.far>0,'distance attenuation');assert(s.red>s.green,'emitter hue preserved');
  assert.equal(s.centre,0);assert.equal(s.spillAlpha,0);assert.equal(s.dimDiff,0);assert.equal(s.spillOutside,0);
  const dir=process.env.GLASS_SELECTION_ARTIFACTS || '/tmp/bluespherix-underlight';await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(`${dir}/optics.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify({pass:true,range:[Math.min(...result.times.map(s=>s.value)),Math.max(...result.times.map(s=>s.value))],shortStep:result.shortStep,spill:s}));
} finally {await browser.close();}
