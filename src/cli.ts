#!/usr/bin/env node
/**
 * KOS CLI v0 entry point.
 *
 *   kos validate <vaultPath>
 *   kos ingest   <vaultPath> <inputFile>
 *   kos compile  <vaultPath>
 *   kos analyze  <vaultPath>
 *   kos explain  <vaultPath>
 *   kos run      <vaultPath> --max-iterations 3
 */
import { Command } from "commander";
import path from "node:path";
import { runValidateCommand } from "./commands/validate.js";
import { runIngestCommand } from "./commands/ingest.js";
import { runCompileCommand } from "./commands/compile.js";
import { runAnalyzeCommand } from "./commands/analyze.js";
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
