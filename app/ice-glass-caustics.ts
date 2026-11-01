import { causticFragment, causticVertex, causticTraceVertex, causticTraceFragment } from "./ice-glass-volume-shader";
import { ICE_GLASS as config, TODAY_GLASS } from "./ice-glass-config";

type Surface = { rect: { left: number; top: number; width: number; height: number; right: number; bottom: number }; radius: number; tint: number[] };

// Samples are dense across the curved shoulder and coarse on the planar face.
// Each sample carries its represented area, independent of this tessellation.
function samples(width: number, height: number) {
  const axis = (size: number) => {
    const edge = [0,.2,.6,1.2,2,3,4.5,6.5,9,12,16,21,28,36];
    const values = new Set([0,size]);
    for (const x of edge) if (x < size*.5) { values.add(x); values.add(size-x); }
    for (let x=48;x<size-36;x+=18) values.add(x);
    return [...values].sort((a,b)=>a-b);
  };
  const xs=axis(width),ys=axis(height),data: number[]=[],indices:number[]=[];
  for(const y of ys)for(const x of xs)data.push(x/width,y/height,1);
  for(let y=1;y<ys.length;y++) for(let x=1;x<xs.length;x++) {
    const a=(y-1)*xs.length+x-1,b=a+1,c=y*xs.length+x-1,d=c+1;
    indices.push(a,b,c,c,b,d);
  }
  return {vertices:new Float32Array(data),indices:new Uint32Array(indices)};
}

