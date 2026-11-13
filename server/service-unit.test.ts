import { describe, expect, it } from "vitest";

import {
  checkSentinelInstall, launchdPlist, sentinelCommand, sentinelLaunchdPlist, sentinelServicePlan, sentinelSystemdService, sentinelSystemdTimer,
  sentinelUnitCommand, serviceCommand, servicePlan, shippedSentinelCli, systemdUnit, unstableInstallWarning, type ServiceSpec,
} from "./service-unit.ts";

const spec: ServiceSpec = {
  node: "/usr/bin/node",
  script: "/usr/lib/node_modules/mengbot/cli.js",
  serveArgs: ["--port", "8799", "--data-dir", "/home/meng/.mengbot", "--domain", "meng.example.com", "--no-pair"],
  dataDir: "/home/meng/.mengbot",
  user: "meng",
  home: "/home/meng",
  bindsLowPorts: true,
  label: "agentada",
};

describe("service units", () => {
  it("runs the same serve command, with strip-types only for a checkout", () => {
    expect(serviceCommand(spec)).toEqual(["/usr/bin/node", "/usr/lib/node_modules/mengbot/cli.js", "serve", ...spec.serveArgs]);
    expect(serviceCommand({ ...spec, script: "/srv/MengBot/server/mengbot.ts" })[1]).toBe("--experimental-strip-types");
  });

  it("renders a systemd unit that restarts, runs as the user, and grants low ports only for --domain", () => {
    const unit = systemdUnit(spec);
    expect(unit).toContain("Description=MengBot (agentada)");
    expect(unit).toContain("User=meng");
    expect(unit).toContain("Environment=OMB_DATA_DIR=/home/meng/.mengbot");
    expect(unit).toContain("ExecStart=/usr/bin/node /usr/lib/node_modules/mengbot/cli.js serve --port 8799 --data-dir /home/meng/.mengbot --domain meng.example.com --no-pair");
    expect(unit).toContain("Restart=always");
    expect(unit).toContain("AmbientCapabilities=CAP_NET_BIND_SERVICE");
    expect(unit).toContain("WantedBy=multi-user.target");
    const local = systemdUnit({ ...spec, bindsLowPorts: false, serveArgs: ["--port", "8799", "--data-dir", "/home/meng/.mengbot"] });
    expect(local).not.toContain("CAP_NET_BIND_SERVICE");
    expect(systemdUnit({ ...spec, dataDir: "/home/meng/My Data", serveArgs: ["--data-dir", "/home/meng/My Data"] })).toContain('ExecStart=/usr/bin/node /usr/lib/node_modules/mengbot/cli.js serve --data-dir "/home/meng/My Data"');
  });

  it("renders a launchd agent that keeps the server alive and logs under the data dir", () => {
    const plist = launchdPlist({ ...spec, home: "/Users/meng", dataDir: "/Users/meng/.mengbot" });
    expect(plist).toContain("<string>com.mengbot.serve</string>");
    expect(plist).toContain("<string>/usr/bin/node</string>");
    expect(plist).toContain("<string>serve</string>");
    expect(plist).toContain("<string>meng.example.com</string>");
    expect(plist).toContain("<key>KeepAlive</key>");
    expect(plist).toContain("/Users/meng/.mengbot/logs/service.log");
    expect(launchdPlist({ ...spec, serveArgs: ["--label", "a & b <c>"] })).toContain("<string>a &amp; b &lt;c&gt;</string>");
  });

  it("refuses to point a service at an npx cache, and knows where each platform's file goes", () => {
    expect(unstableInstallWarning("/home/meng/.npm/_npx/abc123/node_modules/mengbot/cli.js")).toMatch(/npm install -g mengbot/);
    expect(unstableInstallWarning("/usr/lib/node_modules/mengbot/cli.js")).toBeNull();
    const linux = servicePlan("linux", "/home/meng/.mengbot");
    expect(linux?.installed).toBe("/etc/systemd/system/mengbot.service");
    expect(linux?.activate.join("\n")).toContain("systemctl enable --now mengbot");
    const mac = servicePlan("darwin", "/Users/meng/.mengbot", "/Users/meng");
    expect(mac?.installed).toBe("/Users/meng/Library/LaunchAgents/com.mengbot.serve.plist");
    expect(mac?.activate.join("\n")).toContain("launchctl bootstrap gui/$(id -u)");
    expect(servicePlan("win32", "C:\\x")).toBeNull();
  });

  it("renders Sentinel as a launchd agent on an interval, under its own label, logging outside the data dir", () => {
    const out = "/Users/meng/Library/Application Support/mengbot-sentinel";
    const sentinel = { node: "/usr/bin/node", script: "/usr/lib/node_modules/mengbot/cli.js", dataDir: "/Users/meng/.mengbot", home: "/Users/meng", out };
    expect(sentinelCommand(sentinel)).toEqual(["/usr/bin/node", "/usr/lib/node_modules/mengbot/cli.js", "sentinel", "--once", "--data-dir", "/Users/meng/.mengbot", "--out", out]);
    expect(sentinelCommand({ ...sentinel, script: "/srv/MengBot/server/mengbot.ts" })[1]).toBe("--experimental-strip-types");
    const plist = sentinelLaunchdPlist(sentinel);
    expect(plist).toContain("<string>com.mengbot.sentinel</string>");
    expect(plist).toContain("<key>StartInterval</key>\n\t<integer>120</integer>");
    expect(plist).toContain("<string>sentinel</string>");
    expect(plist).not.toContain("KeepAlive");
    expect(plist).toContain(`<string>${out}/sentinel.log</string>`);
    expect(plist).not.toContain(".mengbot/logs");
    const mac = sentinelServicePlan("darwin", out, "/Users/meng");
    expect(mac?.files).toEqual([{ name: "com.mengbot.sentinel.plist", installed: "/Users/meng/Library/LaunchAgents/com.mengbot.sentinel.plist" }]);
    // a path with a space is one argument in the printed commands
    expect(mac?.activate[0]).toBe("mkdir -p /Users/meng/Library/LaunchAgents && cp '/Users/meng/Library/Application Support/mengbot-sentinel/com.mengbot.sentinel.plist' /Users/meng/Library/LaunchAgents/com.mengbot.sentinel.plist");
    expect(mac?.deactivate[0]).toBe("launchctl bootout gui/$(id -u)/com.mengbot.sentinel");
  });

  it("renders Sentinel as a systemd user timer, with no root", () => {
    const sentinel = { node: "/usr/bin/node", script: "/usr/lib/node_modules/mengbot/cli.js", dataDir: "/home/meng/My Data", home: "/home/meng", out: "/home/meng/.local/state/mengbot-sentinel" };
    const unit = sentinelSystemdService(sentinel);
    expect(unit).toContain("Type=oneshot");
    expect(unit).toContain('ExecStart=/usr/bin/node /usr/lib/node_modules/mengbot/cli.js sentinel --once --data-dir "/home/meng/My Data" --out /home/meng/.local/state/mengbot-sentinel');
    expect(unit).not.toContain("User=");
    expect(sentinelSystemdTimer()).toContain("OnUnitActiveSec=120s");
    expect(sentinelSystemdTimer()).toContain("WantedBy=timers.target");
    const linux = sentinelServicePlan("linux", sentinel.out, "/home/meng");
    expect(linux?.files.map((file) => file.installed)).toEqual(["/home/meng/.config/systemd/user/mengbot-sentinel.service", "/home/meng/.config/systemd/user/mengbot-sentinel.timer"]);
    expect(linux?.activate[0]).toContain("cp /home/meng/.local/state/mengbot-sentinel/mengbot-sentinel.service");
    expect(linux?.activate.join("\n")).toContain("systemctl --user enable --now mengbot-sentinel.timer");
    expect(linux?.activate.join("\n")).not.toContain("sudo");
    expect(sentinelServicePlan("win32", "C:\\x")).toBeNull();
  });

  it("finds the CLI the installed desktop app ships, and runs it as Node", () => {
    const app = "/Applications/MengBot.app/Contents";
    const present = new Set([`${app}/MacOS/MengBot`, `${app}/Resources/server/mengbot.js`]);
    expect(shippedSentinelCli("darwin", "/Users/meng", (path) => present.has(path))).toEqual({ node: `${app}/MacOS/MengBot`, script: `${app}/Resources/server/mengbot.js` });
    const user = "/Users/meng/Applications/MengBot.app/Contents";
    expect(shippedSentinelCli("darwin", "/Users/meng", (path) => path.startsWith(user))?.script).toBe(`${user}/Resources/server/mengbot.js`);
    expect(shippedSentinelCli("linux", "/home/meng", (path) => path.startsWith("/opt/MengBot/"))).toEqual({ node: "/opt/MengBot/mengbot", script: "/opt/MengBot/resources/server/mengbot.js" });
    // an app with its script missing, or one released before Sentinel, is no CLI for it
    expect(shippedSentinelCli("darwin", "/Users/meng", (path) => path.endsWith("MacOS/MengBot"))).toBeNull();
    expect(shippedSentinelCli("darwin", "/Users/meng", (path) => present.has(path), () => false)).toBeNull();
    expect(shippedSentinelCli("win32", "C:\\Users\\meng", () => true)).toBeNull();

    const spec = { node: `${app}/MacOS/MengBot`, script: `${app}/Resources/server/mengbot.js`, dataDir: "/Users/meng/.mengbot", home: "/Users/meng", out: "/tmp/s", electronRunAsNode: true };
    expect(sentinelLaunchdPlist(spec)).toContain("<key>ELECTRON_RUN_AS_NODE</key>\n\t\t<string>1</string>");
    expect(sentinelSystemdService(spec)).toContain("Environment=ELECTRON_RUN_AS_NODE=1");
    expect(sentinelLaunchdPlist({ ...spec, electronRunAsNode: false })).not.toContain("ELECTRON_RUN_AS_NODE");
  });

  it("keeps every path one quoted value in the systemd unit, and refuses one no unit can hold", () => {
    const spec = { node: "/usr/bin/node", script: "/srv/omb/cli.js", dataDir: "/home/meng/100% $HOME\\", home: "/home/my meng", out: "/home/my meng/.local/state/mengbot-sentinel" };
    const unit = sentinelSystemdService(spec);
    expect(unit).toContain('Environment="HOME=/home/my meng"');
    // % is no specifier, $ no variable, and the trailing backslash no continuation
    expect(unit).toContain('"/home/meng/100%% $$HOME\\\\"');
    expect(sentinelUnitCommand(unit)).toEqual({ node: "/usr/bin/node", script: "/srv/omb/cli.js" });
    expect(sentinelUnitCommand(sentinelSystemdService({ ...spec, script: "/srv/100% $x/cli.js" }))?.script).toBe("/srv/100% $x/cli.js");
    for (const bad of ["/home/meng\n[Service]\nExecStartPre=/bin/true", "/home/meng\r", "/home/\0meng"]) {
      expect(() => sentinelSystemdService({ ...spec, home: bad })).toThrow(/line break or NUL/);
      expect(() => sentinelLaunchdPlist({ ...spec, dataDir: bad })).toThrow(/line break or NUL/);
    }
  });

  it("reads back what an installed unit runs, and calls it stale when either path is gone", () => {
    const spec = { node: "/opt/node & co/bin/node", script: "/srv/omb/cli.js", dataDir: "/home/meng/My Data", home: "/home/meng", out: "/home/meng/.local/state/mengbot-sentinel" };
    expect(sentinelUnitCommand(sentinelLaunchdPlist(spec))).toEqual({ node: "/opt/node & co/bin/node", script: "/srv/omb/cli.js" });
    expect(sentinelUnitCommand(sentinelSystemdService(spec))).toEqual({ node: "/opt/node & co/bin/node", script: "/srv/omb/cli.js" });
    expect(sentinelUnitCommand("[Service]\nType=oneshot\n")).toBeNull();

    const unit = "/home/meng/.config/systemd/user/mengbot-sentinel.service";
    const timer = "/home/meng/.config/systemd/user/mengbot-sentinel.timer";
    const files = new Map([[unit, sentinelSystemdService(spec)]]);
    const fs = (present: string[]) => ({ exists: (path: string) => files.has(path) || present.includes(path), read: (path: string) => files.get(path)! });
    expect(checkSentinelInstall("linux", "/home/meng", fs([spec.node, spec.script, timer]))).toMatchObject({ status: "ok", unit });
    expect(checkSentinelInstall("linux", "/home/meng", fs([spec.node, timer]))).toMatchObject({ status: "stale", missing: ["/srv/omb/cli.js"] });
    // the service without its timer never runs
    expect(checkSentinelInstall("linux", "/home/meng", fs([spec.node, spec.script]))).toMatchObject({ status: "stale", missing: [timer] });
    expect(checkSentinelInstall("darwin", "/Users/meng", fs([]))).toEqual({ status: "not_installed", unit: "/Users/meng/Library/LaunchAgents/com.mengbot.sentinel.plist" });
    files.set(unit, "garbage");
    expect(checkSentinelInstall("linux", "/home/meng", fs([]))).toEqual({ status: "unreadable", unit });
    expect(checkSentinelInstall("win32", "C:\\Users\\meng", fs([]))).toEqual({ status: "unsupported" });
  });
});
