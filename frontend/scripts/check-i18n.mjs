/**
 * check-i18n.mjs — V5.0 multilingual guardrail.
 *
 * Fails (exit 1) when any locale drifts from en-IN:
 *  1. key parity — every key in en-IN.json must exist in each locale (and
 *     vice versa, so deleted English keys don't linger untranslated);
 *  2. placeholder parity — the multiset of top-level ICU placeholders
 *     ({count}, {page}, {x, plural, ...}) per key must match en-IN, so MT
 *     can never silently drop a {variable} (the most common Sarvam failure).
 *
 * Run: `node scripts/check-i18n.mjs` or `npm run i18n:check`.
 * Run it after every `sarvam-localize translate` and before every commit
 * that touches messages/.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");
const BASE = "en-IN.json";
const VAR = /\{([a-zA-Z_][a-zA-Z0-9_]*)[,}]/g;

function flat(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const fp = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flat(v, fp, out);
    else out[fp] = v;
  }
  return out;
}

function varsOf(str) {
  const counts = {};
  for (const m of String(str).matchAll(VAR)) {
    counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  }
  return counts;
}

function sameCounts(a, b) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

const base = flat(JSON.parse(readFileSync(join(dir, BASE), "utf8")));
const baseVars = Object.fromEntries(
  Object.entries(base).map(([k, v]) => [k, varsOf(v)])
);

let failures = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json") && f !== BASE)) {
  const locale = file.replace(/\.json$/, "");
  const cur = flat(JSON.parse(readFileSync(join(dir, file), "utf8")));
  const missing = Object.keys(base).filter((k) => !(k in cur));
  const extra = Object.keys(cur).filter((k) => !(k in base));
  const varmm = Object.keys(base).filter(
    (k) => k in cur && !sameCounts(baseVars[k], varsOf(cur[k]))
  );
  if (missing.length || extra.length || varmm.length) {
    failures += 1;
    console.log(`${locale}: MISSING=${missing.length} EXTRA=${extra.length} VARMISMATCH=${varmm.length}`);
    for (const k of [...missing, ...extra, ...varmm].slice(0, 10)) console.log(`  - ${k}`);
  } else {
    console.log(`${locale}: OK (${Object.keys(cur).length} keys)`);
  }
}

if (failures > 0) {
  console.error("\ni18n check FAILED — fix dictionaries before committing.");
  process.exit(1);
}
console.log("\ni18n check passed.");