export function createCaustics(gl: WebGL2RenderingContext) {
  const inputVao=gl.createVertexArray(),outputVao=gl.createVertexArray();
  const input=gl.createBuffer(),output=gl.createBuffer(),indices=gl.createBuffer();
  const texture=gl.createTexture(),framebuffer=gl.createFramebuffer(),feedback=gl.createTransformFeedback();
  const shaders:WebGLShader[]=[],programs:WebGLProgram[]=[];
  const geometry=new Map<string,ReturnType<typeof samples>>();
  const locations=new Map<WebGLProgram,Map<string,WebGLUniformLocation|null>>();
  let traceProgram:WebGLProgram,program:WebGLProgram,width=0,height=0;
  const floating=Boolean(gl.getExtension("EXT_color_buffer_float") && gl.getExtension("EXT_float_blend"));
  const scale=floating?1:.08;
  const uniform=(target:WebGLProgram,name:string)=>{
    if(!locations.has(target))locations.set(target,new Map());
    const cache=locations.get(target)!;
    if(!cache.has(name))cache.set(name,gl.getUniformLocation(target,name));
    return cache.get(name)!;
  };
  const dispose=()=>{
    shaders.forEach(s=>gl.deleteShader(s));programs.forEach(p=>gl.deleteProgram(p));
    gl.deleteVertexArray(inputVao);gl.deleteVertexArray(outputVao);
    gl.deleteBuffer(input);gl.deleteBuffer(output);gl.deleteBuffer(indices);
    gl.deleteTexture(texture);gl.deleteFramebuffer(framebuffer);gl.deleteTransformFeedback(feedback);
    geometry.clear();
  };
  const compile=(vertex:string,fragment:string,varyings?:string[])=>{
    const target=gl.createProgram();if(!target)throw new Error("Caustic program unavailable");
    programs.push(target);
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const) {
      const shader=gl.createShader(type);if(!shader)throw new Error("Caustic shader unavailable");
      shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||"Caustic compilation");
      gl.attachShader(target,shader);
    }
    if(varyings)gl.transformFeedbackVaryings(target,varyings,gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(target);
    if(!gl.getProgramParameter(target,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(target)||"Caustic link");
    return target;
  };
  try {
    if(!inputVao || !outputVao || !input || !output || !indices || !texture || !framebuffer || !feedback)throw new Error("Caustic allocation failed");
    traceProgram=compile(causticTraceVertex,causticTraceFragment,["outMap0","outMap1","outMap2","outSource"]);
    program=compile(causticVertex,causticFragment);
    gl.bindVertexArray(inputVao);gl.bindBuffer(gl.ARRAY_BUFFER,input);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.bindVertexArray(outputVao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);
    for(let i=0;i<4;i++)gl.enableVertexAttribArray(i);
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  } catch(error) {dispose();throw error;}
  return {
    texture,decode:1/scale,
    render(surfaces:Surface[],pointer:{x:number;y:number;presence:number},viewWidth:number,viewHeight:number,dpr:number) {
      const mapDPR=dpr*.65,nextWidth=Math.max(1,Math.round(viewWidth*mapDPR)),nextHeight=Math.max(1,Math.round(viewHeight*mapDPR));
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
      if(width!==nextWidth || height!==nextHeight) {
        width=nextWidth;height=nextHeight;gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texImage2D(gl.TEXTURE_2D,0,floating?gl.RGBA16F:gl.RGBA8,width,height,0,gl.RGBA,floating?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error("Caustic framebuffer incomplete");
      }
      gl.viewport(0,0,width,height);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      if(pointer.presence) {
        gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
        gl.useProgram(program);
        gl.uniform2f(uniform(program,"uResolution"),width,height);gl.uniform1f(uniform(program,"uDPR"),mapDPR);
        gl.useProgram(traceProgram);
        gl.uniform1f(uniform(traceProgram,"uFluxScale"),scale);
        gl.uniform3f(uniform(traceProgram,"uLight"),pointer.x,pointer.y,pointer.presence);
        gl.uniform4f(uniform(traceProgram,"uGlass"),config.glassIOR,TODAY_GLASS.thickness,config.glassRoughness,config.glassOpacity);
        gl.uniform4f(uniform(traceProgram,"uOptics"),config.fresnelStrength,config.chromaticDispersion,config.edgeRefraction,config.internalReflection);
        gl.uniform4f(uniform(traceProgram,"uEnergy"),config.ambientReflection,TODAY_GLASS.lightIntensity,config.lightHeight,config.lightFalloff);
        for(const {rect,radius,tint} of surfaces) {
          if(rect.width<=0 || rect.height<=0 || rect.bottom< -80 || rect.top>viewHeight+80 || rect.right< -80 || rect.left>viewWidth+80)continue;
          const key=rect.width.toFixed(2)+":"+rect.height.toFixed(2);
          if(!geometry.has(key)){if(geometry.size>64)geometry.clear();geometry.set(key,samples(rect.width,rect.height));}
          const data=geometry.get(key)!,count=data.vertices.length/3;
          gl.useProgram(traceProgram);gl.bindVertexArray(inputVao);gl.bindBuffer(gl.ARRAY_BUFFER,input);
          gl.bufferData(gl.ARRAY_BUFFER,data.vertices,gl.DYNAMIC_DRAW);
          gl.uniform4f(uniform(traceProgram,"uRect"),rect.left,rect.top,rect.width,rect.height);
          gl.uniform1f(uniform(traceProgram,"uRadius"),radius);gl.uniform3f(uniform(traceProgram,"uTint"),tint[0],tint[1],tint[2]);
          // Trace each wavelength once; retain all exits on the GPU for reuse.
          gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);
          gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);
          gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,count*3*44,gl.DYNAMIC_COPY);
          gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
          gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);
          gl.drawArraysInstanced(gl.POINTS,0,count,3);
          gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
          gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);
          gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,null);
          gl.useProgram(program);gl.bindVertexArray(outputVao);gl.bindBuffer(gl.ARRAY_BUFFER,output);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.DYNAMIC_DRAW);
          gl.uniform4f(uniform(program,"uRect"),rect.left,rect.top,rect.width,rect.height);gl.uniform1f(uniform(program,"uRadius"),radius);
          for(let channel=0;channel<3;channel++) {
            const offset=channel*count*44;
            for(let i=0;i<4;i++)gl.vertexAttribPointer(i,i===3?2:3,gl.FLOAT,false,44,offset+i*12);
            gl.uniform1i(uniform(program,"uChannel"),channel);
            gl.drawElementsInstanced(gl.TRIANGLES,data.indices.length,gl.UNSIGNED_INT,0,3);
          }
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    },dispose,
  };
}
