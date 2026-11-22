import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { root, runPython } from './scripts/run-python.mjs';

/**
 * While `npm run dev` is running: builds the content first, then again whenever
 * something in content/ or public/images/ changes. Anything that stops the book
 * from building shows up as a readable message over the page.
 */
function contentPlugin(): Plugin {
  return {
    name: 'from-scratch-content',
    apply: 'serve',
    config(_config, env) {
      if (env.isPreview) return;
      const { ok, output } = runPython(['scripts/build_content.py']);
      console.log(output);
      if (!ok && !existsSync(join(root, 'src/generated/recipes.json'))) {
        throw new Error('The content could not be built. See the messages above.');
      }
    },
    configureServer(server) {
      const content = join(root, 'content');
      const images = join(root, 'public/images');
      server.watcher.add(content);
      let timer: NodeJS.Timeout | undefined;
      let wasBroken = false;
      const rebuild = () => {
        const { ok, output } = runPython(['scripts/build_content.py']);
        console.log(output);
        if (!ok) {
          wasBroken = true;
          server.ws.send({
            type: 'error',
            err: { message: output.trim(), stack: '', plugin: 'content' },
          });
        } else if (wasBroken) {
          wasBroken = false;
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(content) && !file.startsWith(images)) return;
        clearTimeout(timer);
        timer = setTimeout(rebuild, 150);
      });
    },
  };
}

/** Puts the words from content/site.yaml into index.html. */
function siteWordsPlugin(): Plugin {
  return {
    name: 'from-scratch-site-words',
    transformIndexHtml(html) {
      const site = JSON.parse(readFileSync(join(root, 'src/generated/site.json'), 'utf8'));
      const esc = (text: string) =>
        text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
      return html
        .replaceAll('__TITLE__', esc(site.title))
        .replaceAll('__DESCRIPTION__', esc(site.description))
        .replaceAll('__URL__', esc(site.url));
    },
  };
}

/*
 * Where the site sits on its domain. GitHub project pages live in a folder named
 * after the repository (/From-Scratch/). With a custom domain (a public/CNAME
 * file) the site is at the root instead.
 */
function siteBase(): string {
  if (existsSync(join(root, 'public/CNAME'))) return '/';
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'From-Scratch';
  return repo.endsWith('.github.io') ? '/' : `/${repo}/`;
}

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? siteBase() : '/',
  build: {
    // Recipes are data, not code, so a big book is fine. They get their own file.
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes('src/generated') ? 'recipes' : id.includes('node_modules') ? 'vendor' : undefined,
      },
    },
  },
  plugins: [react(), contentPlugin(), siteWordsPlugin()],
}));
