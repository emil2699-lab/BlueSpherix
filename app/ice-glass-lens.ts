import { snell, soapSample, unit } from "./ice-glass-volume.ts";

export type LensProfile = { width: number; height: number; radius: number; thickness: number; ior: number; distance: number; paraxial?: number; left?: number; top?: number };
export type LensField = { width: number; height: number; padding: number; range: number; data: Uint8ClampedArray; offsets: Float32Array; gain: number };
const clamp = (x: number, low: number, high: number) => Math.max(low,Math.min(high,x));

/** Backwards camera ray through both curved soap interfaces; slopes in air. */
export function soapLensSlope(x: number, y: number, profile: LensProfile): [number,number] {
  const bx=profile.width*.5, by=profile.height*.5;
  const qx=Math.abs(x)-bx+profile.radius, qy=Math.abs(y)-by+profile.radius;
  const depth=profile.radius-Math.min(Math.max(qx,qy),0)-Math.hypot(Math.max(qx,0),Math.max(qy,0));
  if(depth<=0 || profile.ior===1) return [0,0];
  const top=soapSample(x,y,bx,by,profile.radius,profile.thickness);
  const inside=snell([0,0,-1],unit([-top[0],-top[1],1]),1,profile.ior).direction;
  if(!inside) return [0,0];
  // Intersect z=-h(x,y), using the analytic derivatives of the same surface.
  let path=2*top[2]/-inside[2];
  for(let i=0;i<5;i++) {
    const bottom=soapSample(x+inside[0]*path,y+inside[1]*path,bx,by,profile.radius,profile.thickness);
    const error=top[2]+inside[2]*path+bottom[2];
    const derivative=inside[2]+bottom[0]*inside[0]+bottom[1]*inside[1];
    if(Math.abs(derivative)<.01) return [0,0];
    path=clamp(path-error/derivative,0,profile.thickness*6);
  }
  const bottom=soapSample(x+inside[0]*path,y+inside[1]*path,bx,by,profile.radius,profile.thickness);
  const outgoing=snell(inside,unit([bottom[0],bottom[1],1]),profile.ior,1).direction;
  if(!outgoing || outgoing[2]>=-.2) return [0,0];
  // The grazing shoulder is not a readable lens. Taper its transmitted image
  // into the undistorted DOM instead of showing TIR or a discontinuous fold.
  const edge=clamp((depth-6)/18,0,1), transmission=edge*edge*(3-2*edge);
  return [outgoing[0]/-outgoing[2]*transmission,outgoing[1]/-outgoing[2]*transmission];
}

