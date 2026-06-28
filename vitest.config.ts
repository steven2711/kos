import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    environment: "node",
    globals: false,
    coverage: {
      // Reported, not gated — a signal for where confidence is thin, never a
      // pass/fail bar. No `thresholds`; `npm run check` stays fast. See
      // TESTING_PHILOSOPHY.md ("Coverage philosophy").
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/tests/**",
        "src/cli.ts",
        "src/reports/**",
        "**/*.d.ts",
      ],
    },
  },
});
