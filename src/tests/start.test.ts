import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runStartCommand, renderStartSummary } from "../commands/start.js";
import { loadTasks } from "../tasks/task-store.js";
import { type ScoreBreakdown } from "../core/scoring.js";
import {
  type Worker,
  type WorkerRequest,
  type WorkerResult,
} from "../workers/claude.js";
import { MockInterviewer } from "../workers/interviewer.js";
import { MockSemanticReviewer } from "../workers/semantic-reviewer.js";
import { markdownDoc, kosTask, proposalTask } from "./support/builders.js";
import {
  makeTempVault,
  removeTempVault,
  writeVaultFile,
} from "./support/tmp-vault.js";
import { silenceLoopNarration } from "./support/silence-console.js";

silenceLoopNarration();

/**
 * A boundary fake standing in for the SDK worker: it writes a validator-passing
 * doc whose links resolve, so a task it handles completes cleanly. (The real
 * MockWorker links to docs absent from a bare vault, which would regress
 * validation; this keeps the loop's *orchestration* the thing under test.)
 */
class StubWorker implements Worker {
  readonly name = "stub";
  async runTask(req: WorkerRequest): Promise<WorkerResult> {
    await writeVaultFile(
      req.vaultPath,
      `04 Domain/${req.task.id}.md`,
      markdownDoc({
        type: "concept",
        title: req.task.id,
        links: ["Home", "Home", "Home", "Home", "Home"],
      }),
    );
    return { success: true, finalText: `wrote a doc for ${req.task.id}` };
  }
}

const SCORE: ScoreBreakdown = {
  score: 72,
  quality: 90,
  coverage: 50,
  errors: 0,
  warnings: 1,
  layersCovered: 4,
  layersTotal: 8,
};

describe("renderStartSummary", () => {
  it("reports the score and points to promotion when proposals are open", () => {
    const md = renderStartSummary({
      score: SCORE,
      docCount: 6,
      tasks: [proposalTask({ id: "T-001", status: "open" })],
      missingLayers: ["02 Vision"],
    });
    expect(md).toContain("72/100");
    expect(md).toContain("kos promote");
  });

  it("prioritises pending founder questions over everything else", () => {
    const md = renderStartSummary({
      score: SCORE,
      docCount: 6,
      tasks: [
        kosTask({ id: "T-001", type: "founder_interview", status: "open" }),
        proposalTask({ id: "T-002", status: "open" }),
      ],
      missingLayers: [],
    });
    expect(md).toContain("founder question");
    expect(md).not.toContain("kos promote");
  });

  it("says the base is up to date when nothing is open", () => {
    const md = renderStartSummary({
      score: SCORE,
      docCount: 6,
      tasks: [kosTask({ id: "T-001", status: "complete" })],
      missingLayers: [],
    });
    expect(md).toContain("up to date");
  });
});

describe("kos start (command)", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTempVault("kos-start-");
    await writeVaultFile(dir, "Home.md", markdownDoc({ title: "Home" }));
    await writeVaultFile(dir, "01 Kernel/Constitution.md", "# Constitution\n\nv1\n");
    await writeVaultFile(dir, "00 Inbox/thesis.md", "# Thesis\n\nraw input\n");
    await writeVaultFile(dir, "00 Inbox/research.md", "# Research\n\nraw input\n");
  });
  afterEach(async () => {
    await removeTempVault(dir);
  });

  it("seeds from every inbox doc, builds, reviews, and reports", async () => {
    const code = await runStartCommand(dir, {
      worker: new StubWorker(),
      interviewer: new MockInterviewer(),
      reviewer: new MockSemanticReviewer(),
      maxIterations: 12,
      quiet: true,
    });
    expect(code).toBe(0);

    const tasks = await loadTasks(dir);
    // One seed set, carrying BOTH dropped docs as inputs.
    const concept = tasks.filter((t) => t.type === "concept_extraction");
    expect(concept).toHaveLength(1);
    expect(concept[0]?.inputs).toEqual(["00 Inbox/research.md", "00 Inbox/thesis.md"]);
    // The build loop made real progress.
    expect(tasks.some((t) => t.status === "complete")).toBe(true);
    // Reports were written (the loop's compile + the semantic review).
    await expect(
      fs.readFile(path.join(dir, "90 Meta", "Knowledge Score.md"), "utf8"),
    ).resolves.toContain("Knowledge");
    await expect(
      fs.readFile(path.join(dir, "90 Meta", "Semantic Report.md"), "utf8"),
    ).resolves.toBeTruthy();
  });

  it("is idempotent: a second run seeds no duplicate inbox tasks", async () => {
    const opts = {
      worker: new StubWorker(),
      interviewer: new MockInterviewer(),
      reviewer: new MockSemanticReviewer(),
      maxIterations: 12,
      quiet: true,
    };
    await runStartCommand(dir, opts);
    await runStartCommand(dir, opts);

    const tasks = await loadTasks(dir);
    expect(tasks.filter((t) => t.type === "concept_extraction")).toHaveLength(1);
  });

  it("no-ops cleanly on an empty inbox with no open work", async () => {
    const empty = await makeTempVault("kos-start-empty-");
    try {
      const code = await runStartCommand(empty, { quiet: true });
      expect(code).toBe(0);
      expect(await loadTasks(empty)).toEqual([]);
    } finally {
      await removeTempVault(empty);
    }
  });
});
