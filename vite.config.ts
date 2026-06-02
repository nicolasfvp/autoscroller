import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'

function debugSavePlugin(): Plugin {
    return {
        name: 'debug-save',
        configureServer(server) {
            server.middlewares.use('/debug-save', (req: any, res: any) => {
                if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
                let body = '';
                req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
                req.on('end', () => {
                    fs.writeFileSync(path.join(process.cwd(), 'debug-layout.json'), body, 'utf8');
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true }));
                });
            });
        },
    };
}

export default defineConfig({
    base: './',
    plugins: [debugSavePlugin()],
    server: {
        host: true
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        }
    }
})