/** A cached inverse ray map. Only its SVG displacement scale changes per frame. */
export function buildLensField(profile: LensProfile): LensField {
  // The paraxial component can move pixels farther than the traced shoulder.
  // Include that travel in the SVG filter region so wide Today cards do not
  // crop their magnified text at the polished rim.
  const padding=Math.ceil(Math.max(24,Math.max(profile.width,profile.height)*(profile.paraxial ?? 0)*.5+12));
  const extentX=profile.width+padding*2, extentY=profile.height+padding*2;
  const odd=(size: number) => Math.max(65,Math.min(193,Math.round(size)|1));
  const width=odd(193*extentX/Math.max(extentX,extentY));
  const height=odd(193*extentY/Math.max(extentX,extentY));
  const stepX=extentX/width, stepY=extentY/height;
  const midX=(width-1)/2, midY=(height-1)/2;
  const offsets=new Float32Array(width*height*2);
  const maxOffset=Math.min(18,Math.min(profile.width,profile.height)*.12);
  // Mirror one quadrant: these normals and the viewing direction are symmetric.
  for(let y=midY;y<height;y++) for(let x=midX;x<width;x++) {
    const px=(x-midX)*stepX, py=(y-midY)*stepY;
    const slope=soapLensSlope(px,py,profile);
    const dx=maxOffset*Math.tanh(profile.distance*slope[0]/maxOffset);
    const dy=maxOffset*Math.tanh(profile.distance*slope[1]/maxOffset);
    offsets[(y*width+x)*2]=dx;
    offsets[(y*width+x)*2+1]=dy;
  }
  // Keep the inverse image upright before the local focal plane is reached.
  // Anchoring the scan at the optical centre preserves symmetry and centring.
  for(let y=midY;y<height;y++) {
    let previous=0;
    for(let x=midX+1;x<width;x++) {
      const i=(y*width+x)*2, px=(x-midX)*stepX;
      previous=Math.min(px,Math.max(px+offsets[i],previous+stepX*.82));
      offsets[i]=previous-px;
    }
  }
  for(let x=midX;x<width;x++) {
    let previous=0;
    for(let y=midY+1;y<height;y++) {
      const i=(y*width+x)*2+1, py=(y-midY)*stepY;
      previous=Math.min(py,Math.max(py+offsets[i],previous+stepY*.82));
      offsets[i]=previous-py;
    }
  }
  for(let y=midY;y<height;y++) for(let x=midX;x<width;x++) {
    const i=(y*width+x)*2, dx=offsets[i],dy=offsets[i+1];
    for(const [xx,sx] of [[x,1],[width-1-x,-1]]) for(const [yy,sy] of [[y,1],[height-1-y,-1]]) {
      const j=(yy*width+xx)*2; offsets[j]=dx*sx; offsets[j+1]=dy*sy;
    }
  }
  // Bound the smallest eigenvalue of the symmetric displacement Jacobian,
  // including cross-axis curvature, rather than merely clamping each channel.
  let minimum=0;
  for(let y=1;y<height-1;y++) for(let x=1;x<width-1;x++) {
    const i=(y*width+x)*2;
    const a=(offsets[i+2]-offsets[i-2])/(stepX*2);
    const d=(offsets[i+width*2+1]-offsets[i-width*2+1])/(stepY*2);
    const cross=((offsets[i+width*2]-offsets[i-width*2])/(stepY*2)
      +(offsets[i+3]-offsets[i-1])/(stepX*2))*.5;
    minimum=Math.min(minimum,(a+d)*.5-Math.hypot((a-d)*.5,cross));
  }
  const gain=minimum<-.32 ? -.32/minimum : 1;
  let range=1;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*2;
    // A shallow paraxial inverse map exposes the magnification of a convex
    // lens without replacing the traced curved-surface distortion. Fade that
    // term through the rolled shoulder, where transmitted content must merge
    // back into the fixed DOM instead of being cut off by the silhouette.
    const px=(x-midX)*stepX,py=(y-midY)*stepY;
    const qx=Math.abs(px)-profile.width*.5+profile.radius;
    const qy=Math.abs(py)-profile.height*.5+profile.radius;
    const depth=profile.radius-Math.min(Math.max(qx,qy),0)-Math.hypot(Math.max(qx,0),Math.max(qy,0));
    // Finish the merge inside the optical lip. Letting this transition cross
    // the content area would locally compress glyphs even though the map never
    // mathematically folds.
    const shoulder=clamp((depth-3)/15,0,1);
    const transmission=shoulder*shoulder*(3-2*shoulder);
    offsets[i]=offsets[i]*gain-px*(profile.paraxial ?? 0)*transmission;
    offsets[i+1]=offsets[i+1]*gain-py*(profile.paraxial ?? 0)*transmission;
  }
  // The shoulder taper contributes its own derivative. Re-evaluate the whole
  // inverse map after combining traced and paraxial terms, then uniformly
  // reduce it if needed so glyphs can enlarge without folding or pinching.
  let combinedMinimum=0;
  for(let y=1;y<height-1;y++) for(let x=1;x<width-1;x++) {
    const i=(y*width+x)*2;
    const a=(offsets[i+2]-offsets[i-2])/(stepX*2);
    const d=(offsets[i+width*2+1]-offsets[i-width*2+1])/(stepY*2);
    const cross=((offsets[i+width*2]-offsets[i-width*2])/(stepY*2)
      +(offsets[i+3]-offsets[i-1])/(stepX*2))*.5;
    combinedMinimum=Math.min(combinedMinimum,(a+d)*.5-Math.hypot((a-d)*.5,cross));
  }
  const readabilityGain=combinedMinimum<-.42 ? -.42/combinedMinimum : 1;
  for(let i=0;i<offsets.length;i++) {
    offsets[i]*=readabilityGain;
    range=Math.max(range,Math.abs(offsets[i]));
  }
  const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++) {
    data[i*4]=Math.round(128+127*offsets[i*2]/range);
    data[i*4+1]=Math.round(128+127*offsets[i*2+1]/range);
    data[i*4+2]=128; data[i*4+3]=255;
  }
  return {width,height,padding,range,data,offsets,gain:gain*readabilityGain};
}

