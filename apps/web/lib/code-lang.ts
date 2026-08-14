const EXTENSION_TO_LANG: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  json: "json",
  jsonc: "jsonc",
  html: "html",
  htm: "html",
  css: "css",
  py: "python",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  markdown: "markdown",
  graphql: "graphql",
  gql: "graphql",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  diff: "diff",
  patch: "diff",
  hcl: "hcl",
  tf: "hcl",
  toml: "toml",
};

export const SHIKI_LANGUAGES = [
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "json",
  "jsonc",
  "html",
  "css",
  "python",
  "yaml",
  "markdown",
  "graphql",
  "sql",
  "bash",
  "shell",
  "diff",
  "hcl",
  "toml",
] as const;

export function getLangFromFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  // Falls back to a language not in SHIKI_LANGUAGES on purpose — CodeHighlighted
  // gracefully renders plain, unhighlighted text when it can't resolve a grammar.
  return EXTENSION_TO_LANG[ext] ?? "text";
}
