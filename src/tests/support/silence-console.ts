import { vi, beforeAll, afterAll } from "vitest";

/**
 * Silences the controlled loop's console narration for the calling test file.
 *
 * `runRunCommand` intentionally logs its progress to stdout/stderr — selected
 * task, kernel-guard violations, validation regressions — which is useful at the
 * CLI but pure noise in the vitest reporter. Tests that drive the loop call this
 * once at module scope; the spies are restored after the file finishes so no
 * other file is affected. This stubs the outside world (the console), not any of
 * our own logic, so it stays within the testing philosophy.
 */
export function silenceLoopNarration(): void {
  const spies: Array<{ mockRestore: () => void }> = [];
  beforeAll(() => {
    spies.push(vi.spyOn(console, "log").mockReturnValue(undefined));
    spies.push(vi.spyOn(console, "error").mockReturnValue(undefined));
  });
  afterAll(() => {
    for (const spy of spies) spy.mockRestore();
  });
}