type LensEntry = { key: string; id: string; filter: SVGFilterElement; style: SVGStyleElement; image: SVGFEImageElement; displacement: SVGFEDisplacementMapElement; range: number; padding: number; active: boolean; scale: string; projection: number };
type ScaleLensEntry = { key: string; id: string; style: SVGStyleElement; origins: string; scale: string; active: boolean };
type RasterLensEntry = {
  key: string; id: string; element: HTMLElement; field: LensField;
  content: WebGLTexture; rays: WebGLTexture; ready: boolean; failed: boolean;
  capturing: boolean; active: boolean; desired: boolean; generation: number; lastUsed: number;
  refresh: EventListener; captureTimer?: ReturnType<typeof setTimeout>;
};
const SVG_NS="http://www.w3.org/2000/svg";
let nextLens=0;

/**
 * WebKit can report support for SVG filters on HTML while compositing an
 * feImage/feDisplacementMap makes the filtered DOM disappear or stalls the
 * page. Keep the material renderer active there, but leave real DOM content
 * on its readable base plane. iOS browsers use WebKit too, including CriOS.
 */
export function supportsDomSvgLensFilters(userAgent: string) {
  const webKit = /AppleWebKit/i.test(userAgent);
  const desktopChromium = /(?:Chrome|Chromium|Edg|OPR)\//i.test(userAgent);
  return !webKit || desktopChromium;
}

export const fallbackLensMagnification = (projection: number) =>
  1+(Math.max(1,projection)-1)*.9;

/**
 * Safari fallback: reproduce the paraxial magnification without asking WebKit
 * to filter a large live DOM subtree. Every top-level content plane scales
 * around the same optical centre, so the card layout and hit area stay fixed.
 * Rules live in the ignored SVG definitions host to avoid MutationObserver
 * feedback while the lift clock updates the scale.
 */
