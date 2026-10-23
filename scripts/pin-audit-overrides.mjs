import { readFileSync, writeFileSync } from "node:fs";

// `pnpm audit --fix` writes override values as `>=x.y.z`. That range resolves
// to the newest release, so a Next 15 patch can become Next 16. Pin each
// override added or changed by this run to the minimum patched version.
const path = process.argv[2] ?? "pnpm-workspace.yaml";
const beforePath = process.argv[3];
const beforeLines = new Set(
  beforePath ? readFileSync(beforePath, "utf8").split("\n") : [],
);

const next = readFileSync(path, "utf8")
  .split("\n")
  .map((line) => {
    if (beforeLines.has(line)) return line;
    return line.replace(/: '>=(\d+\.\d+\.\d+)'/, ": '$1'");
  })
  .join("\n");

writeFileSync(path, next);
