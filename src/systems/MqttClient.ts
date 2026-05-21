// MqttClient — singleton wrapper around mqtt.connect for the Daily Run ticker.
// All public methods are best-effort: connection failure must NOT crash the game.
//
// Two-tier broker: try HiveMQ first, fall back to test.mosquitto.org if the
// initial connect can't complete within FALLBACK_TIMEOUT_MS. Both are public,
// anonymous WSS brokers required by the school-project MQTT criterion.

import mqtt, { MqttClient as RawClient, IClientPublishOptions } from 'mqtt';

const PRIMARY_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const FALLBACK_BROKER = 'wss://test.mosquitto.org:8081/mqtt';
const FALLBACK_TIMEOUT_MS = 5_000;

export type MqttStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

type MessageHandler = (topic: string, payload: unknown) => void;

class MqttClientSingleton {
  private client: RawClient | null = null;
  private status: MqttStatus = 'idle';
  // topic-filter -> set of handlers. Keep handlers per-filter so multiple
  // subscribers (broadcaster + ticker) can share the same wildcard topic.
  private handlers = new Map<string, Set<MessageHandler>>();
  private statusListeners = new Set<(s: MqttStatus) => void>();
  private fallbackAttempted = false;
  private connectPromise: Promise<void> | null = null;

  getStatus(): MqttStatus {
    return this.status;
  }

  onStatusChange(fn: (s: MqttStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  private setStatus(s: MqttStatus): void {
    if (s === this.status) return;
    this.status = s;
    this.statusListeners.forEach((fn) => {
      try { fn(s); } catch (err) { console.warn('[MqttClient] status listener error:', err); }
    });
  }

  /**
   * Ensure a client is connected. Returns the same in-flight Promise on
   * concurrent calls so multiple callers don't open multiple connections.
   * Always resolves (never rejects) — failure is reflected in status only.
   */
  async ensureConnected(): Promise<void> {
    if (this.client && this.client.connected) return;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.connectWithFallback();
    try { await this.connectPromise; } finally { this.connectPromise = null; }
  }

  private connectWithFallback(): Promise<void> {
    return new Promise((resolve) => {
      this.setStatus('connecting');
      const url = this.fallbackAttempted ? FALLBACK_BROKER : PRIMARY_BROKER;
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const settle = () => { if (!settled) { settled = true; if (timeoutId) clearTimeout(timeoutId); resolve(); } };

      let client: RawClient;
      try {
        client = mqtt.connect(url, {
          clientId: `autoscroller-${Math.random().toString(36).slice(2, 10)}`,
          keepalive: 30,
          reconnectPeriod: 3_000,
          connectTimeout: FALLBACK_TIMEOUT_MS,
          clean: true,
        });
      } catch (err) {
        console.warn('[MqttClient] connect threw synchronously:', err);
        this.setStatus('failed');
        settle();
        return;
      }
      this.client = client;

      client.on('connect', () => {
        this.setStatus('connected');
        // Re-subscribe all previously registered topics. Handlers stay alive
        // across reconnects so the ticker keeps populating after a drop.
        for (const topic of this.handlers.keys()) {
          client.subscribe(topic, { qos: 0 }, (err) => {
            if (err) console.warn('[MqttClient] re-subscribe failed', topic, err);
          });
        }
        settle();
      });

      client.on('reconnect', () => this.setStatus('reconnecting'));
      client.on('offline', () => this.setStatus('reconnecting'));
      client.on('close', () => {
        if (this.status === 'connected') this.setStatus('reconnecting');
      });
      client.on('error', (err) => {
        console.warn('[MqttClient] error on', url, err?.message ?? err);
        // Try the fallback broker once if the primary never managed to connect.
        if (!settled && !this.fallbackAttempted) {
          this.fallbackAttempted = true;
          try { client.end(true); } catch { /* ignore */ }
          this.client = null;
          this.setStatus('connecting');
          this.connectWithFallback().then(resolve);
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          return;
        }
        if (!settled) {
          this.setStatus('failed');
          settle();
        }
      });

      client.on('message', (topic, payload) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload.toString('utf-8'));
        } catch {
          // Non-JSON payloads from other clients are silently dropped — we
          // never publish anything but DailyRunUpdate JSON, so anything else
          // is noise on the public broker.
          return;
        }
        for (const [filter, handlerSet] of this.handlers) {
          if (matchesFilter(filter, topic)) {
            for (const h of handlerSet) {
              try { h(topic, parsed); } catch (err) { console.warn('[MqttClient] handler error:', err); }
            }
          }
        }
      });

      // Hard fallback timer in case 'connect' never fires and 'error' is also
      // silent (some browsers stall WSS handshakes without ever erroring).
      timeoutId = setTimeout(() => {
        if (settled) return;
        if (!this.fallbackAttempted) {
          this.fallbackAttempted = true;
          try { client.end(true); } catch { /* ignore */ }
          this.client = null;
          this.setStatus('connecting');
          this.connectWithFallback().then(resolve);
          settled = true;
          return;
        }
        this.setStatus('failed');
        settle();
      }, FALLBACK_TIMEOUT_MS);
    });
  }

  /**
   * Publish JSON payload to topic at QoS 0. Best-effort: returns silently
   * if not connected. Will trigger a connect attempt if status is idle.
   */
  publish(topic: string, payload: unknown, options: IClientPublishOptions = { qos: 0, retain: false }): void {
    void this.ensureConnected().then(() => {
      const c = this.client;
      if (!c || !c.connected) return;
      try {
        c.publish(topic, JSON.stringify(payload), options, (err) => {
          if (err) console.warn('[MqttClient] publish failed', topic, err.message);
        });
      } catch (err) {
        console.warn('[MqttClient] publish threw', err);
      }
    });
  }

  subscribe(topic: string, handler: MessageHandler): void {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    set.add(handler);
    void this.ensureConnected().then(() => {
      const c = this.client;
      if (!c || !c.connected) return;
      c.subscribe(topic, { qos: 0 }, (err) => {
        if (err) console.warn('[MqttClient] subscribe failed', topic, err.message);
      });
    });
  }

  unsubscribe(topic: string, handler: MessageHandler): void {
    const set = this.handlers.get(topic);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.handlers.delete(topic);
      const c = this.client;
      if (c && c.connected) {
        try {
          c.unsubscribe(topic, undefined, (err) => {
            if (err) console.warn('[MqttClient] unsubscribe failed', topic, err.message);
          });
        } catch (err) {
          console.warn('[MqttClient] unsubscribe threw', err);
        }
      }
    }
  }

  /**
   * Close the connection and forget handlers. Mostly useful for tests; in
   * normal app use the client survives until tab close so the ticker stays
   * subscribed across scene transitions.
   */
  disconnect(): void {
    const c = this.client;
    this.client = null;
    this.handlers.clear();
    this.fallbackAttempted = false;
    this.setStatus('idle');
    if (c) {
      try { c.end(true); } catch { /* ignore */ }
    }
  }
}

/**
 * MQTT topic filter matcher with `+` (single level) and `#` (multi level)
 * wildcards. We only use `+` for the Daily Run ticker, but supporting `#`
 * keeps this module reusable if other features want a broader subscription.
 */
export function matchesFilter(filter: string, topic: string): boolean {
  if (filter === topic) return true;
  const f = filter.split('/');
  const t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    const seg = f[i];
    if (seg === '#') return true;
    if (seg === '+') {
      if (t[i] === undefined) return false;
      continue;
    }
    if (seg !== t[i]) return false;
  }
  return f.length === t.length;
}

export const mqttClient = new MqttClientSingleton();
