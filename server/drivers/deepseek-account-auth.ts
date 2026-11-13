import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import { release as osRelease } from "node:os";
import type { ProviderAuthenticationStart, ProviderAuthenticationStatus } from "../contracts.ts";
import {
  clearDeepSeekAccountGrant,
  deepSeekAccountToken,
  deepSeekDeviceId,
  saveDeepSeekAccountGrant,
} from "./deepseek-credentials.ts";

const DEFAULT_PLATFORM_ORIGIN = "https://platform.deepseek.com";
const AUTHORIZE_PATH = "/dsh/authorize";
const CALLBACK_PATH = "/oauth/callback";
const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_LIFETIME_MS = 15 * 60_000;

type Phase = "waiting" | "succeeded" | "failed" | "expired" | "cancelled";

interface Flow {
  id: string;
  verifier: string;
  state: string;
  redirectUri: string;
  authorizeId: string | null;
  authorizeUrl: string;
  expiresAt: number;
  phase: Phase;
  message?: string;
  server: Server | null;
  timer: NodeJS.Timeout | null;
  processing: Promise<void> | null;
}

export interface DeepSeekAccountAuthOptions {
  environment: () => Record<string, string | undefined>;
  onAuthenticated?: () => void | Promise<void>;
  /** Tests use a local origin; the app always talks to the real Platform. */
  platformOrigin?: string;
}

interface Envelope {
  code: number;
  data?: { biz_code?: number; biz_data?: unknown };
}

function envelopeData(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("DeepSeek sign-in got an invalid Platform response.");
  const envelope = value as Envelope;
  if (envelope.code !== 0 || !envelope.data || envelope.data.biz_code !== 0) throw new Error("DeepSeek sign-in was refused by Platform.");
  return envelope.data.biz_data;
}

function stringField(value: unknown, name: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("DeepSeek sign-in got an invalid Platform response.");
  const field = (value as Record<string, unknown>)[name];
  if (typeof field !== "string" || field.length === 0) throw new Error("DeepSeek sign-in got an invalid Platform response.");
  return field;
}

function numberField(value: unknown, name: string): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("DeepSeek sign-in got an invalid Platform response.");
  const field = (value as Record<string, unknown>)[name];
  if (typeof field !== "number" || !Number.isFinite(field) || field <= 0) throw new Error("DeepSeek sign-in got an invalid Platform response.");
  return field;
}

