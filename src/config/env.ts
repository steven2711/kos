/**
 * Environment-variable boundary.
 *
 * Process env is an untyped `Record<string, string | undefined>` — a classic
 * source of silent drift. Every KOS-specific variable is parsed here, once,
 * through a Zod schema so the rest of the codebase consumes a typed, validated
 * `KosEnv` instead of poking at `process.env` directly. Values are lowercased
 * before validation to preserve the original case-insensitive behaviour, and an
 * invalid value fails fast with a clear error rather than silently degrading.
 */
import { z } from "zod";

const lower = (v: unknown): unknown =>
  typeof v === "string" ? v.toLowerCase() : v;

const EnvSchema = z.object({
  /** Billing/auth mode for the Claude worker. */
  KOS_AUTH: z
    .preprocess(lower, z.enum(["subscription", "api-key"]))
    .default("subscription"),
  /** Force a specific worker implementation; unset = real Claude worker. */
  KOS_AGENT: z.preprocess(lower, z.enum(["mock", "claude"]).optional()),
  /** Force the research worker; unset = follow KOS_AGENT, else real Claude. */
  KOS_RESEARCH_WORKER: z.preprocess(lower, z.enum(["mock", "claude"]).optional()),
  /** Force the promotion reviewer; unset = follow KOS_AGENT, else terminal. */
  KOS_PROMOTION_REVIEWER: z.preprocess(lower, z.enum(["mock", "terminal"]).optional()),
  /** Per-task agent turn budget for the worker (kos run/start). */
  KOS_MAX_TURNS: z.coerce.number().int().positive().default(300),
  /** API key, only honoured when KOS_AUTH=api-key. */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Subscription OAuth token from `claude setup-token`. */
  CLAUDE_CODE_OAUTH_TOKEN: z.string().min(1).optional(),
});

export type KosEnv = z.infer<typeof EnvSchema>;

/**
 * Parse and validate the KOS-relevant subset of an environment. Defaults to
 * `process.env`; accepts an explicit source for testing. Throws `ZodError` on
 * an invalid value.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): KosEnv {
  return EnvSchema.parse({
    KOS_AUTH: source["KOS_AUTH"],
    KOS_AGENT: source["KOS_AGENT"],
    KOS_RESEARCH_WORKER: source["KOS_RESEARCH_WORKER"],
    KOS_PROMOTION_REVIEWER: source["KOS_PROMOTION_REVIEWER"],
    KOS_MAX_TURNS: source["KOS_MAX_TURNS"],
    ANTHROPIC_API_KEY: source["ANTHROPIC_API_KEY"],
    CLAUDE_CODE_OAUTH_TOKEN: source["CLAUDE_CODE_OAUTH_TOKEN"],
  });
}
