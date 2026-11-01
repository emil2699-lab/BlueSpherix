import { photonFragment, photonVertex } from "./ice-glass-photon-shader";
import { packScene, type GlassVolume } from "./ice-glass-volume";
import { PHOTON_TILE, type TransportOptions } from "./ice-glass-transport";

// One small surface-irradiance atlas in the existing WebGL context. Geometry
// uploads only when measurements change; pointer updates never trace on the CPU.
export function createPhotonTransport(gl:WebGL2RenderingContext) {
  if(!gl.getExtension("EXT_color_buffer_float"))return null;
  const program=gl.createProgram()!,shaders:WebGLShader[]=[],buffers:WebGLBuffer[]=[],vaos:WebGLVertexArrayObject[]=[];
  const texture=gl.createTexture()!,scene=gl.createTexture()!,framebuffer=gl.createFramebuffer()!,feedback=gl.createTransformFeedback()!;
  const uniforms=new Map<string,WebGLUniformLocation|null>();
  const uniform=(name:string)=> { if(!uniforms.has(name))uniforms.set(name,gl.getUniformLocation(program,name));return uniforms.get(name)!; };
  const width=PHOTON_TILE.width*PHOTON_TILE.columns;
  let count=0,height:number=PHOTON_TILE.height,cardCount=0;
  let rects=new Float32Array(64*4),shapes=new Float32Array(64*2),triangleOffset=0;
  const dispose=()=>{
    shaders.forEach(s=>gl.deleteShader(s));buffers.forEach(b=>gl.deleteBuffer(b));vaos.forEach(v=>gl.deleteVertexArray(v));
    gl.deleteProgram(program);gl.deleteTexture(texture);gl.deleteTexture(scene);gl.deleteFramebuffer(framebuffer);gl.deleteTransformFeedback(feedback);
  };
  try {
    for(const [type,source] of [[gl.VERTEX_SHADER,photonVertex],[gl.FRAGMENT_SHADER,photonFragment]] as const) {
      const shader=gl.createShader(type)!;shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader) || "Photon shader compilation");gl.attachShader(program,shader);
    }
    gl.transformFeedbackVaryings(program,["nextOriginEnergy","nextDirectionMedium","nextMeta"],gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program) || "Photon shader link");
    for(let i=0;i<3;i++) {
      const buffer=gl.createBuffer()!,vao=gl.createVertexArray()!;buffers.push(buffer);vaos.push(vao);
      gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(let a=0;a<3;a++) { gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,4,gl.FLOAT,false,48,a*16); }
    }
    for(const tex of [texture,scene]) {
      gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
  } catch(error) { dispose();throw error; }
  return {
    texture,
    update(volumes:GlassVolume[]) {
      // Active dashboard views are below 20 cards. Bound uniforms explicitly.
      if(volumes.length>64)throw new Error("Ice Glass: too many transport volumes");
      cardCount=volumes.length;height=Math.max(PHOTON_TILE.height,Math.ceil(cardCount/PHOTON_TILE.columns)*PHOTON_TILE.height);
      rects=new Float32Array(64*4);shapes=new Float32Array(64*2);
      const seeds:number[]=[];
      volumes.forEach((v,card)=>{
        const r=v.surface.rect;rects.set([r.left,r.top,r.width,r.height],card*4);shapes.set([v.radius,v.thickness],card*2);
        for(const t of v.triangles)for(let channel=0;channel<3;channel++)seeds.push(...t.center,t.area,...t.normal,card+1,channel,0,0,0);
      });
      count=seeds.length/12;
      for(let i=0;i<3;i++) {
        gl.bindBuffer(gl.ARRAY_BUFFER,buffers[i]);
        if(i===0)gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(seeds),gl.DYNAMIC_COPY);
        else gl.bufferData(gl.ARRAY_BUFFER,count*48,gl.DYNAMIC_COPY);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER,null);
      const packed=packScene(volumes);triangleOffset=packed.triangleOffset;
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,scene);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,packed.width,packed.height,0,gl.RGBA,gl.FLOAT,packed.data);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,width,height,0,gl.RGBA,gl.HALF_FLOAT,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
      const complete=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(!complete)throw new Error("Ice Glass: photon framebuffer incomplete");
    },
    render(pointer:{x:number;y:number},present:boolean,options:TransportOptions,observe?:(step:number,buffer:number)=>void) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,width,height);gl.disable(gl.SCISSOR_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      if(present && cardCount && count) {
        gl.useProgram(program);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,scene);gl.uniform1i(uniform("uScene"),1);
        gl.uniform1i(uniform("uTriangleOffset"),triangleOffset);gl.uniform4fv(uniform("uCards"),rects);gl.uniform2fv(uniform("uShape"),shapes);
        gl.uniform3f(uniform("uSource"),pointer.x,pointer.y,options.lightHeight);
        gl.uniform4f(uniform("uTransport"),options.ior,options.dispersion,options.roughness,options.intensity*options.lightHeight**2);
        gl.uniform2i(uniform("uAtlasSize"),width,height);gl.uniform1i(uniform("uMaxCards"),options.maxBounces+1);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);
        const pass=(input:number,output:number)=>{
          gl.bindVertexArray(vaos[input]);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,buffers[output]);
          gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,count);gl.endTransformFeedback();gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);
        };
        gl.uniform1i(uniform("uInitialize"),1);gl.enable(gl.RASTERIZER_DISCARD);pass(0,1);gl.disable(gl.RASTERIZER_DISCARD);
        observe?.(-1,1);
        gl.uniform1i(uniform("uInitialize"),0);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
        for(let step=0;step<6;step++) { const output=(step+1)%2+1;pass(step%2+1,output);observe?.(step,output); }
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    },
    // Readback is used only by external verification, never by the render loop.
    inspect(buffer=1) {
      const states=new Float32Array(count*12);gl.bindBuffer(gl.COPY_READ_BUFFER,buffers[buffer]);gl.getBufferSubData(gl.COPY_READ_BUFFER,0,states);gl.bindBuffer(gl.COPY_READ_BUFFER,null);
      return {states,width,height,count,framebuffer};
    },
    dispose,
  };
}
