import { readFileSync, writeFileSync } from "node:fs";

// `pnpm audit --fix` writes override values as `>=x.y.z`. That range resolves
// to the newest release, so a Next 15 patch can become Next 16. Pin each
// override added or changed by this run to the minimum patched version.
const path = process.argv[2] ?? "pnpm-workspace.yaml";
const beforePath = process.argv[3];
const beforeLines = new Set(
  beforePath ? readFileSync(beforePath, "utf8").split("\n") : [],
);

const pinned = readFileSync(path, "utf8")
  .split("\n")
  .flatMap((line) => {
    if (beforeLines.has(line)) return [line];
    const nextLine = line.replace(/: '>=(\d+\.\d+\.\d+)'/, ": '$1'");
    // stream-json 3.x drops jsonl/Parser.js. minio 8 still imports that 1.x path,
    // so a version-wide override breaks `next build` on Linux.
    if (/^\s*['"]?stream-json@/.test(nextLine)) return [];
    return [nextLine];
  });

if (!pinned.some((line) => line.includes("minio>stream-json"))) {
  const tinypool = pinned.findIndex((line) => line.includes("tinypool@"));
  const pin = "  'minio>stream-json': 1.9.1";
  if (tinypool === -1) pinned.push(pin);
  else pinned.splice(tinypool, 0, pin);
}

writeFileSync(path, `${pinned.join("\n").replace(/\n*$/, "\n")}`);
