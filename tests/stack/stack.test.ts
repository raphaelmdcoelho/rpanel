import { describe, expect, it } from "vitest";
import { connect } from "node:net";

const base = process.env.RPANEL_URL || "http://127.0.0.1";
const host = new URL(base).hostname;

function portIsOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: 1500 });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(false));
  });
}

describe("running stack, seen from outside", () => {
  it("answers the health path through nginx", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", database: "ok" });
  });

  it("serves the web shell at the root", async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("rpanel");
  });

  it("sets security headers on the web shell and on API responses", async () => {
    for (const path of ["/", "/api/health"]) {
      const res = await fetch(`${base}${path}`);
      expect(res.headers.get("x-content-type-options"), path).toBe("nosniff");
      expect(res.headers.get("x-frame-options"), path).toBe("DENY");
      expect(res.headers.get("referrer-policy"), path).toBe("no-referrer");
      expect(res.headers.get("content-security-policy"), path).toContain("frame-ancestors 'none'");
    }
  });

  it("does not expose the API port directly", async () => {
    const proxyPort = Number(new URL(base).port || 80);
    expect(await portIsOpen(proxyPort)).toBe(true);
    expect(await portIsOpen(3000)).toBe(false);
  });
});
