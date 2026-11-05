/**
 * Conventional Commits (docs/REPO_RULES.md §9). Runs from `.husky/commit-msg`.
 *
 * Severity levels: 0 = off, 1 = warning, 2 = error.
 */

/** Allowed scopes: workspace short names plus repo-wide areas. Unknown scopes only warn. */
const SCOPES = [
  // apps/*
  "server",
  "worker",
  "admin",
  "mobile",
  "storybook",
  "e2e",
  // packages/*
  "api",
  "auth",
  "db",
  "queue",
  "shared",
  "ui",
  "observability",
  "tailwind-config",
  // repo-wide
  "tooling",
  "ci",
  "docker",
  "deps",
  "repo",
];

/** @type {import("@commitlint/types").UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 100],
    "scope-enum": [1, "always", SCOPES],
  },
};

export default config;
