import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runRunCommand } from "../commands/run.js";
import { runFounderInterview } from "../commands/interview.js";
import { loadTasks, saveTasks } from "../tasks/task-store.js";
import { snapshotKernel } from "../core/vault.js";
import { MockWorker } from "../workers/claude.js";
import { MockInterviewer } from "../workers/interviewer.js";
import { kosTask } from "./support/builders.js";
import {
  makeTempVault,
  removeTempVault,
  writeVaultFile,
} from "./support/tmp-vault.js";
import { silenceLoopNarration } from "./support/silence-console.js";

silenceLoopNarration();

let dir: string;
beforeEach(async () => {
  dir = await makeTempVault("kos-interview-");
  await writeVaultFile(dir, "Home.md", "# Home\n\nstub\n");
  await writeVaultFile(dir, "01 Kernel/Constitution.md", "# Constitution\n\nv1\n");
});
afterEach(async () => {
  await removeTempVault(dir);
});

describe("founder interview in the run loop", () => {
  it("captures founder answers and completes the task without calling the worker", async () => {
    // Seed the single open task as a top-priority founder interview so the
    // scheduler selects it ahead of any derived layer work.
    await saveTasks(dir, [
      kosTask({
        type: "founder_interview",
        priority: "critical",
        goal: "Capture founder product intent",
        questions: ["What is the core product?", "Who is the target user?"],
      }),
    ]);
    const kernelBefore = await snapshotKernel(dir);

    const code = await runRunCommand(dir, {
      maxIterations: 1,
      worker: new MockWorker(),
      interviewer: new MockInterviewer(),
    });
    expect(code).toBe(0);

    // The founder task is complete; the worker never wrote its mock concept doc.
    const tasks = await loadTasks(dir);
    expect(tasks.find((t) => t.id === "T-001")?.status).toBe("complete");
    await expect(fs.readdir(path.join(dir, "04 Domain"))).rejects.toThrow();

    // Exactly one interview capture, holding the questions and the human answers.
    const captures = await fs.readdir(path.join(dir, "00 Inbox", "Interviews"));
    const interviews = captures.filter((f) => /^Interview-.*\.md$/.test(f));
    expect(interviews).toHaveLength(1);
    const body = await fs.readFile(
      path.join(dir, "00 Inbox", "Interviews", interviews[0] ?? ""),
      "utf8",
    );
    expect(body).toContain("## Question");
    expect(body).toContain("What is the core product?");
    expect(body).toContain("## Answer");
    // Proof the answer came from the interviewer, not the model.
    expect(body).toContain("no AI judgement involved");

    // Projections were generated.
    for (const f of ["Founder Questions.md", "Interview Log.md"]) {
      await expect(
        fs.access(path.join(dir, "90 Meta", f)),
      ).resolves.toBeUndefined();
    }

    // Kernel is byte-for-byte unchanged.
    const kernelAfter = await snapshotKernel(dir);
    expect([...kernelAfter.entries()]).toEqual([...kernelBefore.entries()]);
  });

  it("does not overwrite an earlier interview captured in the same minute", async () => {
    // Same minute => identical YYYY-MM-DD-HHMM slug; the second must not clobber the first.
    const sameMinute = (): Date => new Date("2026-06-27T20:27:30.000Z");
    const interviewer = new MockInterviewer();
    const first = kosTask({ id: "T-001", type: "founder_interview", questions: ["A?"] });
    const second = kosTask({ id: "T-002", type: "founder_interview", questions: ["B?"] });

    await runFounderInterview(dir, first, interviewer, sameMinute);
    await runFounderInterview(dir, second, interviewer, sameMinute);

    const captures = (await fs.readdir(path.join(dir, "00 Inbox", "Interviews")))
      .filter((f) => /^Interview-.*\.md$/.test(f));
    expect(captures).toHaveLength(2);
  });
});