function createScaleGlassLenses(definitions: SVGDefsElement) {
  const entries=new Map<HTMLElement,ScaleLensEntry>();
  const remove=(element: HTMLElement) => {
    const entry=entries.get(element);
    entry?.style.remove();
    delete element.dataset.iceLensFallback;
    entries.delete(element);
  };
  const prepare=(element: HTMLElement, profile: LensProfile) => {
    let entry=entries.get(element);
    const key=`${profile.width.toFixed(2)}:${profile.height.toFixed(2)}:${element.childElementCount}`;
    if(!entry) {
      const id=`ice-glass-scale-${++nextLens}`;
      const style=document.createElementNS(SVG_NS,"style");
      definitions.append(style);
      entry={key:"",id,style,origins:"",scale:"",active:false};
      entries.set(element,entry);
    }
    if(entry.key!==key) {
      const wasActive=entry.active;
      if(wasActive) delete element.dataset.iceLensFallback;
      const card=element.getBoundingClientRect();
      const centreX=card.left+card.width*.5,centreY=card.top+card.height*.5;
      const selector=`html[data-theme="light"] .content[data-ice-glass="ready"] [data-ice-lens-fallback="${entry.id}"]`;
      entry.origins=Array.from(element.children).map((child,index) => {
        const rect=child.getBoundingClientRect();
        return `${selector}>:nth-child(${index+1}){transform-origin:${(centreX-rect.left).toFixed(2)}px ${(centreY-rect.top).toFixed(2)}px}`;
      }).join("");
      entry.key=key;
      entry.scale="";
      if(wasActive) element.dataset.iceLensFallback=entry.id;
    }
    return entry;
  };
  return {
    beginFrame(_width: number, _height: number, _dpr: number) { void _width; void _height; void _dpr; },
    update(element: HTMLElement, profile: LensProfile, _lift: number, projection=1, _hovered=false) {
      void _lift;void _hovered;
      const existing=entries.get(element);
      if(projection<=1.00001) {
        if(existing?.active) { delete element.dataset.iceLensFallback; existing.active=false; }
        return;
      }
      const entry=prepare(element,profile);
      // Match the accepted Today lens: 90% of its perspective enlargement is
      // the readable paraxial image, reaching about 1.054x at full lift.
      const scale=fallbackLensMagnification(projection).toFixed(5);
      if(scale!==entry.scale) {
        const selector=`html[data-theme="light"] .content[data-ice-glass="ready"] [data-ice-lens-fallback="${entry.id}"]`;
        entry.style.textContent=`${entry.origins}${selector}>*{scale:${scale};transform-box:border-box}`;
        entry.scale=scale;
      }
      if(!entry.active) { element.dataset.iceLensFallback=entry.id; entry.active=true; }
    },
    retain(elements: Set<HTMLElement>) { for(const element of entries.keys()) if(!elements.has(element)) remove(element); },
    clear() { for(const element of entries.keys()) remove(element); },
  };
}

/**
 * WebKit path: rasterise only the hovered DOM card, then pass that image through
 * the same inverse ray map used by the Chromium SVG displacement filter. The
 * live DOM keeps its layout, hit target and accessibility tree on the base
 * plane; only this optical image is hidden/revealed while the glass is lifted.
 */
