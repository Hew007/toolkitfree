// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

/**
 * Keeps the 23.9 MB WebGPU build of the ONNX Runtime WASM binary out of `dist/`.
 *
 * `onnxruntime-web@1.21`'s default browser entry is the JSEP (WebGPU-capable)
 * bundle, and it names its binary in two `new URL("…jsep.wasm", import.meta.url)`
 * fallbacks. Vite sees those, emits the 23.9 MB file, and we deploy it on every
 * release — at 95% of the 24 MiB ceiling in `validate-static-asset-sizes.mjs`.
 *
 * Nothing fetches it. `@imgly/background-removal` always assigns
 * `ort.env.wasm.wasmPaths` before creating a session (see `createOnnxSession` in
 * its `index.mjs`), pointing at blob URLs it built from its own resource bundle —
 * and at the *non*-JSEP binary, because we never pass `device: 'gpu'`. Both
 * fallbacks are dead: one sits behind `!wasm.wasmPaths`, the other behind a
 * missing `locateFile`, which `wasmPaths` supplies.
 *
 * So this rewrites the file name into an expression Vite's asset scanner does not
 * recognize as a static string. The runtime value is unchanged, the emit stops.
 * The honest cost: if some future change does reach one of those fallbacks, it
 * fetches a URL that now 404s instead of a working binary. That is a loud failure
 * rather than a silent one, but it is a failure — a change that passes ORT a
 * different device, or that stops setting `wasmPaths`, has to revisit this.
 */
/** @returns {import('vite').Plugin} */
function dropUnusedOrtWebgpuWasm() {
  const wasmFile = 'ort-wasm-simd-threaded.jsep.wasm';
  // Mirrors Vite's own `new URL(<string literal>, import.meta.url)` matcher; only
  // a literal is rewritten, so a form Vite already ignores is left alone.
  const staticUrlPattern = new RegExp(
    String.raw`\bnew\s+URL\s*\(\s*(['"\`])${wasmFile.replace(/\./g, String.raw`\.`)}\1\s*,`,
    'g'
  );

  return {
    name: 'toolkitfree:drop-unused-ort-webgpu-wasm',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('onnxruntime-web') || !code.includes(wasmFile)) return null;
      const next = code.replace(
        staticUrlPattern,
        `new URL('${wasmFile.slice(0, -5)}'.concat('.wasm'),`
      );
      return next === code ? null : { code: next, map: null };
    },
  };
}

export default defineConfig({
  integrations: [react()],
  output: 'static',
  trailingSlash: 'always',
  vite: {
    plugins: [dropUnusedOrtWebgpuWasm()],
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg'],
    },
    worker: {
      format: 'es',
      // Worker bundles get their own plugin pipeline — `vite.plugins` does not
      // reach them — and the background-removal worker is what pulls ORT in.
      plugins: () => [dropUnusedOrtWebgpuWasm()],
    },
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
