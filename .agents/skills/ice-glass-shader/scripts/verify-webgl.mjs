import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    resolve(process.cwd(), "node_modules/playwright"),
    "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {}
  }

  throw new Error("Playwright non trovato. Installa playwright nel progetto o imposta PLAYWRIGHT_MODULE.");
}

const vertexSource = await readFile(resolve(skillRoot, "assets/ice-glass.vert.glsl"), "utf8");
const fragmentSource = await readFile(resolve(skillRoot, "assets/ice-glass.frag.glsl"), "utf8");
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
  await page.setContent('<canvas id="gl" width="256" height="256"></canvas>');
  const result = await page.evaluate(({ vertexSource, fragmentSource }) => {
    const canvas = document.querySelector("#gl");
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL 2.0 non disponibile");

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(log || "Errore di compilazione shader");
      }
      return shader;
    };

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Errore di link del programma");
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.useProgram(program);
    gl.uniform2f(gl.getUniformLocation(program, "uResolution"), canvas.width, canvas.height);
    gl.uniform2f(gl.getUniformLocation(program, "uPointer"), 156, 128);
    gl.uniform1f(gl.getUniformLocation(program, "uTime"), 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const pixel = new Uint8Array(4);
    gl.readPixels(128, 128, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const error = gl.getError();

    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    return { webgl: gl.getParameter(gl.VERSION), renderer, centerPixel: [...pixel], error };
  }, { vertexSource, fragmentSource });

  if (result.error !== 0 || result.centerPixel[3] !== 255) {
    throw new Error(`Render di prova non valido: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} finally {
  await browser.close();
}
