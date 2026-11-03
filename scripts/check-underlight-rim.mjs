// Optical checks run the production GLSL, including the closed soap volume.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(await fs.readFile(new URL('../app/ice-glass-shader.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/\bexport /g, '');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(source => {
    const { glassVertex, glassFragment } = new Function(source + ';return {glassVertex,glassFragment};')();
    const W = 256, H = 96;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const gl = canvas.getContext('webgl2');
    if (!gl?.getExtension('EXT_color_buffer_float')) throw Error('Float WebGL2 target unavailable');
    const make = fragment => {
      const program = gl.createProgram();
      for (const [type, code] of [[gl.VERTEX_SHADER, glassVertex], [gl.FRAGMENT_SHADER, fragment]]) {
        const shader = gl.createShader(type); gl.shaderSource(shader, code); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      return program;
    };
    const production = make(glassFragment);
    const diffuse = make(glassFragment.replace('if(shoulderTransport>.001 && volume>.2)', 'if(false)'));
    const prefix = glassFragment.split('void main()')[0];
    const transport = make(prefix + `void main(){
      vec2 b=uRect.zw*.5,p=vec2(gl_FragCoord.x,uResolution.y-gl_FragCoord.y)-b;
      float r=min(min(b.x,b.y)*.95,max(uRadius*1.75,24.0));
      if(boxSDF(p,b,r)>-.1){outColor=vec4(0);return;}
      float t=min(uGlass.y*2.1,min(b.x,b.y)*.5);
      vec3 s=soapSurface(p,b,r,t),n=normalize(vec3(-s.xy*uCoating.w,1.0));
      outColor=vec4(internalUnderlight(p+b,s,n,r,t,uCoating.w),1.0);
    }`);
    const intersections = make(prefix + `void main(){
      vec2 b=uRect.zw*.5,p=vec2(gl_FragCoord.x,uResolution.y-gl_FragCoord.y)-b;
      float r=min(min(b.x,b.y)*.95,max(uRadius*1.75,24.0));
      if(boxSDF(p,b,r)>-.3){outColor=vec4(0);return;}
      float t=min(uGlass.y*2.1,min(b.x,b.y)*.5);
      vec3 s=soapSurface(p,b,r,t)*uCoating.w,n=normalize(vec3(-s.xy,1.0));
      vec3 ray=refract(vec3(0,0,-1),n,1.0/uGlass.x),o=vec3(p,s.z)+ray*.04,hitNormal;
      float path=soapRayExit(o,ray,b,r,t,uCoating.w,hitNormal);
      vec3 hit=o+ray*path;
      float residual=abs(abs(hit.z)-soapSurface(hit.xy,b,r,t).z*uCoating.w);
      outColor=vec4(residual,internalFresnel(dot(ray,hitNormal),uGlass.x,1.0),dot(ray,hitNormal),1.0);
    }`);
    const fresnel = make(prefix + `void main(){
      float c=gl_FragCoord.x/uResolution.x;
      outColor=vec4(internalFresnel(c,1.5,1.0),internalFresnel(1.0,1.0,1.5),0,1);
    }`);
    gl.bindVertexArray(gl.createVertexArray()); gl.disable(gl.BLEND); gl.viewport(0, 0, W, H);
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Incomplete framebuffer');
    const draw = (program, { time = 10, power = 1, volume = 1, tint = [1, .34, .43], light = [120, -100, 1] } = {}) => {
      gl.useProgram(program); const u = name => gl.getUniformLocation(program, name);
      gl.uniform2f(u('uResolution'), W, H); gl.uniform1f(u('uDPR'), 1); gl.uniform4f(u('uRect'), 0, 0, W, H);
      gl.uniform4f(u('uCoating'), 1, 1, 1, volume); gl.uniform2f(u('uCoatingOrigin'), .5, .5);
      gl.uniform2f(u('uUnderlight'), power, time); gl.uniform4f(u('uSpill'), 0, 0, 0, 0);
      gl.uniform1f(u('uRadius'), 14); gl.uniform1f(u('uCrownHeight'), 31);
      gl.uniform1f(u('uBodyOpacity'), .14); gl.uniform3f(u('uTint'), ...tint); gl.uniform3f(u('uLight'), ...light);
      gl.uniform4f(u('uGlass'), 1.5, 14, .21, .58); gl.uniform4f(u('uOptics'), .8, .05, .88, .22);
      gl.uniform4f(u('uEnergy'), .055, 1.95, 48, 340); gl.uniform3f(u('uFinish'), 38, .12, 4);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 6);
      const pixels = new Float32Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, pixels);
      return pixels;
    };
    const maxDifference = (a, b) => a.reduce((m, value, i) => Math.max(m, Math.abs(value - b[i])), 0);
    let unlitDifference = 0;
    for (const light of [[120, -100, 1], [W / 2, H / 2, 1], [W + 100, H + 100, 1], [-1000, -1000, 0]]) {
      unlitDifference = Math.max(unlitDifference, maxDifference(draw(production, { power: 0, light }), draw(diffuse, { power: 0, light })));
    }
    const base = draw(production, { power: 0 });
    let alphaDifference = 0, outside = 0, changed = 0, brightening = 0, dimming = 0, shortStep = 0;
    const rimEvolution = [];
    for (const time of [0, 7, 14, 28, 56]) {
      const lit = draw(production, { time }), old = draw(diffuse, { time }), next = draw(production, { time: time + .1 });
      let localPeak = 0;
      for (let i = 0; i < lit.length; i += 4) {
        alphaDifference = Math.max(alphaDifference, Math.abs(base[i + 3] - lit[i + 3]));
        const delta = lit[i] - old[i];
        if (Math.abs(delta) > .001) changed++;
        brightening = Math.max(brightening, delta); dimming = Math.min(dimming, delta);
        localPeak = Math.max(localPeak, delta);
        for (let c = 0; c < 3; c++) {
          if (base[i + 3] === 0) outside = Math.max(outside, Math.abs(lit[i + c] - base[i + c]));
          shortStep = Math.max(shortStep, Math.abs(lit[i + c] - next[i + c]));
        }
      }
      rimEvolution.push({ time, peak: localPeak });
    }
    let maxRadiance = 0, maxResidual = 0, minExitCosine = 1, tir = 0, transmission = 0, nonFinite = 0;
    for (const volume of [.25, .6, 1]) {
      const rays = draw(intersections, { volume }), energy = draw(transport, { volume, tint: [1, 1, 1] });
      for (let i = 0; i < rays.length; i += 4) {
        if (rays[i + 3]) {
          maxResidual = Math.max(maxResidual, rays[i]); minExitCosine = Math.min(minExitCosine, rays[i + 2]);
          if (volume === 1) { if (rays[i + 1] > .999) tir++; else transmission++; }
        }
        for (let c = 0; c < 3; c++) {
          if (!Number.isFinite(energy[i + c])) nonFinite++;
          maxRadiance = Math.max(maxRadiance, energy[i + c]);
        }
      }
    }
    const f = draw(fresnel);
    return { unlitDifference, alphaDifference, outside, changed, brightening, dimming, shortStep, rimEvolution,
      maxRadiance, maxResidual, minExitCosine, tir, transmission, nonFinite, normalReflectance: f[1],
      belowCritical: f[128 * 4], aboveCritical: f[230 * 4], error: gl.getError() };
  }, source);
  assert.equal(result.error, 0); assert.equal(result.nonFinite, 0);
  assert.equal(result.unlitDifference, 0, 'cursor reflection and unlit material are unchanged');
  assert.equal(result.alphaDifference, 0); assert.equal(result.outside, 0, 'no light beyond the silhouette');
  assert(result.changed > 500 && result.brightening > .005 && result.dimming < -.005, 'light is redistributed across the shoulder');
  assert(result.shortStep < .015, 'slow continuous light evolution');
  assert(result.maxRadiance > .02 && result.maxRadiance <= .138 * 1.15, 'transport never amplifies source radiance');
  assert(result.maxResidual < .01 && result.minExitCosine > 0, 'rays exit the actual soap surface');
  assert(result.tir > 100 && result.transmission > 100, 'both total internal reflection and transmission occur');
  assert(Math.abs(result.normalReflectance - .04) < .00001);
  assert.equal(result.belowCritical, 1); assert(result.aboveCritical < .1);
  const dir = process.env.GLASS_SELECTION_ARTIFACTS || '/tmp/bluespherix-rim-light';
  await fs.mkdir(dir, { recursive: true }); await fs.writeFile(`${dir}/rim-optics.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ pass: true, ...result }));
} finally { await browser.close(); }
