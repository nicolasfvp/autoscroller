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

// Captures browser console output (forwarded by src/debug/ConsoleLogger.ts)
// and appends it to logs/console.log so it can be inspected outside DevTools.
function consoleLogPlugin(): Plugin {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'console.log');

    const fmt = (t: number, level: string, text: string) => {
        const ts = Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
        return `[${ts}] [${String(level).toUpperCase().padEnd(5)}] ${text}\n`;
    };

    return {
        name: 'console-log',
        configureServer(server) {
            server.middlewares.use('/__console', (req: any, res: any) => {
                if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
                let body = '';
                req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
                req.on('end', () => {
                    try {
                        const payload = JSON.parse(body || '{}');
                        fs.mkdirSync(logDir, { recursive: true });

                        if (payload.reset) {
                            const header = payload.text ? `${payload.text}\n` : '';
                            fs.writeFileSync(logFile, header, 'utf8');
                        }

                        const entries: Array<{ t: number; level: string; text: string }> =
                            Array.isArray(payload.entries) ? payload.entries : [];
                        if (entries.length) {
                            const chunk = entries.map(e => fmt(e.t, e.level, e.text ?? '')).join('');
                            fs.appendFileSync(logFile, chunk, 'utf8');
                        }
                    } catch (err) {
                        server.config.logger.warn(`[console-log] failed to write: ${err}`);
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true }));
                });
            });
        },
    };
}

export default defineConfig({
    base: './autoscroller/',
    plugins: [debugSavePlugin(), consoleLogPlugin()],
    server: {
        host: true,
        allowedHosts: ["feira-de-jogos.dev.br"]
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
