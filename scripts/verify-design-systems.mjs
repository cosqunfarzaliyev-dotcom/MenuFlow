/**
 * Mechanical guard for CLAUDE.md's most important structural rule: the
 * three design systems (components/kit, components/mkt, .customer-theme)
 * must never mix. Before this script, that rule had zero mechanical
 * enforcement — only code review. Checks:
 *
 *   1. No file imports from both components/kit and components/mkt.
 *   2. No --k-* token literal appears anywhere under components/mkt/.
 *   3. No --mkt-* token literal appears anywhere under components/kit/.
 *   4. Zero remaining references to components/ui (deleted in this pass —
 *      supabase/migrations and doc mentions are fine, only import statements
 *      and bare path references in app/lib/components/scripts count).
 *
 * Pure text/regex assertions, no dynamic import — same standalone-node style
 * as every other scripts/verify-*.mjs file (see verify-i18n-keys.mjs's own
 * header for why: these dictionary/component files import via the `@/`
 * alias, which plain Node can't resolve outside the Next.js build).
 *
 * Run: node scripts/verify-design-systems.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failed = false;
const fail = (msg) => { console.error('FAIL:', msg); failed = true; };
const pass = (msg) => console.log('PASS:', msg);

const SCAN_DIRS = ['app', 'components', 'lib', 'scripts'];
const SOURCE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      walk(full, out);
    } else if (SOURCE_EXT.has(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

const allFiles = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));

// ---------------------------------------------------------------------------
// 1. No file imports from both components/kit and components/mkt.
// ---------------------------------------------------------------------------
let mixedImportFiles = [];
for (const file of allFiles) {
  const src = readFileSync(file, 'utf8');
  const importsKit = /from ['"]@\/components\/kit/.test(src);
  const importsMkt = /from ['"]@\/components\/mkt/.test(src);
  if (importsKit && importsMkt) mixedImportFiles.push(path.relative(ROOT, file));
}
if (mixedImportFiles.length === 0) {
  pass('no file imports from both components/kit and components/mkt');
} else {
  for (const f of mixedImportFiles) fail(`${f} imports from both components/kit and components/mkt`);
}

// ---------------------------------------------------------------------------
// 2/3. Token namespaces never cross into the other system's directory.
// ---------------------------------------------------------------------------
const kitFiles = allFiles.filter((f) => path.relative(ROOT, f).startsWith(`components${path.sep}kit${path.sep}`));
const mktFiles = allFiles.filter((f) => path.relative(ROOT, f).startsWith(`components${path.sep}mkt${path.sep}`));

let kitLeaks = [];
for (const file of kitFiles) {
  if (/--mkt-[a-z-]+/.test(readFileSync(file, 'utf8'))) kitLeaks.push(path.relative(ROOT, file));
}
if (kitLeaks.length === 0) {
  pass('no --mkt-* token literal appears under components/kit/');
} else {
  for (const f of kitLeaks) fail(`${f} references a --mkt-* token — components/kit must stay --k-* only`);
}

let mktLeaks = [];
for (const file of mktFiles) {
  if (/--k-[a-z-]+/.test(readFileSync(file, 'utf8'))) mktLeaks.push(path.relative(ROOT, file));
}
if (mktLeaks.length === 0) {
  pass('no --k-* token literal appears under components/mkt/');
} else {
  for (const f of mktLeaks) fail(`${f} references a --k-* token — components/mkt must stay --mkt-* only`);
}

// ---------------------------------------------------------------------------
// 4. components/ui is gone — zero references anywhere in source.
// ---------------------------------------------------------------------------
let uiReferences = [];
for (const file of allFiles) {
  const src = readFileSync(file, 'utf8');
  if (/components\/ui\b/.test(src)) uiReferences.push(path.relative(ROOT, file));
}
if (uiReferences.length === 0) {
  pass('zero references to components/ui remain (deleted design system)');
} else {
  for (const f of uiReferences) fail(`${f} still references components/ui`);
}

process.exit(failed ? 1 : 0);