function createRasterGlassLenses(definitions: SVGDefsElement, canvas: HTMLCanvasElement, invalidate: () => void) {
  const fallback=createScaleGlassLenses(definitions);
  const gl=canvas.getContext("webgl2",{alpha:true,antialias:false,depth:false,premultipliedAlpha:true,powerPreference:"low-power"});
  if(!gl) return fallback;
  let lost=false;
  let captureBusy=false;
  let pendingCapture: RasterLensEntry | undefined;
  let frameEnabled=false;
  let paintedLastFrame=false;
  const entries=new Map<HTMLElement,RasterLensEntry>();
  const locations=new Map<string,WebGLUniformLocation|null>();
  const vertex=`#version 300 es
    precision highp float;
    uniform vec4 uDrawRect;
    uniform vec2 uResolution;
    out vec2 vCss;
    const vec2 corners[6]=vec2[6](vec2(0.,0.),vec2(1.,0.),vec2(0.,1.),vec2(0.,1.),vec2(1.,0.),vec2(1.,1.));
    void main(){
      vec2 corner=corners[gl_VertexID];
      vCss=uDrawRect.xy+corner*uDrawRect.zw;
      vec2 clip=vec2(vCss.x/uResolution.x*2.-1.,1.-vCss.y/uResolution.y*2.);
      gl_Position=vec4(clip,0.,1.);
    }`;
  const fragment=`#version 300 es
    precision highp float;
    uniform sampler2D uContent;
    uniform sampler2D uRays;
    uniform vec4 uCardRect;
    uniform vec2 uRayExtent;
    uniform float uRange;
    uniform float uStrength;
    uniform float uProjection;
    in vec2 vCss;
    out vec4 outColor;
    void main(){
      vec2 local=vCss-uCardRect.xy;
      vec2 centred=local-uCardRect.zw*.5;
      vec2 rayUv=centred/(uRayExtent*uProjection)+.5;
      vec2 offset=vec2(0.);
      if(all(greaterThanEqual(rayUv,vec2(0.)))&&all(lessThanEqual(rayUv,vec2(1.)))) {
        vec2 encoded=texture(uRays,rayUv).rg;
        offset=(encoded*255.-128.)/127.*uRange;
      }
      vec2 sourceUv=(local+offset*uStrength)/uCardRect.zw;
      vec2 baseUv=local/uCardRect.zw;
      if(any(lessThan(baseUv,vec2(0.)))||any(greaterThan(baseUv,vec2(1.)))) discard;
      // The content is attached to the base, not to the moving glass. Rays
      // that leave the captured image therefore reveal the undistorted base
      // sample instead of punching transparent holes through labels/graphs.
      if(any(lessThan(sourceUv,vec2(0.)))||any(greaterThan(sourceUv,vec2(1.)))) sourceUv=baseUv;
      outColor=texture(uContent,sourceUv);
    }`;
  const shader=(type: number,source: string) => {
    const value=gl.createShader(type);
    if(!value) throw new Error("Safari lens shader unavailable");
    gl.shaderSource(value,source);gl.compileShader(value);
    if(!gl.getShaderParameter(value,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value)||"Safari lens shader compilation");
    return value;
  };
  let program: WebGLProgram;
  let vao: WebGLVertexArrayObject;
  try {
    const vertexShader=shader(gl.VERTEX_SHADER,vertex),fragmentShader=shader(gl.FRAGMENT_SHADER,fragment);
    const linked=gl.createProgram();
    if(!linked) throw new Error("Safari lens program unavailable");
    gl.attachShader(linked,vertexShader);gl.attachShader(linked,fragmentShader);gl.linkProgram(linked);
    gl.deleteShader(vertexShader);gl.deleteShader(fragmentShader);
    if(!gl.getProgramParameter(linked,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(linked)||"Safari lens link");
    const array=gl.createVertexArray();
    if(!array) throw new Error("Safari lens geometry unavailable");
    program=linked;vao=array;
  } catch(error) {
    console.warn("Ice Glass uses the readable Safari lens fallback:",error);
    return fallback;
  }
  const uniform=(name: string) => {
    if(!locations.has(name)) locations.set(name,gl.getUniformLocation(program,name));
    return locations.get(name)!;
  };
  const texture=(pixels?: Uint8ClampedArray,width=1,height=1) => {
    const value=gl.createTexture();
    if(!value) throw new Error("Safari lens texture unavailable");
    gl.bindTexture(gl.TEXTURE_2D,value);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels ?? new Uint8Array([0,0,0,0]));
    return value;
  };
  const reveal=(entry: RasterLensEntry) => {
    if(entry.active) delete entry.element.dataset.iceLensRaster;
    entry.active=false;
  };
  const remove=(element: HTMLElement) => {
    const entry=entries.get(element);
    if(!entry) return;
    entry.generation++;reveal(entry);
    clearTimeout(entry.captureTimer);
    if(pendingCapture===entry) pendingCapture=undefined;
    for(const event of ["pointerdown","input","change","click"]) element.removeEventListener(event,entry.refresh,true);
    gl.deleteTexture(entry.content);gl.deleteTexture(entry.rays);
    entries.delete(element);
  };
  const capture=async(entry: RasterLensEntry) => {
    if(captureBusy || entry.capturing || entry.ready || entry.failed || !entry.desired) {
      if(captureBusy && entry.desired) pendingCapture=entry;
      return;
    }
    captureBusy=true;
    entry.capturing=true;
    const generation=++entry.generation;
    try {
      const {default: html2canvas}=await import("html2canvas");
      if(generation!==entry.generation || lost) return;
      const bitmap=await html2canvas(entry.element,{
        backgroundColor:null,logging:false,useCORS:true,removeContainer:true,
        imageTimeout:2500,scale:2,
      });
      if(generation!==entry.generation || lost) return;
      gl.bindTexture(gl.TEXTURE_2D,entry.content);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);
      entry.ready=true;
    } catch(error) {
      entry.failed=true;
      console.warn("Ice Glass could not capture Safari card content:",error);
    } finally {
      if(entries.get(entry.element)===entry) entry.capturing=false;
      captureBusy=false;
      invalidate();
      const next=pendingCapture;
      pendingCapture=undefined;
      if(next?.desired && entries.get(next.element)===next) queueCapture(next,0);
    }
  };
  const queueCapture=(entry: RasterLensEntry, delay=140) => {
    if(entry.ready || entry.failed || entry.capturing || entry.captureTimer || !entry.desired) return;
    entry.captureTimer=setTimeout(()=>{
      entry.captureTimer=undefined;
      if(entry.desired && entries.get(entry.element)===entry) void capture(entry);
    },delay);
  };
  const prepare=(element: HTMLElement,profile: LensProfile) => {
    const key=[profile.width,profile.height,profile.radius,profile.thickness,profile.ior,profile.distance,profile.paraxial ?? 0].map(n=>n.toFixed(3)).join(":");
    let entry=entries.get(element);
    if(entry?.key!==key) { remove(element); entry=undefined; }
    if(!entry) {
      if(entries.size>=2) {
        const oldest=Array.from(entries.values()).filter(value=>!value.active && !value.desired && !value.capturing).sort((a,b)=>a.lastUsed-b.lastUsed)[0];
        if(oldest) remove(oldest.element);
      }
      const field=buildLensField(profile);
      const refresh: EventListener=() => {
        if(!entry?.ready && !entry?.active) return;
        entry.ready=false;entry.failed=false;entry.generation++;reveal(entry);
        clearTimeout(entry.captureTimer);
        entry.captureTimer=undefined;
        if(entry.desired) queueCapture(entry,90);
        invalidate();
      };
      entry={key,id:`ice-glass-raster-${++nextLens}`,element,field,
        content:texture(),rays:texture(field.data,field.width,field.height),
        ready:false,failed:false,capturing:false,active:false,desired:false,generation:0,lastUsed:performance.now(),refresh};
      entries.set(element,entry);
      for(const event of ["pointerdown","input","change","click"]) element.addEventListener(event,refresh,true);
    }
    entry.lastUsed=performance.now();
    return entry;
  };
  const contextLost=(event: Event) => {
    event.preventDefault();lost=true;
    for(const entry of entries.values()) { entry.generation++;reveal(entry); }
    invalidate();
  };
  canvas.addEventListener("webglcontextlost",contextLost);
  gl.useProgram(program);gl.uniform1i(uniform("uContent"),0);gl.uniform1i(uniform("uRays"),1);
  return {
    beginFrame(width: number,height: number,dpr: number) {
      fallback.beginFrame(width,height,dpr);
      if(lost) return;
      // The optical plane is expensive on Retina displays. Keep it completely
      // idle until a stable Safari hover has an image to paint; previously a
      // second full-viewport buffer was cleared on every material frame.
      frameEnabled=Array.from(entries.values()).some(entry=>entry.active || (entry.ready && entry.desired));
      if(!frameEnabled) {
        if(paintedLastFrame && canvas.width && canvas.height) {
          gl.viewport(0,0,canvas.width,canvas.height);
          gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        }
        paintedLastFrame=false;
        return;
      }
      const cssWidth=width/dpr,cssHeight=height/dpr;
      // The material canvas may lower its idle fill rate. Text needs a denser
      // optical plane, otherwise Safari's raster copy looks softer than the
      // compositor-filtered Chromium DOM. Keep the shared plane bounded.
      const pixelBudget=4_194_304;
      const lensDpr=Math.min(1.25,Math.max(devicePixelRatio||1,1.1),Math.sqrt(pixelBudget/(cssWidth*cssHeight)));
      const lensWidth=Math.max(1,Math.floor(cssWidth*lensDpr)),lensHeight=Math.max(1,Math.floor(cssHeight*lensDpr));
      if(canvas.width!==lensWidth || canvas.height!==lensHeight) { canvas.width=lensWidth;canvas.height=lensHeight; }
      gl.viewport(0,0,lensWidth,lensHeight);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);gl.bindVertexArray(vao);
      gl.uniform2f(uniform("uResolution"),cssWidth,cssHeight);
      paintedLastFrame=true;
    },
    update(element: HTMLElement,profile: LensProfile,lift: number,projection=1,hovered=false) {
      const existing=entries.get(element);
      if(lost || projection<=1.00001 || lift<=.0001) {
        if(existing) {
          existing.desired=false;clearTimeout(existing.captureTimer);existing.captureTimer=undefined;
          reveal(existing);
        }
        fallback.update(element,profile,lift,projection);
        return;
      }
      // Do not rasterise cards merely crossed while the pointer is travelling.
      // A new capture starts only after the pointer has remained over this card
      // briefly; the cheap DOM fallback handles entry and exit transitions.
      if(!existing && !hovered) {
        fallback.update(element,profile,lift,projection);
        return;
      }
      const entry=prepare(element,profile);
      entry.desired=hovered;
      if(hovered) queueCapture(entry);
      else {
        clearTimeout(entry.captureTimer);entry.captureTimer=undefined;
        reveal(entry);
        fallback.update(element,profile,lift,projection);
        return;
      }
      if(!entry.ready) {
        fallback.update(element,profile,lift,projection);
        return;
      }
      fallback.update(element,profile,lift,1);
      if(!entry.active) {
        // Only the card under the pointer may own the costly optical plane.
        // Revealing older cards also prevents hidden DOM accumulating while
        // the user crosses the dashboard quickly.
        for(const other of entries.values()) if(other!==entry && other.active) reveal(other);
        element.dataset.iceLensRaster=entry.id;entry.active=true;
      }
      if(!frameEnabled) return;
      const padding=entry.field.padding+Math.max(profile.width,profile.height)*(projection-1)*.5;
      const left=profile.left ?? 0,top=profile.top ?? 0;
      gl.useProgram(program);gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,entry.content);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,entry.rays);
      gl.uniform4f(uniform("uDrawRect"),left-padding,top-padding,profile.width+padding*2,profile.height+padding*2);
      gl.uniform4f(uniform("uCardRect"),left,top,profile.width,profile.height);
      gl.uniform2f(uniform("uRayExtent"),profile.width+entry.field.padding*2,profile.height+entry.field.padding*2);
      gl.uniform1f(uniform("uRange"),entry.field.range);
      gl.uniform1f(uniform("uStrength"),lift);
      gl.uniform1f(uniform("uProjection"),projection);
      gl.drawArrays(gl.TRIANGLES,0,6);
    },
    retain(elements: Set<HTMLElement>) {
      fallback.retain(elements);
      for(const element of entries.keys()) if(!elements.has(element)) remove(element);
    },
    clear() {
      fallback.clear();
      for(const element of Array.from(entries.keys())) remove(element);
      canvas.removeEventListener("webglcontextlost",contextLost);
      gl.deleteVertexArray(vao);gl.deleteProgram(program);
    },
  };
}

