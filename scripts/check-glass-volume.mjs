import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
let playwright;
for (const path of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"].filter(Boolean)) {
  try { playwright = require(path); break; } catch {}
}
if (!playwright) throw new Error("Playwright unavailable; set PLAYWRIGHT_MODULE.");
const source = await readFile(resolve("app/ice-glass-shader.ts"), "utf8");
const volume = await readFile(resolve("app/ice-glass-volume-shader.ts"), "utf8");
const vertex = source.match(/glassVertex = `([\s\S]*?)`;/)[1];
const fragment = volume.match(/volumeGlassFragment = `([\s\S]*?)`;/)[1];
const probe = fragment.slice(0, fragment.lastIndexOf("void main()")) + `
void main() {
  int test=int(gl_FragCoord.x);
  float error=0.0;
  if(test==0) error=abs(dielectricFresnel(1.0,1.0,1.5)-.04);
  if(test==1) error=abs(dielectricFresnel(.5,1.5,1.0)-1.0);
  if(test==2) {
    vec3 ray=refract(vec3(.5,0,-sqrt(.75)),vec3(0,0,1),1.0/1.5);
    error=abs(ray.x-1.0/3.0);
  }
  if(test>=3 && test<=11) {
    vec2 position=vec2(-175.0+float(test-3)*43.0,-88.0+float(test-3)*17.0);
    vec3 entry=slabFront(position),normal;
    error=abs(slabDistance(entry,normal));
    SlabTrace ray=traceSlab(entry,normal,normalize(vec3(.4,-.3,-1)),1.5,.01,0);
    error+=abs(ray.escaped+ray.absorbed+ray.remaining-1.0);
    error+=abs(length(normal)-1.0);
    // Normal must agree with finite differences of the volume itself.
    vec3 unused;
    vec3 e=vec3(.005,0,0);
    vec3 gradient=vec3(slabDistance(entry+e,unused)-slabDistance(entry-e,unused),
      slabDistance(entry+e.yxz,unused)-slabDistance(entry-e.yxz,unused),
      slabDistance(entry+e.yzx,unused)-slabDistance(entry-e.yzx,unused));
    error+=1.0-dot(normal,normalize(gradient));
  }
  if(test==12) {
    vec3 n,hit; vec3 entry=slabFront(vec2(0));
    bool found=nextBoundary(entry-vec3(0,0,.03),vec3(0,0,-1),hit,n);
    error=found ? abs(length(entry-hit)-slabThickness()) : 1.0;
  }
  if(test==13) error=wavelengthIOR(.45)>wavelengthIOR(.55) && wavelengthIOR(.55)>wavelengthIOR(.65) ? 0.0 : 1.0;
  if(test==14) {
    vec3 n;
    error=slabDistance(vec3(0),n)<0.0 && slabDistance(vec3(0,0,30),n)>0.0 ? 0.0 : 1.0;
  }
  if(test>=15) {
    float index=float(test-15);
    float depth=.2+mod(index,7.0)*.8;
    float side=mod(floor(index/7.0),2.0)*2.0-1.0;
    vec2 p=vec2(side*(180.0-depth),sin(index*.7)*92.0);
    vec3 entry=slabFront(p),normal,hit,boundary;
    slabDistance(entry,normal);
    vec3 incident=normalize(vec3(sin(index*.9),cos(index*.9),-1.0));
    vec3 direction=refract(incident,normal,1.0/1.5);
    bool found=nextBoundary(entry+direction*.03,direction,hit,boundary);
    float distance=slabDistance(hit,normal);
    error=found && abs(distance)<.04 && dot(boundary,direction)>0.0 ? 0.0 : 1.0;
  }
  outColor=vec4(error<.004 ? 0.0 : 1.0,clamp(error,0.0,1.0),0,1);
}`;
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="64" height="1"></canvas>');
  const result = await page.evaluate(({ vertex, fragment, probe }) => {
    const gl = document.querySelector("canvas").getContext("webgl2");
    const compile = (fragmentSource) => {
      const program = gl.createProgram();
      for (const [type, code] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragmentSource]]) {
        const shader = gl.createShader(type); gl.shaderSource(shader,code); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        gl.attachShader(program,shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      return program;
    };
    compile(fragment);
    const program=compile(probe); gl.useProgram(program);gl.bindVertexArray(gl.createVertexArray());
    const set=(name,values)=>gl["uniform"+values.length+"f"](gl.getUniformLocation(program,name),...values);
    set("uResolution",[64,1]);set("uDPR",[1]);set("uRect",[0,0,360,240]);set("uRadius",[28]);set("uGlass",[1.5,14,.21,.58]);set("uOptics",[.8,.05,.88,.22]);
    // Fullscreen geometry for the probes, while the optical volume keeps its size.
    const location=gl.getUniformLocation(program,"uResolution");gl.uniform2f(location,360,240);
    gl.viewport(0,0,64,1);gl.drawArrays(gl.TRIANGLES,0,6);
    const pixels=new Uint8Array(256);gl.readPixels(0,0,64,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    return {probes:64,failed:Array.from({length:64},(_,i)=>({test:i,failed:pixels[i*4]>0 || pixels[i*4+3]!==255,error:pixels[i*4+1]/255})).filter(t=>t.failed),glError:gl.getError()};
  }, {vertex,fragment,probe});
  console.log(JSON.stringify(result,null,2));
  if(result.failed.length || result.glError) process.exitCode=1;
} finally { await browser.close(); }
