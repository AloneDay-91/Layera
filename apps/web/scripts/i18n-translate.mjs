#!/usr/bin/env node
// Fills in missing keys in the non-English message catalogs (messages/*.json)
// by asking Claude to translate them from messages/en.json, the source of truth.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/i18n-translate.mjs
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/i18n-translate.mjs fr        # only fr
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/i18n-translate.mjs --dry-run

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = path.join(__dirname, "..", "messages");
const SOURCE_LOCALE = "en";
const MODEL = "claude-haiku-4-5-20251001";

const LOCALE_NAMES = {
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
};

function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      flatten(value, flatKey, out);
    } else {
      out[flatKey] = value;
    }
  }
  return out;
}

function unflatten(flat) {
  const out = {};
  for (const [flatKey, value] of Object.entries(flat)) {
    const parts = flatKey.split(".");
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) {
      node = node[parts[i]] ??= {};
    }
    node[parts[parts.length - 1]] = value;
  }
  return out;
}

async function translateBatch(entries, targetLanguage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const prompt = `You are translating UI strings for a file-manager web app from English to ${targetLanguage}.
Translate each value. Keep ICU placeholders like {name} or {count} exactly as-is (same spelling, same braces).
Keep the tone concise and consistent with typical SaaS product UI copy.
Return ONLY a JSON object mapping the same keys to their ${targetLanguage} translations — no markdown, no explanation.

Input:
${JSON.stringify(entries, null, 2)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Could not parse translation response:\n${text}`);
  return JSON.parse(jsonMatch[0]);
}

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const requestedLocales = args.filter((a) => !a.startsWith("--"));

  const sourcePath = path.join(MESSAGES_DIR, `${SOURCE_LOCALE}.json`);
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const flatSource = flatten(source);

  const files = await readdir(MESSAGES_DIR);
  const allLocales = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .filter((locale) => locale !== SOURCE_LOCALE);

  const locales = requestedLocales.length > 0 ? requestedLocales : allLocales;

  for (const locale of locales) {
    const targetLanguage = LOCALE_NAMES[locale] ?? locale;
    const targetPath = path.join(MESSAGES_DIR, `${locale}.json`);

    let existing = {};
    try {
      existing = JSON.parse(await readFile(targetPath, "utf8"));
    } catch {
      // New locale file, starts empty.
    }
    const flatExisting = flatten(existing);

    const missing = {};
    for (const [key, value] of Object.entries(flatSource)) {
      if (!(key in flatExisting)) missing[key] = value;
    }

    const missingKeys = Object.keys(missing);
    if (missingKeys.length === 0) {
      console.log(`[${locale}] up to date (${Object.keys(flatSource).length} keys).`);
      continue;
    }

    console.log(`[${locale}] translating ${missingKeys.length} missing key(s)…`);
    if (dryRun) {
      console.log(missingKeys.map((k) => `  - ${k}`).join("\n"));
      continue;
    }

    const translated = await translateBatch(missing, targetLanguage);
    const merged = { ...flatExisting, ...translated };
    const orderedFlat = {};
    for (const key of Object.keys(flatSource)) {
      orderedFlat[key] = merged[key] ?? flatSource[key];
    }

    await writeFile(targetPath, JSON.stringify(unflatten(orderedFlat), null, 2) + "\n", "utf8");
    console.log(`[${locale}] wrote ${missingKeys.length} translation(s) to ${path.relative(process.cwd(), targetPath)}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
