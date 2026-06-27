// @ts-check
/**
 * Agentic-safety lint rules. See STRICT_TYPESCRIPT.md for the rationale behind
 * each group and how to comply. The config is intentionally type-aware
 * (projectService) so the unsafe-* rules can reason about real types rather
 * than syntax alone.
 */
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },

  // ---- Base: type-aware recommended set for all TS source --------------------
  {
    files: ["src/**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        // Use the check config so test files (excluded from the build tsconfig)
        // are still covered by type-aware linting.
        project: ["./tsconfig.check.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver": {
        typescript: { project: "./tsconfig.check.json" },
      },
    },
    rules: {
      // --- Prevent unsafe AI output -----------------------------------------
      // `any` is banned; prefer `unknown` and narrow. Inline-justify rare cases.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      // Only nullable booleans are forbidden as implicit conditions; plain
      // string/number truthiness stays ergonomic for normal product code.
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowString: true,
          allowNumber: true,
          allowNullableObject: true,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // --- Disable-comment discipline ---------------------------------------
      // Every escape hatch must carry a written justification.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description", minimumDescriptionLength: 10 },
      ],

      // --- Imports / exports ------------------------------------------------
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "import-x/no-duplicates": "error",
      "import-x/no-cycle": ["error", { maxDepth: Infinity }],
      // CLI codebase: named exports everywhere (config files are exempt below).
      "import-x/no-default-export": "error",

      // --- Layer boundaries (see STRICT_TYPESCRIPT.md §Layering) -------------
      // Leaf -> top: core -> tasks -> planner/scheduler -> workers -> commands/cli.
      // Forbid upward / sideways imports that would tangle the layers.
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/core",
              from: [
                "./src/commands",
                "./src/planner",
                "./src/scheduler",
                "./src/workers",
                "./src/reports",
                "./src/cli.ts",
              ],
              message:
                "core/ is a pure leaf layer and must not import from higher layers.",
            },
            {
              target: "./src/tasks",
              from: ["./src/commands", "./src/workers", "./src/cli.ts"],
              message: "tasks/ must not import from commands, workers, or the CLI.",
            },
            {
              target: ["./src/planner", "./src/scheduler"],
              from: ["./src/commands", "./src/cli.ts"],
              message: "Domain layers must not import from commands or the CLI.",
            },
            {
              // Only the orchestration command (run) may reach the worker layer.
              target: ["./src/core", "./src/planner", "./src/scheduler", "./src/reports", "./src/tasks"],
              from: ["./src/workers"],
              message: "Only commands/ may import the side-effectful workers/ layer.",
            },
          ],
        },
      ],
    },
  },

  // ---- Tests: relax fixture-only ergonomics ---------------------------------
  {
    files: ["src/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "import-x/no-restricted-paths": "off",
    },
  },

  // ---- Config files: default export is the required entry shape -------------
  {
    files: ["*.config.ts", "*.config.js", "eslint.config.js"],
    rules: {
      "import-x/no-default-export": "off",
    },
  },
);
