// Console capture → disk log (dev-only).
//
// Patches every console.* method plus uncaught errors / unhandled promise
// rejections and forwards a serialized copy to the Vite dev-server endpoint
// `/__console`, which appends to `logs/console.log`. The original console
// methods still fire, so DevTools is unaffected.
//
// Wired up from main.ts behind `import.meta.env.DEV`, so Vite tree-shakes the
// whole thing out of production builds. Init is idempotent.

const ENDPOINT = '/__console';
const FLUSH_INTERVAL_MS = 300;
const FLUSH_AT_COUNT = 40;     // flush early once the buffer fills
const MAX_BUFFER = 5000;       // drop oldest beyond this if the server is down

type Level = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
const LEVELS: Level[] = ['log', 'info', 'warn', 'error', 'debug', 'trace'];

interface Entry { t: number; level: string; text: string; }

// Capture pristine references up-front so our own diagnostics never recurse
// through the patched methods.
const original: Record<Level, (...args: unknown[]) => void> = {
  log:   console.log.bind(console),
  info:  console.info.bind(console),
  warn:  console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
  trace: console.trace.bind(console),
};

let installed = false;
let buffer: Entry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;

/**
 * Serialize a single console argument to a string, surviving circular
 * references, Errors, functions, and un-stringifiable objects. Exported so it
 * can be unit-tested in isolation.
 */
export function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';

  const t = typeof arg;
  if (t === 'number' || t === 'boolean' || t === 'bigint') return String(arg);
  if (t === 'symbol') return (arg as symbol).toString();
  if (t === 'function') {
    const name = (arg as Function).name;
    return name ? `[Function: ${name}]` : '[Function (anonymous)]';
  }

  if (arg instanceof Error) {
    return arg.stack ? arg.stack : `${arg.name}: ${arg.message}`;
  }

  // Objects / arrays — circular-safe JSON.
  try {
    const seen = new WeakSet<object>();
    const json = JSON.stringify(
      arg,
      (_key, value) => {
        if (typeof value === 'bigint') return `${value}n`;
        if (typeof value === 'function') {
          return value.name ? `[Function: ${value.name}]` : '[Function]';
        }
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      },
    );
    if (json !== undefined) return json;
  } catch {
    /* fall through to String() */
  }

  try {
    return String(arg);
  } catch {
    return '[Unserializable]';
  }
}

/** Join a console call's arguments into one log line. */
export function formatArgs(args: unknown[]): string {
  return args.map(formatArg).join(' ');
}

function enqueue(level: string, args: unknown[]): void {
  let text: string;
  try {
    text = formatArgs(args);
  } catch {
    text = '[ConsoleLogger: failed to format arguments]';
  }
  buffer.push({ t: Date.now(), level, text });
  if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
  if (buffer.length >= FLUSH_AT_COUNT) void flush();
}

function post(body: string, useBeacon = false): void {
  // Beacon survives page unload; fetch+keepalive for the normal path.
  if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    } catch { /* fall through to fetch */ }
  }
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch((err) => {
    // Never re-enter the patched console; use the pristine reference.
    original.error('[ConsoleLogger] failed to ship logs:', err);
  });
}

async function flush(useBeacon = false): Promise<void> {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  const batch = buffer;
  buffer = [];
  try {
    post(JSON.stringify({ entries: batch }), useBeacon);
  } finally {
    flushing = false;
  }
}

/**
 * Patch console + global error handlers and begin shipping output to disk.
 * Safe to call more than once; only the first call takes effect.
 */
export function initConsoleLogger(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // Truncate the file and stamp a session header on (re)load.
  post(JSON.stringify({
    reset: true,
    text: `===== session start ${new Date().toISOString()} | ${location.href} =====`,
  }));

  for (const level of LEVELS) {
    console[level] = (...args: unknown[]) => {
      original[level](...args);
      enqueue(level, args);
    };
  }

  window.addEventListener('error', (e: ErrorEvent) => {
    const detail = e.error instanceof Error
      ? formatArg(e.error)
      : `${e.message} (${e.filename}:${e.lineno}:${e.colno})`;
    enqueue('error', ['[uncaught]', detail]);
    void flush();
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    enqueue('error', ['[unhandledrejection]', formatArg(e.reason)]);
    void flush();
  });

  // Periodic flush + best-effort flush on the way out.
  flushTimer = setInterval(() => { void flush(); }, FLUSH_INTERVAL_MS);
  window.addEventListener('pagehide', () => { void flush(true); });
  window.addEventListener('beforeunload', () => { void flush(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush(true);
  });
}

/** Restore the original console methods and stop shipping (mostly for tests). */
export function stopConsoleLogger(): void {
  if (!installed) return;
  for (const level of LEVELS) console[level] = original[level];
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  installed = false;
}
