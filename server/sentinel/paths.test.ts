import { describe, expect, it } from "vitest";

import { defaultSentinelOut, isInside } from "./paths.ts";

describe("sentinel paths", () => {
  it("keeps Sentinel's files in the platform's state folder, outside the data dir", () => {
    expect(defaultSentinelOut("/Users/meng/.mengbot", "darwin", "/Users/meng", {})).toBe("/Users/meng/Library/Application Support/mengbot-sentinel");
    expect(defaultSentinelOut("/home/meng/.mengbot", "linux", "/home/meng", {})).toBe("/home/meng/.local/state/mengbot-sentinel");
    expect(defaultSentinelOut("/home/meng/.mengbot", "linux", "/home/meng", { XDG_STATE_HOME: "/var/state/meng" })).toBe("/var/state/meng/mengbot-sentinel");
    // a relative XDG_STATE_HOME is invalid by the spec and ignored
    expect(defaultSentinelOut("/home/meng/.mengbot", "linux", "/home/meng", { XDG_STATE_HOME: "state" })).toBe("/home/meng/.local/state/mengbot-sentinel");
    expect(defaultSentinelOut("C:\\Users\\meng\\.mengbot", "win32", "C:\\Users\\meng", { LOCALAPPDATA: "D:\\Local" })).toBe("D:\\Local\\mengbot-sentinel");
  });

  it("gives any other data dir its own subfolder, the same one every time", () => {
    const other = defaultSentinelOut("/srv/omb-data", "linux", "/home/meng", {});
    expect(other).toMatch(/^\/home\/meng\/\.local\/state\/mengbot-sentinel\/data-[0-9a-f]{12}$/);
    expect(defaultSentinelOut("/srv/omb-data", "linux", "/home/meng", {})).toBe(other);
    expect(defaultSentinelOut("/srv/omb-data-2", "linux", "/home/meng", {})).not.toBe(other);
  });

  it("knows when a folder is inside another", () => {
    expect(isInside("/d/omb/sentinel", "/d/omb", "linux")).toBe(true);
    expect(isInside("/d/omb", "/d/omb", "linux")).toBe(true);
    expect(isInside("/d/omb-sentinel", "/d/omb", "linux")).toBe(false);
    expect(isInside("/d", "/d/omb", "linux")).toBe(false);
    expect(isInside("C:\\d\\omb\\x", "C:\\d\\omb", "win32")).toBe(true);
  });
});
