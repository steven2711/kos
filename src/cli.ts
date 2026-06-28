#!/usr/bin/env node
/**
 * KOS CLI v0 entry point.
 *
 *   kos validate <vaultPath>
 *   kos ingest   <vaultPath> <inputFile>
 *   kos start    <vaultPath>
 *   kos compile  <vaultPath>
 *   kos analyze  <vaultPath>
 *   kos research <vaultPath> [query]
 *   kos explain  <vaultPath>
 *   kos run      <vaultPath> --max-iterations 3
 */
import { Command } from "commander";
import path from "node:path";
import { runValidateCommand } from "./commands/validate.js";
import { runIngestCommand } from "./commands/ingest.js";
import { runStartCommand, type StartOptions } from "./commands/start.js";
import { runCompileCommand } from "./commands/compile.js";
import { runAnalyzeCommand } from "./commands/analyze.js";
import { runResearchCommand } from "./commands/research.js";
import { runPromoteCommand, type PromoteOptions } from "./commands/promote.js";
import { runExplainCommand } from "./commands/explain.js";
import { runRunCommand } from "./commands/run.js";

function resolveVault(p: string): string {
  return path.resolve(p);
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("kos")
    .description("Knowledge Operating System CLI v0")
    .version("0.1.0");

  program
    .command("validate")
    .argument("<vaultPath>", "path to the KOS vault")
    .description("Validate the vault against the Kernel rules and write a report")
    .action(async (vaultPath: string) => {
      process.exitCode = await runValidateCommand(resolveVault(vaultPath));
    });

  program
    .command("ingest")
    .argument("<vaultPath>", "path to the KOS vault")
    .argument("<inputFile>", "idea/PRD markdown file to ingest")
    .description("Capture an input into the Inbox and seed the task queue")
    .action(async (vaultPath: string, inputFile: string) => {
      process.exitCode = await runIngestCommand(
        resolveVault(vaultPath),
        path.resolve(inputFile),
      );
    });

  program
    .command("start")
    .argument("<vaultPath>", "path to the KOS vault")
    .option(
      "--max-iterations <n>",
      "cap the build loop (default: run to completion)",
    )
    .option("--no-analyze", "skip the semantic review after building")
    .description(
      "One command: seed tasks from 00 Inbox/, build to completion, review, and report",
    )
    .action(
      async (
        vaultPath: string,
        options: { maxIterations?: string; analyze?: boolean },
      ) => {
        const opts: StartOptions = {};
        if (options.maxIterations !== undefined) {
          const max = parseInt(options.maxIterations, 10);
          if (!Number.isFinite(max) || max < 1) {
            console.error("--max-iterations must be a positive integer");
            process.exitCode = 1;
            return;
          }
          opts.maxIterations = max;
        }
        if (options.analyze === false) opts.analyze = false;
        process.exitCode = await runStartCommand(resolveVault(vaultPath), opts);
      },
    );

  program
    .command("compile")
    .argument("<vaultPath>", "path to the KOS vault")
    .description("Validate + analyse the vault; write reports and refresh tasks")
    .action(async (vaultPath: string) => {
      process.exitCode = await runCompileCommand(resolveVault(vaultPath));
    });

  program
    .command("analyze")
    .argument("<vaultPath>", "path to the KOS vault")
    .description(
      "Run the LLM Semantic Reviewer: write the Semantic Report and propose advisory tasks",
    )
    .action(async (vaultPath: string) => {
      process.exitCode = await runAnalyzeCommand(resolveVault(vaultPath));
    });

  program
    .command("research")
    .argument("<vaultPath>", "path to the KOS vault")
    .argument("[query]", "optional one-off research query")
    .description(
      "Run the Research Worker: gather cited evidence into 07 Research/ and propose follow-ups",
    )
    .action(async (vaultPath: string, query: string | undefined) => {
      process.exitCode = await runResearchCommand(resolveVault(vaultPath), query);
    });

  program
    .command("promote")
    .argument("<vaultPath>", "path to the KOS vault")
    .option("--proposal <id>", "review only this proposal id (P-NNN)")
    .option("--approve", "approve every pending proposal (non-interactive)")
    .option("--reject", "reject every pending proposal (non-interactive)")
    .option("--request-changes", "request changes on every pending proposal")
    .option("--yes", "alias for --approve")
    .description(
      "Review knowledge proposals; merge founder-approved changes into canonical docs",
    )
    .action(
      async (
        vaultPath: string,
        options: {
          proposal?: string;
          approve?: boolean;
          reject?: boolean;
          requestChanges?: boolean;
          yes?: boolean;
        },
      ) => {
        const opts: PromoteOptions = {};
        if (options.proposal !== undefined) opts.proposalId = options.proposal;
        if (options.approve === true || options.yes === true) opts.decision = "approve";
        else if (options.reject === true) opts.decision = "reject";
        else if (options.requestChanges === true) opts.decision = "request_changes";
        process.exitCode = await runPromoteCommand(resolveVault(vaultPath), opts);
      },
    );

  program
    .command("explain")
    .argument("<vaultPath>", "path to the KOS vault")
    .description("Explain the score, blockers, next task, and remaining work")
    .action(async (vaultPath: string) => {
      process.exitCode = await runExplainCommand(resolveVault(vaultPath));
    });

  program
    .command("run")
    .argument("<vaultPath>", "path to the KOS vault")
    .option("--max-iterations <n>", "maximum tasks to run", "3")
    .description("Run the controlled loop: one Claude-powered task at a time")
    .action(async (vaultPath: string, options: { maxIterations: string }) => {
      const max = parseInt(options.maxIterations, 10);
      if (!Number.isFinite(max) || max < 1) {
        console.error("--max-iterations must be a positive integer");
        process.exitCode = 1;
        return;
      }
      process.exitCode = await runRunCommand(resolveVault(vaultPath), {
        maxIterations: max,
      });
    });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
