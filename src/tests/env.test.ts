import { describe, it, expect } from "vitest";
import { loadEnv } from "../config/env.js";

describe("loadEnv", () => {
  it("defaults KOS_AUTH to subscription and leaves optionals unset", () => {
    const env = loadEnv({});
    expect(env.KOS_AUTH).toBe("subscription");
    expect(env.KOS_AGENT).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
  });

  it("accepts the documented enum values", () => {
    expect(loadEnv({ KOS_AUTH: "api-key" }).KOS_AUTH).toBe("api-key");
    expect(loadEnv({ KOS_AGENT: "mock" }).KOS_AGENT).toBe("mock");
  });

  it("is case-insensitive about enum values", () => {
    expect(loadEnv({ KOS_AUTH: "API-KEY" }).KOS_AUTH).toBe("api-key");
    expect(loadEnv({ KOS_AGENT: "MOCK" }).KOS_AGENT).toBe("mock");
  });

  it("passes through non-empty credentials", () => {
    const env = loadEnv({
      ANTHROPIC_API_KEY: "sk-test",
      CLAUDE_CODE_OAUTH_TOKEN: "oauth-test",
    });
    expect(env.ANTHROPIC_API_KEY).toBe("sk-test");
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe("oauth-test");
  });

  it("rejects an unknown KOS_AUTH value rather than degrading silently", () => {
    expect(() => loadEnv({ KOS_AUTH: "free" })).toThrow();
  });

  it("rejects an unknown KOS_AGENT value", () => {
    expect(() => loadEnv({ KOS_AGENT: "robot" })).toThrow();
  });

  it("rejects an empty ANTHROPIC_API_KEY", () => {
    expect(() => loadEnv({ ANTHROPIC_API_KEY: "" })).toThrow();
  });

  it("defaults KOS_MAX_TURNS to 300 and coerces a numeric string", () => {
    expect(loadEnv({}).KOS_MAX_TURNS).toBe(300);
    expect(loadEnv({ KOS_MAX_TURNS: "500" }).KOS_MAX_TURNS).toBe(500);
  });

  it("rejects a non-numeric or non-positive KOS_MAX_TURNS", () => {
    expect(() => loadEnv({ KOS_MAX_TURNS: "lots" })).toThrow();
    expect(() => loadEnv({ KOS_MAX_TURNS: "0" })).toThrow();
  });
});