/** DOM optics share the existing renderer's lift clock; there is no new loop. */
export function createGlassLenses(definitions: SVGDefsElement, svgFilters = true, rasterCanvas?: HTMLCanvasElement, invalidate=()=>{}) {
  if(!svgFilters) return rasterCanvas ? createRasterGlassLenses(definitions,rasterCanvas,invalidate) : createScaleGlassLenses(definitions);
  const entries=new Map<HTMLElement,LensEntry>();
  const maps=new Map<string,{href: string; padding: number; range: number}>();
  const bitmap=document.createElement("canvas");
  const context=bitmap.getContext("2d");
  const node=<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string,string | number> = {}) => {
    const element=document.createElementNS(SVG_NS,tag);
    for(const [name,value] of Object.entries(attributes)) element.setAttribute(name,String(value));
    return element;
  };
  const remove=(element: HTMLElement) => {
    const entry=entries.get(element);
    entry?.filter.remove(); entry?.style.remove();
    delete element.dataset.iceLensActive;
    entries.delete(element);
  };
  const update=(element: HTMLElement, profile: LensProfile, lift: number, projection=1, _hovered=false) => {
    void _hovered;
    let entry=entries.get(element);
    if(lift<=0 || !context) {
      if(entry?.active) { delete element.dataset.iceLensActive; entry.active=false; }
      return;
    }
    const key=[profile.width,profile.height,profile.radius,profile.thickness,profile.ior,profile.distance,profile.paraxial ?? 0].map(n=>n.toFixed(3)).join(":");
    if(entry?.key!==key) {
      remove(element);
      // Bound retained filters/textures across long dashboard sessions.
      if(entries.size>=16) {
        const idle=Array.from(entries).find(([,value])=>!value.active);
        if(idle) remove(idle[0]);
      }
      let field=maps.get(key);
      if(!field) {
        const rays=buildLensField(profile);
        bitmap.width=rays.width; bitmap.height=rays.height;
        const pixels=context.createImageData(rays.width,rays.height); pixels.data.set(rays.data); context.putImageData(pixels,0,0);
        field={href:bitmap.toDataURL(),padding:rays.padding,range:rays.range};
        if(maps.size>=16) maps.delete(maps.keys().next().value!);
        maps.set(key,field);
      }
      const id=`ice-glass-lens-${++nextLens}`;
      const filter=node("filter",{id,filterUnits:"userSpaceOnUse",primitiveUnits:"userSpaceOnUse",
        x:-field.padding,y:-field.padding,width:profile.width+field.padding*2,height:profile.height+field.padding*2,"color-interpolation-filters":"sRGB"});
      const image=node("feImage",{href:field.href,x:-field.padding,y:-field.padding,
        width:profile.width+field.padding*2,height:profile.height+field.padding*2,preserveAspectRatio:"none",result:"lensRays"});
      filter.append(image);
      // PNG's neutral byte 128 must decode to exactly 0.5, not 128/255.
      const channels=node("feComponentTransfer",{in:"lensRays",result:"lensCoordinates"});
      for(const channel of ["feFuncR","feFuncG"] as const) channels.append(node(channel,{type:"linear",slope:255/254,intercept:-1/254}));
      const displacement=node("feDisplacementMap",{in:"SourceGraphic",in2:"lensCoordinates",scale:0,xChannelSelector:"R",yChannelSelector:"G"});
      filter.append(channels,displacement);
      const style=node("style");
      style.textContent=`html[data-theme="light"] .content[data-ice-glass="ready"] [data-ice-lens-active="${id}"] { filter: url("#${id}"); }`;
      definitions.append(filter,style);
      entry={key,id,filter,style,image,displacement,range:field.range,padding:field.padding,active:false,scale:"0",projection:1};
      entries.set(element,entry);
    }
    const scale=(entry.range*2*lift).toFixed(4);
    if(scale!==entry.scale) { entry.displacement.setAttribute("scale",scale); entry.scale=scale; }
    if(projection!==entry.projection) {
      const width=(profile.width+entry.padding*2)*projection,height=(profile.height+entry.padding*2)*projection;
      entry.image.setAttribute("x",String((profile.width-width)*.5)); entry.image.setAttribute("y",String((profile.height-height)*.5));
      entry.image.setAttribute("width",String(width)); entry.image.setAttribute("height",String(height));
      entry.projection=projection;
    }
    if(!entry.active) { element.dataset.iceLensActive=entry.id; entry.active=true; }
  };
  return {
    beginFrame(_width: number, _height: number, _dpr: number) { void _width; void _height; void _dpr; },
    update,
    retain(elements: Set<HTMLElement>) { for(const element of entries.keys()) if(!elements.has(element)) remove(element); },
    clear() { for(const element of entries.keys()) remove(element); maps.clear(); },
  };
}
