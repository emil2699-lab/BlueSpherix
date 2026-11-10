import { daylightTraceVertex, daylightCausticVertex, daylightCausticFragment, daylightCompositeVertex, daylightCompositeFragment } from "./ice-glass-daylight-shader";
import { createLensMaps, LENS_MAP_NEUTRAL, type LensShape } from "./ice-glass-daylight";

export type DaylightSurface = LensShape & { left: number; top: number; lift: number };

export class DaylightRenderer {
  private programs: WebGLProgram[] = [];
  private shaders: WebGLShader[] = [];
  private texture: WebGLTexture | null = null;
  private target: WebGLFramebuffer | null = null;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private scene = "";
  private meshes = new Map<string, { buffer: WebGLBuffer; vao: WebGLVertexArrayObject }>();
  private locations = new Map<string, WebGLUniformLocation | null>();
  private uniform(index: number, name: string) {
    const key=`${index}:${name}`;
    if(!this.locations.has(key))this.locations.set(key,this.gl.getUniformLocation(this.programs[index],name));
    return this.locations.get(key)!;
  }
  constructor(private gl: WebGL2RenderingContext) {
    try {
      this.texture = gl.createTexture(); this.target = gl.createFramebuffer();
      if (!this.texture || !this.target) throw new Error("Daylight render target unavailable");
      for (const sources of [[daylightTraceVertex, daylightCausticFragment], [daylightCausticVertex, daylightCausticFragment], [daylightCompositeVertex, daylightCompositeFragment]]) {
        const program = gl.createProgram();
        if (!program) throw new Error("Daylight program unavailable");
        this.programs.push(program);
        sources.forEach((source, i) => {
          const shader = gl.createShader(i ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER);
          if (!shader) throw new Error("Daylight shader unavailable");
          this.shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Daylight shader");
          gl.attachShader(program, shader);
        });
        if(this.programs.length===1)gl.transformFeedbackVaryings(program,["vBase","vSlope","vSource","vEnergy"],gl.INTERLEAVED_ATTRIBS);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Daylight link");
      }
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } catch (error) { this.dispose(); throw error; }
  }
  update(width: number, height: number, dpr: number, surfaces: DaylightSurface[]) {
    // Pointer motion changes reflections, but not the incident sunlight.
    // Retain the irradiance texture until a receiver, its height or DPR changes.
    const scene = JSON.stringify([width,height,dpr,surfaces.map(s =>
      [s.left,s.top,s.width,s.height,s.radius,s.lift])]);
    if (scene === this.scene) return;
    this.begin(width,height,dpr);
    for (const surface of surfaces) this.card(surface.left,surface.top,surface,surface.lift);
    this.end(width,height);
    this.scene = scene;
  }
  begin(width: number, height: number, dpr: number) {
    const gl = this.gl;
    this.ratio = dpr * .65;
    const w = Math.max(1, Math.floor(width * .65)), h = Math.max(1, Math.floor(height * .65));
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target);
    if (w !== this.width || h !== this.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("Daylight framebuffer unavailable");
      this.width = w; this.height = h;
    }
    gl.disable(gl.SCISSOR_TEST); gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE); gl.useProgram(this.programs[1]);
    gl.uniform2f(this.uniform(1, "uResolution"), w, h);
    gl.uniform1f(this.uniform(1, "uDPR"), this.ratio);
  }
  card(left: number, top: number, shape: LensShape, lift: number) {
    const gl = this.gl, key=`${shape.width.toFixed(1)},${shape.height.toFixed(1)},${shape.radius}`;
    const count=40*24*6*6;
    let mesh=this.meshes.get(key);
    if(!mesh) {
      const buffer=gl.createBuffer(),vao=gl.createVertexArray(),feedback=gl.createTransformFeedback();
      if (!buffer || !vao || !feedback) {
        gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);gl.deleteTransformFeedback(feedback);
        throw new Error("Daylight geometry unavailable");
      }
      gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,count*9*4,gl.STATIC_COPY);
      gl.bindBuffer(gl.ARRAY_BUFFER,null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,buffer);
      gl.enable(gl.RASTERIZER_DISCARD);gl.useProgram(this.programs[0]);
      gl.uniform4f(this.uniform(0,"uRect"),0,0,shape.width,shape.height);
      gl.uniform1f(this.uniform(0,"uRadius"),shape.radius);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArraysInstanced(gl.POINTS,0,40*24*6,6);
      gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);gl.deleteTransformFeedback(feedback);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(const [index,size,offset] of [[0,2,0],[1,2,2],[2,2,4],[3,3,6]]) {
        gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,36,offset*4);
      }
      mesh={buffer,vao};this.meshes.set(key,mesh);
      if(this.meshes.size>24) {
        const first=this.meshes.keys().next().value!;const stale=this.meshes.get(first)!;
        gl.deleteBuffer(stale.buffer);gl.deleteVertexArray(stale.vao);this.meshes.delete(first);
      }
    } else { this.meshes.delete(key);this.meshes.set(key,mesh); }
    gl.useProgram(this.programs[1]);gl.bindVertexArray(mesh.vao);
    gl.uniform4f(this.uniform(1,"uRect"),left,top,shape.width,shape.height);
    gl.uniform1f(this.uniform(1,"uLift"),lift);
    gl.drawArrays(gl.TRIANGLES,0,count);
  }
  end(width: number, height: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, width, height);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  composite(width: number, height: number, cssWidth: number, cssHeight: number, dpr: number) {
    const gl = this.gl, program = this.programs[2];
    gl.disable(gl.SCISSOR_TEST); gl.useProgram(program); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniform(2, "uCaustics"), 0);
    gl.uniform2f(this.uniform(2, "uResolution"), width, height);
    gl.uniform1f(this.uniform(2, "uDPR"), dpr);
    gl.uniform4f(this.uniform(2, "uDrawRect"), 0, 0, cssWidth, cssHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  dispose() {
    const gl = this.gl;
    this.programs.forEach(p => gl.deleteProgram(p)); this.shaders.forEach(s => gl.deleteShader(s));
    for(const {buffer,vao} of this.meshes.values()) { gl.deleteBuffer(buffer);gl.deleteVertexArray(vao); }
    this.meshes.clear();this.locations.clear();
    gl.deleteFramebuffer(this.target); gl.deleteTexture(this.texture);
    this.programs=[];this.shaders=[];this.texture=null;this.target=null;this.scene="";
  }
}

