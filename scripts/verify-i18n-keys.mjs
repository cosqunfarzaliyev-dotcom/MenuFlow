/**
 * Verifies every per-surface dictionary in lib/i18n/dictionaries/*.js:
 *   1. az/en/ru declare exactly the same key set (no locale silently missing
 *      a key — createTranslationHook()'s az-then-raw-key fallback chain
 *      means a missing key degrades to a visible but wrong string, not a
 *      crash, so nothing else would ever catch this).
 *   2. every declared key is referenced by at least one t('key')-shaped call
 *      somewhere in the repo (catches an orphaned key left behind after a
 *      component is edited/removed).
 *
 * Pure text/regex assertions — no dynamic import, because every dictionary
 * file imports `createTranslationHook` via the `@/lib/i18n` alias, which
 * plain Node can't resolve outside the Next.js build. Same "closest thing to
 * a test" style as the other scripts/verify-*.mjs files; see this repo's
 * dictionaries for the guaranteed shape this script relies on: each file
 * exports `export const <name> = { az: {...}, en: {...}, ru: {...} }` with
 * every key on its own 4-space-indented line and no nested object values
 * (checked once by hand when this script was written — if that ever
 * changes, this script's key-extraction regex needs to change with it).
 *
 * Run: node scripts/verify-i18n-keys.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DICT_DIR = path.join(ROOT, 'lib', 'i18n', 'dictionaries');

let failed = false;
const fail = (msg) => {
  console.error('FAIL:', msg);
  failed = true;
};
const pass = (msg) => console.log('PASS:', msg);

// ---------------------------------------------------------------------------
// Extract each locale block's key set from one dictionary file's source.
// ---------------------------------------------------------------------------
const extractLocaleBlock = (src, locale) => {
  const openMarker = `  ${locale}: {`;
  const startIdx = src.indexOf(openMarker);
  if (startIdx === -1) return null;
  const braceStart = src.indexOf('{', startIdx);
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(braceStart + 1, i);
    }
  }
  return null; // unbalanced — shouldn't happen in valid JS
};

const extractKeys = (blockSrc) =>
  new Set([...blockSrc.matchAll(/^ {4}([A-Za-z0-9_]+):/gm)].map((m) => m[1]));

// ---------------------------------------------------------------------------
// Build one big haystack of every non-dictionary .js/.jsx file, for the
// "is this key referenced anywhere" check. Read once, reused for every key
// in every dictionary — this is the expensive part, so it must not be
// redone per-key.
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.claude']);
let haystack = '';
{
  const chunks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (!/\.(jsx?|mjs)$/.test(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (abs.startsWith(DICT_DIR)) continue; // the declaration site itself doesn't count as usage
      if (abs.includes(`${path.sep}scripts${path.sep}`)) continue; // verify-*.mjs scripts aren't call sites
      chunks.push(readFileSync(abs, 'utf8'));
    }
  };
  walk(ROOT);
  haystack = chunks.join('\n');
}

// A key is "used" if it appears anywhere as a quoted string literal outside
// its own dictionary file. Started narrower (only `t('key')`-shaped calls)
// but this codebase widely uses an INDIRECT pattern too — a config array
// entry like `{ titleKey: 'featureQrMenuTitle' }` (app/features/page.jsx)
// consumed later as `t(item.titleKey)` — which produced ~100 false FAILs
// across marketing.js/onboarding.js/pricing.js/superadmin.js before this was
// widened. The quotes on both sides still anchor it so a key that's a
// substring of another key (e.g. 'status' inside 'statusActive') can't
// false-match. Trades a little precision for not crying wolf on a real,
// common pattern — a truly dead key is still caught, just a key that's only
// ever mentioned in a comment now slips through uncaught (acceptable: this
// script's purpose is catching orphaned keys after a component is edited,
// not auditing comments).
// A THIRD pattern this codebase uses: keys assembled at runtime from a
// template literal, e.g. components/onboarding/OnboardingWizard.jsx does
//   t(`${currentStep}StepTitle`)   with currentStep from a STEPS array
// and app/[locale]/faq/page.jsx used to do t(`faqQ${n}`). Neither ever
// contains the finished key as a literal, so the quoted-string test above
// reports every one of them as an orphan — 16 live onboarding keys plus,
// before the CMS migration, all 20 faqQ/faqA keys. Deleting a key on that
// evidence would make the wizard render a raw `infoStepTitle` on screen.
//
// So: collect every t(`...`) template shape, turn it into a regex over the
// literal segments (a `${...}` hole becomes `.+`), and treat a key matching
// any of them as referenced. Anchored at both ends so `${x}StepTitle` can't
// also swallow an unrelated key that merely ends in "Title".
const TEMPLATE_KEY_PATTERNS = (() => {
  const patterns = [];
  for (const match of haystack.matchAll(/\bt\(`([^`]*\$\{[^`]*)`\)/g)) {
    const shape = match[1];
    // Escape regex metacharacters in the literal parts, then re-open the
    // `${...}` holes as `.+` (at least one char — an empty interpolation
    // would mean the key is fully literal, which the quoted test covers).
    const source = shape
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')          // escape everything
      .replace(/\\\$\\\{[^}]*\\\}/g, '.+');            // un-escape the holes
    patterns.push(new RegExp(`^${source}$`));
  }
  return patterns;
})();

const isKeyUsed = (key) =>
  new RegExp(`['"]${key}['"]`).test(haystack) ||
  TEMPLATE_KEY_PATTERNS.some((re) => re.test(key));

// ---------------------------------------------------------------------------
// Run both checks for every dictionary file.
// ---------------------------------------------------------------------------
const dictFiles = readdirSync(DICT_DIR).filter((f) => f.endsWith('.js'));
if (dictFiles.length === 0) {
  fail('found zero files in lib/i18n/dictionaries — path resolution is broken');
}

let totalKeysChecked = 0;
let totalOrphaned = 0;

for (const file of dictFiles) {
  const src = readFileSync(path.join(DICT_DIR, file), 'utf8');
  const locales = { az: extractLocaleBlock(src, 'az'), en: extractLocaleBlock(src, 'en'), ru: extractLocaleBlock(src, 'ru') };

  for (const [locale, block] of Object.entries(locales)) {
    if (block === null) fail(`${file}: could not find a top-level '${locale}: {' block`);
  }
  if (Object.values(locales).some((b) => b === null)) continue;

  const keySets = Object.fromEntries(Object.entries(locales).map(([locale, block]) => [locale, extractKeys(block)]));

  for (const key of keySets.az) if (keySets.az.size === 0) fail(`${file}: az block has zero keys — extraction regex probably broke`);

  const [azKeys, enKeys, ruKeys] = [keySets.az, keySets.en, keySets.ru];
  const allKeys = new Set([...azKeys, ...enKeys, ...ruKeys]);
  for (const key of allKeys) {
    const missing = ['az', 'en', 'ru'].filter((locale) => !keySets[locale].has(key));
    if (missing.length > 0) {
      fail(`${file}: key '${key}' is missing from locale(s): ${missing.join(', ')}`);
    }
  }

  // Usage check — only over keys present in all three locales, so a
  // parity failure above isn't double-reported here.
  const commonKeys = [...azKeys].filter((k) => enKeys.has(k) && ruKeys.has(k));
  for (const key of commonKeys) {
    totalKeysChecked += 1;
    if (!isKeyUsed(key)) {
      totalOrphaned += 1;
      fail(`${file}: key '${key}' is declared in all 3 locales but never referenced as t('${key}') anywhere in the repo`);
    }
  }
}

if (failed) {
  process.exit(1);
}

pass(`all ${dictFiles.length} dictionaries have matching az/en/ru key sets`);
pass(`all ${totalKeysChecked} keys are referenced somewhere in the repo (0 orphaned)`);
console.log(`PASS: i18n dictionary invariants hold for ${dictFiles.length} files, ${totalKeysChecked} keys`);
