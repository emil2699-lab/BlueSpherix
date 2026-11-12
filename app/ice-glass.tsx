"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ICE_GLASS as config } from "./ice-glass-config";
import { glassFragment, glassVertex } from "./ice-glass-shader";
import { coatingProgress, useGlassSelection } from "./glass-selection";
import { soapSample } from "./ice-glass-volume";
import { createGlassLenses, supportsDomSvgLensFilters } from "./ice-glass-lens";
import { switchRect } from "./glass-switch-motion";

type ViewportRect = { left: number; top: number; width: number; height: number };
type GlassRect = ViewportRect & { right: number; bottom: number };
type Measurement = { element: HTMLElement; rect: GlassRect; radius: number; tint: number[]; crownHeight: number; todayGlass: boolean; liftable: boolean };
const GLASS_SURFACE_SELECTOR = ".glass-card, .calendar-strip, .demo-notice, .heatmap button, [data-glass-selection], .glass-switch-thumb";
const LIFTABLE_SURFACE_SELECTOR = ".glass-card, .calendar-strip, .demo-notice";
// Keep the overscanned backing store below a conservative Safari allocation
// budget as well as the GPU's per-axis limits. These are physical pixels.
const BUFFER_PIXEL_BUDGET = 4_194_304;

export function IceGlass({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lensCanvasRef = useRef<HTMLCanvasElement>(null);
  const definitionsRef = useRef<SVGDefsElement>(null);
  const coatings = useGlassSelection(rootRef);
  useEffect(() => {
    const canvas = canvasRef.current;
    const lensCanvas = lensCanvasRef.current;
    const root = rootRef.current;
    const definitions = definitionsRef.current;
    if (!canvas || !lensCanvas || !root || !definitions) return;
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false, premultipliedAlpha: true, powerPreference: "low-power" });
    if (!gl) return; // The original dark cards are the no-WebGL fallback.
    // Safari/WebKit advertises CSS/SVG filter support but can drop the whole
    // filtered card (text included) and lock its compositor. Retain the shared
    // WebGL material/caustics while using an unfiltered, readable DOM plane.
    const domLensFilters = supportsDomSvgLensFilters(navigator.userAgent);
    let scheduleLensFrame=()=>{};
    let lenses = createGlassLenses(definitions, domLensFilters, lensCanvas,()=>scheduleLensFrame());
    let program: WebGLProgram | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    let shaders: WebGLShader[] = [];
    let materialTexture: WebGLTexture | null = null;
    let materialBuffer: WebGLFramebuffer | null = null;
    let materialWidth = 0, materialHeight = 0;
    let materialKeys = new Map<HTMLElement, { key: string; bounds: GlassRect }>();
    let materialInvalid = true;
    let gpuTimer: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null = null;
    let gpuSlowSamples = 0;
    const gpuSamples: { query: WebGLQuery; dpr: number }[] = [];
    let frame = 0;
    let dirty = true;
    let viewportDirty = false;
    let lost = false;
    let cards: Measurement[] = [];
    let dpr = Math.min(devicePixelRatio || 1, config.maxDPR);
    let dprCap: number = config.maxDPR;
    let maxBufferWidth = 1;
    let maxBufferHeight = 1;
    let resolutionQuery: MediaQueryList | null = null;
    let viewport: ViewportRect = { left: 0, top: 0, width: innerWidth, height: innerHeight };
    let lastRender = 0;
    let lastPointerTime = 0;
    let slowFrames = 0;
    let settleUntil = 0;
    let resize: ResizeObserver | null = null;
    const observedSurfaces = new Set<Element>();
    const pointer = { x: -10000, y: -10000, presence: 0 };
    const lifts = new Map<HTMLElement,{ value: number; updated: number }>();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const locations = new Map<string, WebGLUniformLocation | null>();
    const uniform = (name: string) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program!, name));
      return locations.get(name)!;
    };
    const dispose = () => {
      lenses.clear();
      shaders.forEach((shader) => gl.deleteShader(shader));
      shaders = [];
      if (program) gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      if (materialTexture) gl.deleteTexture(materialTexture);
      if (materialBuffer) gl.deleteFramebuffer(materialBuffer);
      materialTexture = null; materialBuffer = null;
      materialWidth = 0; materialHeight = 0;
      materialKeys.clear(); materialInvalid = true;
      for(const {query} of gpuSamples) gl.deleteQuery(query);
      gpuSamples.length=0; gpuTimer=null; gpuSlowSamples=0;
      program = null;
      vao = null;
      locations.clear();
    };
    const initialize = () => {
      try {
        program = gl.createProgram();
        if (!program) throw new Error("Ice Glass: program unavailable");
        for (const [type, source] of [[gl.VERTEX_SHADER, glassVertex], [gl.FRAGMENT_SHADER, glassFragment]] as const) {
          const shader = gl.createShader(type);
          if (!shader) throw new Error("Ice Glass: shader unavailable");
          shaders.push(shader);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Ice Glass compilation");
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Ice Glass link");
        vao = gl.createVertexArray();
        materialTexture = gl.createTexture();
        materialBuffer = gl.createFramebuffer();
        if (!materialTexture || !materialBuffer) throw new Error("Ice Glass: material cache unavailable");
        gl.bindTexture(gl.TEXTURE_2D, materialTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindVertexArray(vao);
        gl.useProgram(program);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const viewportLimits = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
        const sideLimit = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),gl.getParameter(gl.MAX_TEXTURE_SIZE));
        maxBufferWidth = Math.min(sideLimit,viewportLimits[0]);
        maxBufferHeight = Math.min(sideLimit,viewportLimits[1]);
        dprCap = config.maxDPR;
        gpuTimer=gl.getExtension("EXT_disjoint_timer_query_webgl2");
      } catch (error) {
        console.warn("Ice Glass uses the dark-card fallback:", error);
        dispose();
        delete root.dataset.iceGlass;
      }
    };
    const readViewport = (): ViewportRect => {
      // The canvas shares the content's scrolling layer. Overscan keeps glass
      // attached even while Safari scrolls without waiting for JavaScript.
      const bounds=root.getBoundingClientRect();
      const screenHeight=Math.max(1,window.visualViewport?.height || innerHeight);
      const height=Math.max(1,Math.min(bounds.height,screenHeight*2));
      const visibleTop=Math.max(0,-bounds.top+(window.visualViewport?.offsetTop || 0));
      const step=screenHeight*.25;
      const top=Math.max(0,Math.min(Math.floor((visibleTop-screenHeight*.5)/step)*step,bounds.height-height));
      const cssHeight=`${height}px`,cssTop=`${top}px`;
      if(canvas.style.height!==cssHeight)canvas.style.height=cssHeight;
      if(canvas.style.top!==cssTop)canvas.style.top=cssTop;
      if(lensCanvas.style.height!==cssHeight)lensCanvas.style.height=cssHeight;
      if(lensCanvas.style.top!==cssTop)lensCanvas.style.top=cssTop;
      const rect = canvas.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width || document.documentElement.clientWidth,
        height: rect.height || document.documentElement.clientHeight,
      };
    };
    const measure = (nextViewport = readViewport()) => {
      materialInvalid = true;
      viewport = nextViewport;
      cards = Array.from(root.querySelectorAll<HTMLElement>(GLASS_SURFACE_SELECTOR)).filter(element=>!element.closest("[hidden]")).map((element) => {
        const style = getComputedStyle(element);
        const thumbTint = element.matches('.glass-switch-thumb') ? style.color.match(/[\d.]+/g)?.slice(0,3).map(n=>Number(n)/255) : undefined;
        const tint = coatings.current.get(element)?.tint ?? thumbTint ?? (element.matches(".negative-surface, .negative-strong, .critical, .risk-critical, .failed, .loss, .diary-loss, .negative-row, .heat-negative") ? [1,.34,.43]
          : element.matches(".heat-neutral") ? [.56,.64,.71]
          : element.matches(".violet, .insight-card, .lab-validation") ? [.64,.46,1]
          : element.matches(".amber, .calendar-strip, .warning, .risk-warning") ? [1,.62,.24]
          : [.31,.77,.87]);
        const domRect = element.getBoundingClientRect();
        const left = domRect.left-nextViewport.left;
        const top = domRect.top-nextViewport.top;
        const rect = { left, top, width: domRect.width, height: domRect.height, right: left+domRect.width, bottom: top+domRect.height };
        const radius=parseFloat(style.borderTopLeftRadius) || 14;
        const halfWidth=rect.width*.5,halfHeight=rect.height*.5;
        const liftable=element.matches(LIFTABLE_SURFACE_SELECTOR);
        const daylightCard=document.documentElement.dataset.theme === "light" && liftable;
        const todayGlass=element.closest(".today-dashboard") !== null && liftable;
        const materialRadius=todayGlass ? config.todayRadius : radius;
        const opticalRadius=Math.min(Math.min(halfWidth,halfHeight)*.95,daylightCard ? materialRadius : Math.max(radius*1.75,24));
        const daylightThickness=todayGlass ? config.todayThickness : config.daylightThickness;
        const thickness=Math.min(daylightCard ? daylightThickness : config.glassThickness*2.1,Math.min(halfWidth,halfHeight)*.5);
        const crownHeight=rect.width && rect.height ? soapSample(0,0,halfWidth,halfHeight,opticalRadius,thickness)[2] : 0;
        return { element, rect, radius, tint, crownHeight, todayGlass, liftable };
      });
      cards = cards.filter(card=>card.rect.width>0 && card.rect.height>0);
      const currentElements=new Set(cards.map(card=>card.element));
      for(const element of lifts.keys()) if(!currentElements.has(element)) lifts.delete(element);
      lenses.retain(currentElements);
      dirty = false;
    };
    const fitDrawingBuffer = (quality = 1) => {
      // Page zoom can enlarge the CSS viewport without reducing Safari's DPR.
      // Reduce only raster resolution; all optical lengths stay in CSS pixels.
      for (let attempt = 0; attempt < 3; attempt++) {
        dpr = Math.min((devicePixelRatio || 1)*quality,dprCap,
          maxBufferWidth/viewport.width,maxBufferHeight/viewport.height,
          Math.sqrt(BUFFER_PIXEL_BUDGET/(viewport.width*viewport.height)));
        const width = Math.max(1,Math.floor(viewport.width*dpr));
        const height = Math.max(1,Math.floor(viewport.height*dpr));
        if (canvas.width !== width || canvas.height !== height || !gl.drawingBufferWidth || !gl.drawingBufferHeight) {
          canvas.width = width;
          canvas.height = height;
        }
        // The requested attributes can survive a failed allocation. Hide the
        // CSS fallback only after the actual WebGL buffer matches the request.
        if (gl.drawingBufferWidth === width && gl.drawingBufferHeight === height) return { width, height };
        if (gl.isContextLost()) break;
        dprCap = dpr*.5;
      }
      delete root.dataset.iceGlass;
      return null;
    };
    const draw = (time: number) => {
      frame = 0;
      if (lost || !program || document.hidden) return;
      if(viewportDirty && !dirty) {
        const top=canvas.style.top;
        const next=readViewport();
        // Within the overscan tile all card/canvas coordinates are unchanged
        // by document scrolling. Only the viewport's screen offset changes.
        if(top!==canvas.style.top || next.width!==viewport.width || next.height!==viewport.height) dirty=true;
        else viewport=next;
      }
      viewportDirty=false;
      // Pointer frames reuse layout. Reading bounds after changing an optical
      // filter would otherwise synchronously flush the browser's style/layout.
      if (dirty) measure();
      const viewWidth = viewport.width, viewHeight = viewport.height;
      const visibleTop=Math.max(0,-viewport.top-48);
      const visibleBottom=Math.min(viewHeight,-viewport.top+(window.visualViewport?.height || innerHeight)+48);
      const lightMode = document.documentElement.dataset.theme === "light";
      // Read completed GPU timings only. Frame intervals include deliberate
      // idle time and cannot reliably tell whether the GPU needs less work.
      if(gpuTimer) for(let i=gpuSamples.length-1;i>=0;i--) {
        const sample=gpuSamples[i];
        if(!gl.getQueryParameter(sample.query,gl.QUERY_RESULT_AVAILABLE)) continue;
        if(!gl.getParameter(gpuTimer.GPU_DISJOINT_EXT)) {
          const elapsed=gl.getQueryParameter(sample.query,gl.QUERY_RESULT)/1_000_000;
          if(elapsed>18 && sample.dpr<=dprCap) {
            if(++gpuSlowSamples>=3) {
              dprCap=Math.max(.65,Math.min(dprCap,sample.dpr*Math.sqrt(12/elapsed)));
              gpuSlowSamples=0;
            }
          } else gpuSlowSamples=Math.max(0,gpuSlowSamples-1);
        }
        gl.deleteQuery(sample.query);gpuSamples.splice(i,1);
      }
      // Daylight caustics extend beyond every silhouette. A modest shared raster
      // scale offsets that extra fill cost without creating a second render loop
      // or changing CSS-pixel geometry, pointer coordinates or optical lengths.
      const buffer = fitDrawingBuffer(lightMode ? .82 : 1);
      if (!buffer) return;
      const { width, height } = buffer;
      lenses.beginFrame(width,height,dpr);
      if (root.hidden) return;
      // Retain material in one shared GPU texture. Only changed regions need
      // the optical shader; neighbouring stationary cards keep their pixels.
      gl.bindTexture(gl.TEXTURE_2D, materialTexture);
      gl.bindFramebuffer(gl.FRAMEBUFFER, materialBuffer);
      if (materialWidth !== width || materialHeight !== height) {
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,materialTexture,0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          delete root.dataset.iceGlass;
          return;
        }
        materialWidth=width; materialHeight=height; materialInvalid=true;
      }
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uniform("uResolution"), width, height);
      gl.uniform1f(uniform("uDPR"),dpr);
      gl.uniform3f(uniform("uLight"),pointer.x-viewport.left,pointer.y-viewport.top,reduced.matches ? 0 : pointer.presence);
      gl.uniform4f(uniform("uGlass"),config.glassIOR,config.glassThickness,config.glassRoughness,config.glassOpacity);
      gl.uniform1f(uniform("uBodyOpacity"),config.glassBodyOpacity);
      gl.uniform4f(uniform("uOptics"),config.fresnelStrength,config.chromaticDispersion,config.edgeRefraction,config.internalReflection);
      gl.uniform4f(uniform("uEnergy"),config.ambientReflection,config.lightIntensity,config.lightHeight,config.lightFalloff);
      gl.uniform3f(uniform("uFinish"),config.specularSharpness,config.bloomIntensity,config.bloomRadius);
      gl.uniform1f(uniform("uTheme"),lightMode ? 1 : 0);
      gl.uniform1f(uniform("uDaylightThickness"),config.daylightThickness);
      gl.uniform1f(uniform("uLiftDistance"),config.daylightLift);
      gl.enable(gl.SCISSOR_TEST);
      const nextKeys = new Map<HTMLElement, { key: string; bounds: GlassRect }>();
      const paints: { bounds: GlassRect; paint: () => void }[] = [];
      let damaged: GlassRect | undefined;
      const damage = (bounds: GlassRect) => {
        const left=Math.max(0,Math.min(damaged?.left ?? viewWidth,bounds.left));
        const top=Math.max(0,Math.min(damaged?.top ?? viewHeight,bounds.top));
        const right=Math.min(viewWidth,Math.max(damaged?.right ?? 0,bounds.right));
        const bottom=Math.min(viewHeight,Math.max(damaged?.bottom ?? 0,bounds.bottom));
        damaged={left,top,right,bottom,width:right-left,height:bottom-top};
      };
      let coatingMoving = false;
      let liftMoving = false;
      // Multiple checked controls retain their own glass and underlight. Keep
      // the existing neighbouring-rim pass anchored to the latest active choice.
      // Reuse measurements; this adds no DOM reads to pointer frames.
      const emitter = cards.reduce<Measurement | undefined>((latest,card) => {
        const candidate = coatings.current.get(card.element);
        if (!candidate) return latest;
        const previous = latest && coatings.current.get(latest.element);
        if (!previous) return card;
        if ((candidate.exiting === undefined) !== (previous.exiting === undefined)) return candidate.exiting === undefined ? card : latest;
        return candidate.started > previous.started ? card : latest;
      },undefined);
      const emission = emitter && coatings.current.get(emitter.element);
      const power = emitter ? Math.max(0,Math.min(1,Number(emitter.element.dataset.glassUnderlight ?? 1)||0)) : 0;
      const emissionPhase = emission ? coatingProgress(emission,time,reduced.matches) : [0,0,0,0,0];
      coatingMoving ||= emissionPhase[3]>0;
      // The procedural underlight settles with the coating. Capping its phase
      // prevents a later pointer event from jumping the pattern forward after
      // the idle render loop has deliberately stopped.
      const emissionTime = reduced.matches || !emission ? 0 : Math.min((time-emission.started)/1000,.88);
      const emissionTint = emission?.tint ?? [1,1,1];
      const emitterRect = emitter && emission?.travel && !reduced.matches
        ? switchRect(emitter.rect,emission.travel,(emission.exiting ?? time)-emission.started) : emitter?.rect;
      gl.uniform4f(uniform("uSpillRect"), emitterRect?.left ?? 0,emitterRect?.top ?? 0,emitterRect?.width ?? 1,emitterRect?.height ?? 1);
      gl.uniform2f(uniform("uSpillOrigin"),...(emission?.origin ?? [.5,.5] as [number,number]));
      gl.uniform3f(uniform("uSpillTint"),emissionTint[0],emissionTint[1],emissionTint[2]);
      for (const { element, rect: measuredRect, radius, tint, crownHeight, todayGlass, liftable } of cards) {
        const coating = coatings.current.get(element);
        const thumb = element.matches('.glass-switch-thumb');
        const thumbOn = thumb && (element.closest('.protection-switch')?.classList.contains('on')
          || element.closest('.lab-cost-toggle')?.querySelector<HTMLInputElement>('input')?.checked);
        const rect = coating?.travel && !reduced.matches
          ? switchRect(measuredRect,coating.travel,(coating.exiting ?? time)-coating.started) : measuredRect;
        // Do not build inverse-ray maps or animate lenses for offscreen cards.
        // Keep material overscan for compositor scrolling, but limit DOM optics
        // to the actual visual viewport (including the projected glass edge).
        const screenTop = -viewport.top;
        const screenBottom = screenTop+(window.visualViewport?.height || innerHeight);
        const lensVisible = rect.bottom+120>screenTop && rect.top-120<screenBottom;
        const pointerX=pointer.x-viewport.left, pointerY=pointer.y-viewport.top;
        const hovered=lightMode && liftable && lensVisible && pointer.presence>0 && pointerX>=rect.left && pointerX<=rect.right && pointerY>=rect.top && pointerY<=rect.bottom;
        let liftState=lifts.get(element);
        if(!liftState) { liftState={ value: 0, updated: time }; lifts.set(element,liftState); }
        const liftTarget=hovered && !reduced.matches ? 1 : 0;
        // Use elapsed wall time: clamping to 64ms stretched a short transition
        // into many seconds whenever GPU/compositor frames were already slow.
        const elapsed=Math.max(0,time-liftState.updated);
        const response=1-Math.exp(-elapsed/(liftTarget>.5 ? 118 : 185));
        liftState.value+= (liftTarget-liftState.value)*response;
        liftState.updated=time;
        if(Math.abs(liftTarget-liftState.value)<.002) liftState.value=liftTarget;
        else liftMoving=true;
        const lift=liftState.value;
        // The reference material is a daylight-only treatment. Keeping this
        // gate here (rather than only in CSS) preserves the original dark-room
        // radius, thickness, projection and lens map byte-for-byte.
        const referenceGlass=lightMode && todayGlass;
        const liftDistance=referenceGlass ? config.todayLift : config.daylightLift;
        const perspective=referenceGlass ? config.todayPerspective : config.daylightPerspective;
        const daylightThickness=referenceGlass ? config.todayThickness : config.daylightThickness;
        const materialRadius=referenceGlass ? Math.min(config.todayRadius,rect.width*.475,rect.height*.475) : radius;
        // Project only the optical layer towards the viewer. Hit testing and
        // DOM content keep the original rectangle, with no X/Y translation.
        const projection=lightMode && liftable
          ? perspective/(perspective-lift*liftDistance) : 1;
        const lensStrength=lift;
        lenses.update(element,{
          left:rect.left,top:rect.top,
          width:rect.width,height:rect.height,
          radius:materialRadius,
          thickness:Math.min(daylightThickness,rect.width*.25,rect.height*.25),
          ior:config.glassIOR,distance:liftDistance,
          paraxial:referenceGlass ? config.todayParaxial : 0,
        },lightMode && liftable && lensVisible && !reduced.matches ? lensStrength : 0,lensVisible ? projection : 1,hovered);
        const projectionPad=lightMode && liftable ? (referenceGlass ? 72+lift*20 : 38+lift*10) : 0;
        const padX=projectionPad+rect.width*(projection-1)*.5;
        const padY=projectionPad+rect.height*(projection-1)*.5;
        const drawRect={ left:rect.left-padX, top:rect.top-padY, width:rect.width+padX*2,
          height:rect.height+padY*2, right:rect.right+padX, bottom:rect.bottom+padY };
        if (drawRect.bottom <= 0 || drawRect.top >= viewHeight || drawRect.right <= 0 || drawRect.left >= viewWidth || !rect.width) continue;
        const [reveal, isControl, opacity, moving, volume] = coating ? coatingProgress(coating, time, reduced.matches) : [1, thumb ? 1 : 0, 1, 0, 1];
        coatingMoving ||= moving > 0;
        const receivesSpill = !!(emitter && power > .35 && element.matches('.glass-card')
          && !element.contains(emitter.element) && !emitter.element.contains(element));
        const underlight = coating
          ? Math.max(0, Math.min(1, Number(element.dataset.glassUnderlight ?? 1) || 0)) : thumbOn ? .45 : 0;
        const underlightTime = reduced.matches || !coating ? 0 : Math.min((time-coating.started)/1000,.88);
        const cursorAffects = !lightMode && drawRect.bottom>visibleTop && drawRect.top<visibleBottom && Math.hypot(
          Math.max(rect.left-pointerX,0,pointerX-rect.right),
          Math.max(rect.top-pointerY,0,pointerY-rect.bottom)) < config.lightFalloff*2.75+config.glassThickness*3;
        const key = [lightMode,rect.left,rect.top,rect.width,rect.height,lift,reveal,isControl,opacity,volume,
          underlight,underlightTime,receivesSpill ? `${power}:${emissionTime}:${emissionPhase}` : "",
          cursorAffects ? `${pointerX}:${pointerY}:${pointer.presence}` : ""].join("|");
        const previous=materialKeys.get(element);
        nextKeys.set(element,{key,bounds:drawRect});
        if(previous?.key!==key) { if(previous) damage(previous.bounds); damage(drawRect); }
        paints.push({bounds:drawRect,paint:()=>{
          gl.uniform1f(uniform("uControlBrightness"), coating?.luminous || thumb ? 1.5 : 1);
          gl.uniform4f(uniform("uSpill"),power,emissionTime,
            emissionPhase[0]*emissionPhase[2]*emissionPhase[4],receivesSpill ? 1 : 0);
          gl.uniform2f(uniform("uUnderlight"), underlight,
            underlightTime);
          gl.uniform4f(uniform("uCoating"), reveal, isControl, opacity, volume);
          gl.uniform2f(uniform("uCoatingOrigin"), ...(coating?.origin ?? [.5, .5] as [number, number]));
          gl.uniform4f(uniform("uRect"),rect.left,rect.top,rect.width,rect.height);
          gl.uniform4f(uniform("uDrawRect"),drawRect.left,drawRect.top,drawRect.width,drawRect.height);
          gl.uniform1f(uniform("uRadius"),materialRadius);
          gl.uniform1f(uniform("uLift"),lift);
          gl.uniform1f(uniform("uLiftDistance"),liftDistance);
          gl.uniform1f(uniform("uDaylightThickness"),daylightThickness);
          gl.uniform1f(uniform("uProjection"),projection);
          gl.uniform1f(uniform("uLightGlass"),liftable ? 1 : 0);
          gl.uniform1f(uniform("uReferenceGlass"),referenceGlass ? 1 : 0);
          const movingCrown = coating?.travel ? soapSample(0,0,rect.width*.5,rect.height*.5,
            Math.min(Math.min(rect.width,rect.height)*.475,Math.max(radius*1.75,24)),
            Math.min(config.glassThickness*2.1,Math.min(rect.width,rect.height)*.25))[2] : crownHeight;
          gl.uniform1f(uniform("uCrownHeight"),movingCrown);
          gl.uniform3f(uniform("uTint"),tint[0],tint[1],tint[2]);
          gl.drawArrays(gl.TRIANGLES,0,6);
        }});
      }
      for (const [element,previous] of materialKeys) if(!nextKeys.has(element)) damage(previous.bounds);
      materialKeys=nextKeys;
      if(materialInvalid) damaged={left:0,top:0,right:viewWidth,bottom:viewHeight,width:viewWidth,height:viewHeight};
      else if(damaged) {
        damaged.top=Math.max(damaged.top,visibleTop);
        damaged.bottom=Math.min(damaged.bottom,visibleBottom);
        damaged.height=damaged.bottom-damaged.top;
      }
      if(damaged && damaged.width>0 && damaged.height>0) {
        const query=gpuTimer && gpuSamples.length<3 ? gl.createQuery() : null;
        if(query) gl.beginQuery(gpuTimer!.TIME_ELAPSED_EXT,query);
        const region=damaged;
        const scissor=(bounds:GlassRect)=>{
          const left=Math.max(0,Math.floor(Math.max(bounds.left,region.left)*dpr));
          const right=Math.min(width,Math.ceil(Math.min(bounds.right,region.right)*dpr));
          const bottom=Math.max(0,Math.floor((viewHeight-Math.min(bounds.bottom,region.bottom))*dpr));
          const top=Math.min(height,Math.ceil((viewHeight-Math.max(bounds.top,region.top))*dpr));
          gl.scissor(left,bottom,Math.max(0,right-left),Math.max(0,top-bottom));
        };
        gl.viewport(0,0,width,height);
        scissor(region);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        for(const {bounds,paint} of paints) {
          if(bounds.right<=region.left || bounds.left>=region.right || bounds.bottom<=region.top || bounds.top>=region.bottom) continue;
          scissor(bounds);paint();
        }
        // A cheap texture copy presents the complete layer. The default canvas
        // can discard its back buffer; no preserveDrawingBuffer is required.
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER,materialBuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
        gl.disable(gl.SCISSOR_TEST);
        gl.blitFramebuffer(0,0,width,height,0,0,width,height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
        if(query) { gl.endQuery(gpuTimer!.TIME_ELAPSED_EXT);gpuSamples.push({query,dpr}); }
        materialInvalid=false;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      if (root.dataset.iceGlass !== "ready") root.dataset.iceGlass = "ready";
      canvas.dataset.pointer = `${pointer.x},${pointer.y}`;
      // Adapt resolution only under sustained activity, never interpolate position.
      const settling = time < settleUntil;
      if (!gpuTimer && !settling && lastRender && (liftMoving || (!lightMode && time-lastPointerTime<100)) && time-lastRender > 24) slowFrames++;
      else slowFrames = Math.max(0,slowFrames-1);
      lastRender = time;
      if (slowFrames > 4 && dprCap > .65) { dprCap = Math.max(.65,dpr*.8); slowFrames = 0; }
      // A browser zoom can move a card for several frames while responsive CSS
      // and font metrics settle. ResizeObserver sees size changes, not every
      // positional shift caused by siblings, so remeasure briefly after zoom.
      if (settling || coatingMoving || liftMoving) { if (settling) dirty = true; schedule(); }
    };
    const schedule = () => {
      if (!frame && !lost && !document.hidden) frame = requestAnimationFrame(draw);
    };
    scheduleLensFrame=schedule;
    const invalidate = () => { dirty = true; schedule(); };
    const scrollChanged = (event: Event) => {
      if(event.target instanceof Element && event.target!==document.documentElement && event.target!==document.body) { invalidate(); return; }
      viewportDirty=true; schedule();
    };
    const settleLayout = () => { settleUntil = performance.now()+700; invalidate(); };
    const watchResolution = () => {
      resolutionQuery?.removeEventListener("change",resolutionChanged);
      resolutionQuery = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
      resolutionQuery.addEventListener("change",resolutionChanged);
    };
    const resolutionChanged = () => { watchResolution(); settleLayout(); };
    const syncObservedSurfaces = () => {
      if (!resize) return;
      const current = new Set(root.querySelectorAll(GLASS_SURFACE_SELECTOR));
      for (const surface of observedSurfaces) {
        if (!current.has(surface)) { resize.unobserve(surface); observedSurfaces.delete(surface); }
      }
      for (const surface of current) {
        if (!observedSurfaces.has(surface)) { resize.observe(surface); observedSurfaces.add(surface); }
      }
    };
    const hoverAt = (x: number,y: number) => cards.find(card=>card.liftable
      && x>=card.rect.left+viewport.left && x<=card.rect.right+viewport.left
      && y>=card.rect.top+viewport.top && y<=card.rect.bottom+viewport.top)?.element;
    const move: EventListener = (nativeEvent) => {
      const event = nativeEvent as PointerEvent;
      if (event.pointerType === "touch" || root.hidden || reduced.matches) return;
      const lightMode=document.documentElement.dataset.theme === "light";
      const previous = lightMode && pointer.presence ? hoverAt(pointer.x,pointer.y) : undefined;
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.presence = 1;
      lastPointerTime=performance.now();
      // Daylight is fixed in the room. Motion inside the same card changes no
      // optical state; the lift clock schedules its own frames until settled.
      if (lightMode && previous===hoverAt(pointer.x,pointer.y)) return;
      schedule();
    };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) { pointer.presence = 0; schedule(); } };
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else invalidate(); };
    const contextLost = (event: Event) => {
      event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;
      // Release references while the context is lost. After restoration these
      // handles belong to the old generation and must not be deleted again.
      dispose();delete root.dataset.iceGlass;
    };
    const contextRestored = () => {
      dispose();
      lenses=createGlassLenses(definitions,domLensFilters,lensCanvas,()=>scheduleLensFrame());
      lost = false; initialize(); invalidate();
    };
    const themeChanged = () => { settleUntil=performance.now()+650; invalidate(); };
    const layoutTransition = (event: TransitionEvent) => {
      if (/^(transform|translate|scale|width|height|padding|margin|gap|grid-template|flex-basis|top|left|right|bottom)/.test(event.propertyName)) settleLayout();
    };
    initialize();
    watchResolution();
    resize = new ResizeObserver(settleLayout);
    resize.observe(root);
    syncObservedSurfaces();
    const mutation = new MutationObserver(records => {
      if(records.every(record=>record.target===canvas || record.target===lensCanvas || definitions.contains(record.target)))return;
      syncObservedSurfaces();
      // A coating changes material coverage, not layout. Reuse cached rectangles.
      if (records.every(record => record.attributeName === "data-glass-selection")) invalidate();
      else settleLayout();
    });
    mutation.observe(root,{ childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "style", "data-glass-selection", "data-glass-underlight"] });
    window.addEventListener("pointermove",move,{passive:true});
    window.addEventListener("pointerout",leave,{passive:true});
    window.addEventListener("resize",settleLayout,{passive:true});
    window.addEventListener("scroll",scrollChanged,{passive:true,capture:true});
    window.visualViewport?.addEventListener("resize",settleLayout,{passive:true});
    window.visualViewport?.addEventListener("scroll",scrollChanged,{passive:true});
    root.addEventListener("transitionrun",layoutTransition);
    root.addEventListener("transitionend",layoutTransition);
    root.addEventListener("glassswitchmotion",settleLayout);
    document.addEventListener("visibilitychange",visibility);
    window.addEventListener("bluespherix:theme",themeChanged);
    reduced.addEventListener("change",schedule);
    canvas.addEventListener("webglcontextlost",contextLost);
    canvas.addEventListener("webglcontextrestored",contextRestored);
    invalidate();
    return () => {
      cancelAnimationFrame(frame); resize?.disconnect(); mutation.disconnect();
      resolutionQuery?.removeEventListener("change",resolutionChanged);
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerout",leave); window.removeEventListener("resize",settleLayout);
      window.removeEventListener("scroll",scrollChanged,true); root.removeEventListener("transitionrun",layoutTransition); root.removeEventListener("transitionend",layoutTransition);
      root.removeEventListener("glassswitchmotion",settleLayout);
      window.visualViewport?.removeEventListener("resize",settleLayout); window.visualViewport?.removeEventListener("scroll",scrollChanged);
      document.removeEventListener("visibilitychange",visibility); reduced.removeEventListener("change",schedule);
      window.removeEventListener("bluespherix:theme",themeChanged);
      canvas.removeEventListener("webglcontextlost",contextLost); canvas.removeEventListener("webglcontextrestored",contextRestored);
      delete root.dataset.iceGlass;dispose();
    };
  },[rootRef, coatings]);
  return <>
    <canvas ref={canvasRef} className="ice-glass-canvas" aria-hidden="true" />
    <canvas ref={lensCanvasRef} className="ice-glass-lens-canvas" aria-hidden="true" />
    <svg className="ice-glass-refraction-defs" aria-hidden="true">
      <defs ref={definitionsRef} />
    </svg>
  </>;
}
