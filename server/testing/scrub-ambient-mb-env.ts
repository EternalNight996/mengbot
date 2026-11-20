// Side-effect import that scrubs ambient MB env before a module snapshots it (scripts/mcp-server.ts reads
// MENGBOT_URL / MB_PORT at evaluation). Import order is the contract: keep it above the module under test.
import { isAmbientMbKey } from "./mb-env.ts";

for (const key of Object.keys(process.env)) {
  if (isAmbientMbKey(key)) delete process.env[key];
}
