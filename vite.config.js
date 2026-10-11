import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Dev-only endpoints used by the in-world editor (src/dev/editor.js):
 *   POST /__editor/layout          body: JSON  -> public/layout.json
 *   POST /__editor/upload?name=x   body: file  -> public/assets/imported/x
 *   POST /__editor/fetch           body: {url} -> downloads a .glb into public/assets/imported/
 * Not part of the production build.
 */
function editorPlugin() {
  const pub = path.resolve('public');
  const importedDir = path.join(pub, 'assets', 'imported');
  const readBody = (req) => new Promise((res, rej) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => res(Buffer.concat(chunks)));
    req.on('error', rej);
  });
  const safeName = (n) => path.basename(String(n)).replace(/[^\w.\-]/g, '_').slice(0, 120);
  const send = (res, code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };

  return {
    name: 'portfolio-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__editor/') || req.method !== 'POST') return next();
        try {
          const url = new URL(req.url, 'http://localhost');
          if (url.pathname === '/__editor/layout') {
            const body = await readBody(req);
            const json = JSON.parse(body.toString('utf8'));
            fs.writeFileSync(path.join(pub, 'layout.json'), JSON.stringify(json, null, 2));
            return send(res, 200, { ok: true });
          }
          if (url.pathname === '/__editor/upload') {
            const name = safeName(url.searchParams.get('name') || 'model.glb');
            if (!/\.(glb|gltf)$/i.test(name)) return send(res, 400, { error: 'only .glb/.gltf' });
            fs.mkdirSync(importedDir, { recursive: true });
            fs.writeFileSync(path.join(importedDir, name), await readBody(req));
            return send(res, 200, { url: `/assets/imported/${name}` });
          }
          if (url.pathname === '/__editor/fetch') {
            const { url: remote } = JSON.parse((await readBody(req)).toString('utf8'));
            const u = new URL(remote);
            if (!/^https?:$/.test(u.protocol) || !/\.glb$/i.test(u.pathname)) return send(res, 400, { error: 'need an http(s) .glb url' });
            const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 portfolio-editor' } });
            if (!r.ok) return send(res, 502, { error: `download failed ${r.status}` });
            const name = safeName(path.basename(u.pathname));
            fs.mkdirSync(importedDir, { recursive: true });
            fs.writeFileSync(path.join(importedDir, name), Buffer.from(await r.arrayBuffer()));
            return send(res, 200, { url: `/assets/imported/${name}` });
          }
          next();
        } catch (e) {
          send(res, 500, { error: String(e.message || e) });
        }
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [editorPlugin()],
  server: { port: 5173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