const SVG = "http://www.w3.org/2000/svg";
let nextFilter = 0;
export class LensFilters {
  private filters = new Map<HTMLElement, { key: string; filter: SVGFilterElement; mix: SVGFECompositeElement; lift: number }>();
  private unavailable = false;
  constructor(private defs: SVGDefsElement) {}
  update(element: HTMLElement, shape: LensShape, lift: number) {
    if(lift === 0 || this.unavailable) {
      const lens=element.style.getPropertyValue("--glass-lens");
      if(lens && lens!=="none")element.style.setProperty("--glass-lens","none");
      return;
    }
    const key = `${shape.width.toFixed(1)},${shape.height.toFixed(1)},${shape.radius}`;
    let state = this.filters.get(element);
    if (!state || state.key !== key) {
      state?.filter.remove();
      const maps = createLensMaps(shape), id = `ice-glass-lens-${++nextFilter}`;
      if (!maps) { this.unavailable=true;this.update(element,shape,0);return; }
      const filter = document.createElementNS(SVG, "filter");
      filter.id = id;
      filter.setAttribute("filterUnits", "userSpaceOnUse"); filter.setAttribute("color-interpolation-filters", "sRGB");
      const bounds = { x: -maps.pad, y: -maps.pad, width: maps.width, height: maps.height };
      for (const [k, v] of Object.entries(bounds)) filter.setAttribute(k, String(v));
      for (const [href, result] of [[maps.baseURL, "inside"], [maps.gapURL, "air"]]) {
        const image = document.createElementNS(SVG, "feImage");
        image.setAttribute("href", href); image.setAttribute("result", result); image.setAttribute("preserveAspectRatio", "none");
        for (const [k, v] of Object.entries(bounds)) image.setAttribute(k, String(v));
        filter.append(image);
      }
      const mix = document.createElementNS(SVG, "feComposite");
      for (const [k, v] of Object.entries({ in: "inside", in2: "air", operator: "arithmetic", k2: "1", k3: "0", k4: "0", result: "lens" })) mix.setAttribute(k, v);
      filter.append(mix);
      const displacement = document.createElementNS(SVG, "feDisplacementMap");
      for (const [k, v] of Object.entries({ in: "SourceGraphic", in2: "lens", scale: String(maps.scale), xChannelSelector: "R", yChannelSelector: "G" })) displacement.setAttribute(k, v);
      filter.append(displacement); this.defs.append(filter);
      element.style.setProperty("--glass-lens", `url("#${id}")`);
      state = { key, filter, mix, lift: -1 }; this.filters.set(element, state);
    }
    if(element.style.getPropertyValue("--glass-lens")==="none")element.style.setProperty("--glass-lens",`url("#${state.filter.id}")`);
    if (Math.abs(lift - state.lift) > .001) {
      state.mix.setAttribute("k2", lift.toFixed(4));
      state.mix.setAttribute("k3", lift.toFixed(4));
      state.mix.setAttribute("k4", (.5-2*LENS_MAP_NEUTRAL*lift).toFixed(6));
      state.lift = lift;
    }
  }
  prune(elements: Set<HTMLElement>) {
    for (const [element, state] of this.filters) if (!elements.has(element)) {
      state.filter.remove(); element.style.removeProperty("--glass-lens"); this.filters.delete(element);
    }
  }
  dispose() { this.prune(new Set()); }
}