function sameSecret(left: string, right: string): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signInPage(title: string, detail: string, close = false): string {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title>` +
    `<body style="font:14px/1.6 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#111;color:#eee">` +
    `<main style="max-width:28rem;padding:2rem;text-align:center"><h1 style="font-size:18px;margin:0 0 .75rem">${title}</h1><p style="margin:0;color:#aaa">${detail}</p>` +
    `${close ? '<script>setTimeout(() => window.close(), 1200)</script>' : ""}</main></body></html>`;
}

/** DeepSeek Platform account sign-in for the Harness engine: OAuth 2.0 authorization code + PKCE (S256). */
export class DeepSeekAccountAuth {
  private readonly origin: string;
  private readonly options: DeepSeekAccountAuthOptions;
  private flow: Flow | null = null;
  private disposed = false;

  constructor(options: DeepSeekAccountAuthOptions) {
    this.options = options;
    const configured = options.platformOrigin ?? process.env.OMB_DEEPSEEK_PLATFORM_ORIGIN ?? DEFAULT_PLATFORM_ORIGIN;
    const url = new URL(configured);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("DeepSeek Platform origin is invalid.");
    if (url.protocol !== "https:" && !(options.platformOrigin !== undefined && url.protocol === "http:")) {
      throw new Error("DeepSeek Platform origin must use HTTPS.");
    }
    this.origin = url.origin;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-client-bundle-id": "",
      "x-client-platform": process.platform === "win32" ? "desktop-win" : process.platform === "darwin" ? "desktop-mac" : "web",
      "x-client-version": process.env.OMB_VERSION ?? "0.1.140",
      "x-client-locale": "zh_CN",
      "x-client-timezone-offset": String(-new Date().getTimezoneOffset() * 60),
      ...extra,
    };
  }

  private async platform(method: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const response = await fetch(`${this.origin}/auth-api/v0/dsh/${method}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        redirect: "error",
        signal: combined,
      });
      if (!response.ok) throw new Error("DeepSeek Platform could not be reached. Check the network and try again.");
      return envelopeData(await response.json());
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("DeepSeek ")) throw error;
      throw new Error("DeepSeek Platform could not be reached. Check the network and try again.");
    } finally {
      clearTimeout(timer);
    }
  }

  private status(flow: Flow): ProviderAuthenticationStatus {
    return {
      phase: flow.phase,
      flowId: flow.phase === "waiting" ? flow.id : null,
      authorizationUrl: null,
      expiresAt: new Date(flow.expiresAt).toISOString(),
      ...(flow.message ? { message: flow.message } : {}),
    };
  }

  private close(flow: Flow): void {
    if (flow.timer) {
      clearTimeout(flow.timer);
      flow.timer = null;
    }
    if (flow.server) {
      flow.server.close();
      flow.server = null;
    }
  }

  private expire(flow: Flow): void {
    if (flow.phase !== "waiting") return;
    flow.phase = "expired";
    flow.message = "DeepSeek 登录已超时，请重新发起登录。";
    this.close(flow);
  }

  private async exchange(flow: Flow, code: string): Promise<void> {
    if (flow.phase !== "waiting") return;
    const env = this.options.environment();
    const device = deepSeekDeviceId(env, () => randomUUID());
    const data = await this.platform("auth_exchange", {
      code,
      code_verifier: flow.verifier,
      redirect_uri: flow.redirectUri,
      device_id: device,
      device_model: `${process.platform}-${process.arch}`,
      os_version: osRelease(),
    });
    const token = stringField(data, "token");
    saveDeepSeekAccountGrant(env, token, this.origin);
    flow.phase = "succeeded";
    flow.message = undefined;
    this.close(flow);
    try {
      await this.options.onAuthenticated?.();
    } catch {
      // Signing in succeeded; a catalog refresh failure must not undo the stored grant.
    }
  }

  async start(): Promise<ProviderAuthenticationStart> {
    if (this.disposed) throw new Error("This DeepSeek provider is shutting down. Try again.");
    const current = this.flow;
    if (current?.phase === "waiting" && Date.now() < current.expiresAt) {
      return {
        phase: "waiting",
        flowId: current.id,
        authorizationUrl: current.authorizeUrl,
        expiresAt: new Date(current.expiresAt).toISOString(),
      };
    }
    const verifier = randomBytes(32).toString("base64url");
    const state = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("DeepSeek sign-in could not open a local callback port.");
    }
    const redirectUri = `http://127.0.0.1:${address.port}${CALLBACK_PATH}`;
    const flow: Flow = {
      id: randomUUID(),
      verifier,
      state,
      redirectUri,
      authorizeId: null,
      authorizeUrl: "",
      expiresAt: Date.now() + DEFAULT_LIFETIME_MS,
      phase: "waiting",
      server,
      timer: null,
      processing: null,
    };
    const data = await this.platform("auth_init", {
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      redirect_uri: redirectUri,
      locale: "zh_CN",
      login_source: "desktop",
    }).catch((error: unknown) => {
      server.close();
      throw error;
    });
    const authorizeUrl = this.validateAuthorizeUrl(stringField(data, "authorize_url"));
    flow.authorizeUrl = authorizeUrl;
    flow.authorizeId = stringField(data, "authorize_id");
    flow.expiresAt = Math.min(flow.expiresAt, Date.now() + numberField(data, "expires_in") * 1000);
    flow.timer = setTimeout(() => this.expire(flow), Math.max(0, flow.expiresAt - Date.now()));
    flow.timer.unref?.();
    server.on("request", (request, response) => {
      try {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const code = url.searchParams.get("code");
        const stateParam = url.searchParams.get("state") ?? "";
        if (request.method !== "GET" || url.pathname !== CALLBACK_PATH) {
          response.writeHead(404, { "cache-control": "no-store" }).end();
          return;
        }
        if (!code || !sameSecret(stateParam, flow.state) || url.searchParams.getAll("code").length !== 1) {
          response.writeHead(400, { "cache-control": "no-store" }).end(signInPage("登录失败", "回调参数不完整或已过期，请回到 MengBot 重新发起登录。"));
          return;
        }
        if (flow.phase !== "waiting") {
          response.writeHead(410, { "cache-control": "no-store" }).end(signInPage("登录已结束", "这次登录已经处理过，请回到 MengBot 查看状态。"));
          return;
        }
        flow.processing = this.exchange(flow, code)
          .then(() => {
            if (!response.headersSent) response.writeHead(200, { "cache-control": "no-store", "content-type": "text/html; charset=utf-8" })
              .end(signInPage("DeepSeek 登录成功", "可以关闭此页面，回到 MengBot 继续。", true));
          })
          .catch((error: unknown) => {
            flow.phase = "failed";
            flow.message = error instanceof Error ? error.message : "DeepSeek 登录失败，请重新发起。";
            this.close(flow);
            if (!response.headersSent) response.writeHead(200, { "cache-control": "no-store", "content-type": "text/html; charset=utf-8" })
              .end(signInPage("登录失败", "请回到 MengBot 重新发起登录。"));
          })
          .finally(() => {
            flow.processing = null;
          });
      } catch {
        response.writeHead(400, { "cache-control": "no-store" }).end();
      }
    });
    this.flow = flow;
    return {
      phase: "waiting",
      flowId: flow.id,
      authorizationUrl: authorizeUrl,
      expiresAt: new Date(flow.expiresAt).toISOString(),
    };
  }

  private validateAuthorizeUrl(value: string): string {
    const url = new URL(value);
    const allowed = url.origin === this.origin && url.pathname === AUTHORIZE_PATH && !url.username && !url.password && !url.hash;
    if (!allowed) throw new Error("DeepSeek Platform returned an unexpected authorization URL.");
    return url.href;
  }

  get(flowId: string): ProviderAuthenticationStatus {
    const flow = this.flow;
    if (!flow || flow.id !== flowId) {
      return { phase: "failed", flowId: null, authorizationUrl: null, expiresAt: null, message: "这次登录已结束，请重新发起。" };
    }
    if (flow.phase === "waiting" && Date.now() >= flow.expiresAt) this.expire(flow);
    return this.status(flow);
  }

  async complete(flowId: string, callbackUrl: string): Promise<void> {
    const flow = this.flow;
    if (!flow || flow.id !== flowId) throw new Error("这次登录已结束，请重新发起。");
    if (flow.phase === "succeeded") return;
    if (flow.processing) {
      await flow.processing;
      return;
    }
    if (flow.phase !== "waiting") throw new Error(flow.message ?? "这次登录已结束，请重新发起。");
    let code: string | null = null;
    let state: string | null = null;
    try {
      const url = new URL(callbackUrl.trim());
      code = url.searchParams.get("code");
      state = url.searchParams.get("state");
    } catch {
      throw new Error("请粘贴浏览器地址栏中的完整回调地址。");
    }
    if (!code || !state || !sameSecret(state, flow.state)) throw new Error("回调地址无效或与这次登录不匹配。");
    await this.exchange(flow, code);
  }

  async cancel(): Promise<void> {
    const flow = this.flow;
    if (!flow || flow.phase !== "waiting") return;
    flow.phase = "cancelled";
    flow.message = "登录已取消。";
    this.close(flow);
    if (this.disposed) return;
    if (flow.authorizeId) {
      void this.platform("auth_cancel", { authorize_id: flow.authorizeId, code_verifier: flow.verifier }).catch(() => undefined);
    }
  }

  async signOut(): Promise<void> {
    const env = this.options.environment();
    const token = deepSeekAccountToken(env);
    clearDeepSeekAccountGrant(env);
    if (token) {
      void fetch(`${this.origin}/auth-api/v0/users/logout`, {
        method: "POST",
        headers: this.headers({ "x-dsh-auth-token": token }),
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);
    }
    try {
      await this.options.onAuthenticated?.();
    } catch {
      // The local grant is gone; a catalog refresh failure does not restore it.
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.cancel();
    this.flow = null;
  }
}
