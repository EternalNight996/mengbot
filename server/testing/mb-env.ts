// A shell exporting MB_* / MENGBOT_* leaks them into every child and import-time env snapshot.

const AMBIENT_PREFIXES = ["MB_", "MENGBOT_"] as const;

export function isAmbientMbKey(key: string): boolean {
  return AMBIENT_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function stripMbEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (!isAmbientMbKey(key)) clean[key] = value;
  }
  return clean;
}

export function childEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...stripMbEnv(process.env), ...overrides };
}
