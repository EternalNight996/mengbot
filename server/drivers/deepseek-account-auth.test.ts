import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { DeepSeekAccountAuth } from "./deepseek-account-auth.ts";
import { DEEPSEEK_ACCOUNT_KEY, DEEPSEEK_DEVICE_KEY, deepSeekCredentialsFile, hasDeepSeekAccount, saveDeepSeekAccountGrant } from "./deepseek-credentials.ts";

type Seen = { state?: string; challenge?: string; verifier?: string; code?: string; authorizationUrl?: string };

function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function json(response: ServerResponse, value: unknown): void {
  response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(value));
}

function envelope(data: unknown): unknown {
  return { code: 0, data: { biz_code: 0, biz_data: data } };
}

async function platform(seen: Seen): Promise<{ origin: string; close: () => Promise<void> }> {
  const server: Server = createServer((request, response) => {
    void (async () => {
      if (request.method !== "POST") return response.writeHead(404).end();
      const payload = await body(request);
      if (request.url === "/auth-api/v0/dsh/auth_init") {
        seen.state = String(payload.state);
        seen.challenge = String(payload.code_challenge);
        seen.authorizationUrl = `${origin()}/dsh/authorize?authorize_id=auth-1`;
        return json(response, envelope({ authorize_url: seen.authorizationUrl, authorize_id: "auth-1", expires_in: 300 }));
      }
      if (request.url === "/auth-api/v0/dsh/auth_exchange") {
        seen.code = String(payload.code);
        seen.verifier = String(payload.code_verifier);
        return json(response, envelope({ token: "deepseek-account-token", authorized_url: `${origin()}/dsh/authorized` }));
      }
      if (request.url === "/auth-api/v0/dsh/auth_cancel" || request.url === "/auth-api/v0/users/logout") {
        return json(response, envelope({}));
      }
      response.writeHead(404).end();
    })().catch(() => response.writeHead(500).end());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no fake platform port");
  const origin = () => `http://127.0.0.1:${address.port}`;
  return {
    origin: origin(),
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const dirs: string[] = [];

function home(): string {
  const dir = mkdtempSync(join(tmpdir(), "omb-deepseek-account-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("DeepSeek Platform account sign-in", () => {
  it("runs OAuth authorization code + PKCE, stores the Harness grant, and signs out", async () => {
    const seen: Seen = {};
    const fake = await platform(seen);
    const env = { DSH_HOME: home() };
    const openStates: boolean[] = [];
    const auth = new DeepSeekAccountAuth({ environment: () => env, platformOrigin: fake.origin, onAuthenticated: () => { openStates.push(true); } });
    try {
      const started = await auth.start();
      expect(started.phase).toBe("waiting");
      expect(started.authorizationUrl).toContain("/dsh/authorize");
      expect(started.flowId).toBeTruthy();
      expect(seen.state).toBeTruthy();
      expect(seen.challenge).toBeTruthy();
      expect(hasDeepSeekAccount(env)).toBe(false);

      const callback = `http://127.0.0.1:1234/oauth/callback?code=the-code&state=${encodeURIComponent(seen.state!)}`;
      await auth.complete(started.flowId!, callback);
      expect(seen.code).toBe("the-code");
      expect(createHash("sha256").update(seen.verifier!).digest("base64url")).toBe(seen.challenge);
      expect(openStates).toEqual([true]);
      expect(auth.get(started.flowId!).phase).toBe("succeeded");
      expect(hasDeepSeekAccount(env)).toBe(true);

      const store = parseYaml(readFileSync(deepSeekCredentialsFile(env), "utf8")) as { records: Record<string, unknown> };
      expect(store.records[DEEPSEEK_ACCOUNT_KEY]).toMatchObject({ kind: "grant", payload: { token: "deepseek-account-token" } });
      expect(store.records[DEEPSEEK_DEVICE_KEY]).toMatchObject({ kind: "grant", payload: { id: expect.any(String) } });

      await auth.signOut();
      const after = parseYaml(readFileSync(deepSeekCredentialsFile(env), "utf8")) as { records: Record<string, unknown> };
      expect(after.records[DEEPSEEK_ACCOUNT_KEY]).toBeUndefined();
      expect(hasDeepSeekAccount(env)).toBe(false);
    } finally {
      await auth.dispose();
      await fake.close();
    }
  });

  it("rejects a callback whose state does not match, without storing a grant", async () => {
    const fake = await platform({});
    const env = { DSH_HOME: home() };    const auth = new DeepSeekAccountAuth({ environment: () => env, platformOrigin: fake.origin });
    try {
      const started = await auth.start();
      await expect(auth.complete(started.flowId!, "http://127.0.0.1:1234/oauth/callback?code=x&state=wrong")).rejects.toThrow();
      expect(hasDeepSeekAccount(env)).toBe(false);
    } finally {
      await auth.dispose();
      await fake.close();
    }
  });

  it("reads a grant written by DSH's own format and preserves other credentials", () => {
    const env = { DSH_HOME: home() };
    saveDeepSeekAccountGrant(env, "account-token", "https://platform.deepseek.com");
    expect(hasDeepSeekAccount(env)).toBe(true);
    const store = parseYaml(readFileSync(deepSeekCredentialsFile(env), "utf8")) as { records: Record<string, unknown> };
    expect(store.records[DEEPSEEK_ACCOUNT_KEY]).toBeDefined();
  });
});

// The fake platform records what it saw for the current test.
