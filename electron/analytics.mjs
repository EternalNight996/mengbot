// Renderer events arrive over IPC; this is the only place that sends them. Nothing leaves before the person
// answers the first-run prompt, and nothing is sent when the settings switch is off.
const MAX_QUEUE = 100;
const MAX_BATCH = 20;
const FLUSH_MS = 5_000;
const EVENT = /^[a-z0-9_]{1,64}$/;
const KEY = /^[a-z0-9_]{1,40}$/;
const MAX_KEYS = 20;
const MAX_STRING = 200;

export function cleanAnalyticsProps(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!KEY.test(key) || Object.keys(out).length >= MAX_KEYS) continue;
    if (typeof raw === "boolean" || (typeof raw === "number" && Number.isFinite(raw))) out[key] = raw;
    else if (typeof raw === "string" && raw.length <= MAX_STRING) out[key] = raw;
  }
  return out;
}

export function createAnalytics({
  prefs,
  appVersion,
  platform,
  url = process.env.OMB_ANALYTICS_URL || "https://analytics.mengbot.com.cn",
  websiteId = process.env.OMB_ANALYTICS_WEBSITE_ID || "6d341dc3-3f21-4296-84d3-00aa0a26999c",
  fetchImpl = fetch,
}) {
  const endpoint = `${String(url).replace(/\/+$/, "")}/api/send`;
  let queue = [];
  let timer = null;
  let sending = false;

  const allowed = () => Boolean(websiteId) && prefs.analyticsConsent() === "granted" && prefs.analytics() !== false;

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; void flush(); }, FLUSH_MS);
    timer.unref?.();
  }

  function track(event, props) {
    if (!allowed() || typeof event !== "string" || !EVENT.test(event)) return false;
    queue.push({ event, data: cleanAnalyticsProps(props) });
    if (queue.length > MAX_QUEUE) queue.shift();
    if (queue.length >= MAX_BATCH) void flush();
    else schedule();
    return true;
  }

  async function post(item) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Umami's bot detector treats any UA containing "bot" as a crawler; "MengBot" would be dropped.
        "user-agent": `MengClient/${appVersion || "0.0.0"} (${platform || "unknown"})`,
      },
      body: JSON.stringify({
        type: "event",
        payload: {
          website: websiteId,
          hostname: "app.mengbot",
          url: "/app",
          name: item.event,
          data: item.data,
          id: prefs.installId(),
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  }

  async function flush() {
    if (sending) return;
    if (!allowed()) { queue = []; return; }
    sending = true;
    const batch = queue.splice(0, MAX_BATCH);
    for (const item of batch) {
      try { await post(item); } catch {}
    }
    sending = false;
    if (queue.length) schedule();
  }

  return {
    track,
    flush,
    stop() { if (timer) clearTimeout(timer); timer = null; queue = []; },
    pending: () => queue.length,
  };
}
