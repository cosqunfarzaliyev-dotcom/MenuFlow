/**
 * Verifies the site_content/site_faq_items CMS (supabase/migrations/
 * 0032_site_content_cms.sql) stays in sync across its three sources of truth:
 *   1. lib/services/siteContentService.js's SITE_CONTENT_GROUPS/
 *      CONTACT_DETAIL_KEYS registry (what the SuperAdmin editor can edit)
 *   2. the migration's own seed section (what actually exists in the DB
 *      the moment this migration is applied)
 *   3. lib/site-content/defaults.js (what renders when supabaseServerReady
 *      is false — CLAUDE.md's "no .env.local -> still renders" guarantee)
 *
 * Text/regex extraction, not dynamic import: siteContentService.js imports
 * `supabase`/`supabaseReady` via the `@/lib/supabase` alias (which itself
 * pulls in @supabase/ssr's browser client), neither of which plain Node can
 * resolve/run outside the Next build — same reasoning as
 * scripts/verify-i18n-keys.mjs. lib/site-content/defaults.js has zero
 * imports, so THAT one is loaded with a real dynamic import.
 *
 * Run: node scripts/verify-site-content.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failed = false;
const fail = (msg) => {
  console.error('FAIL:', msg);
  failed = true;
};
const pass = (msg) => console.log('PASS:', msg);

// ---------------------------------------------------------------------------
// 1. Registry keys, from siteContentService.js's own source.
// ---------------------------------------------------------------------------
const serviceSrc = readFileSync(path.join(ROOT, 'lib/services/siteContentService.js'), 'utf8');

const extractBlock = (src, startMarker, endMarker) => {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error(`end marker not found after ${startMarker}: ${endMarker}`);
  return src.slice(start, end);
};

// Dotted keys only (home.hero.title, contact.whatsapp_url, ...) — excludes
// stray quoted strings like locale codes ('en'/'ru') that appear elsewhere
// in the same file but never contain a dot.
const DOTTED_KEY = /'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'/g;

const groupsBlock = extractBlock(serviceSrc, 'export const SITE_CONTENT_GROUPS = {', '\n};');
const registryGroupKeys = [...groupsBlock.matchAll(DOTTED_KEY)].map((m) => m[1]);

const contactBlock = extractBlock(serviceSrc, 'export const CONTACT_DETAIL_KEYS = [', '];');
const registryContactKeys = [...contactBlock.matchAll(DOTTED_KEY)].map((m) => m[1]);

const registryKeys = new Set([...registryGroupKeys, ...registryContactKeys]);

if (registryKeys.size !== registryGroupKeys.length + registryContactKeys.length) {
  fail(`siteContentService.js: a key appears in both SITE_CONTENT_GROUPS and CONTACT_DETAIL_KEYS (or is duplicated)`);
} else {
  pass(`siteContentService.js: ${registryKeys.size} registry keys, no duplicates`);
}

// ---------------------------------------------------------------------------
// 2. Seeded keys, from the migration's own site_content INSERT.
// ---------------------------------------------------------------------------
const migrationPath = path.join(ROOT, 'supabase/migrations/0032_site_content_cms.sql');
const migrationSrc = readFileSync(migrationPath, 'utf8');

const seedBlock = extractBlock(
  migrationSrc,
  'insert into public.site_content (key, value_az, translations) values',
  "on conflict (key) do nothing;",
);
// First quoted string on each seed row is the key: `  ('key.name', 'value...', '{...}'::jsonb),`
const SEED_ROW_KEY = /^ {2}\('([a-z0-9_.]+)',/gm;
const seededKeys = new Set([...seedBlock.matchAll(SEED_ROW_KEY)].map((m) => m[1]));

const missingFromSeed = [...registryKeys].filter((k) => !seededKeys.has(k));
const extraInSeed = [...seededKeys].filter((k) => !registryKeys.has(k));

if (missingFromSeed.length) {
  fail(`registry keys with no seed row in 0032_site_content_cms.sql: ${missingFromSeed.join(', ')}`);
} else {
  pass(`every registry key (${registryKeys.size}) has a seed row in 0032_site_content_cms.sql`);
}
if (extraInSeed.length) {
  fail(`0032_site_content_cms.sql seeds a key not in the registry: ${extraInSeed.join(', ')}`);
} else {
  pass('0032_site_content_cms.sql seeds no key outside the registry');
}

// ---------------------------------------------------------------------------
// 3. Offline defaults — real dynamic import (defaults.js has zero imports).
// ---------------------------------------------------------------------------
const { SITE_CONTENT_DEFAULTS, SITE_FAQ_DEFAULTS } = await import('../lib/site-content/defaults.js');

const LOCALES = ['az', 'en', 'ru'];
const missingDefaults = [];
for (const key of registryKeys) {
  const entry = SITE_CONTENT_DEFAULTS[key];
  if (!entry) {
    missingDefaults.push(`${key}: no entry at all`);
    continue;
  }
  for (const l of LOCALES) {
    // contact.address is seeded blank on purpose (no address exists in the
    // source dictionaries — see 0032's seed comment) — empty string is a
    // valid default for it, not a gap.
    if (key === 'contact.address') continue;
    if (typeof entry[l] !== 'string' || !entry[l]) missingDefaults.push(`${key}.${l}`);
  }
}
if (missingDefaults.length) {
  fail(`lib/site-content/defaults.js missing/empty values: ${missingDefaults.join(', ')}`);
} else {
  pass(`lib/site-content/defaults.js has az/en/ru for every registry key (contact.address exempt)`);
}

const extraDefaults = Object.keys(SITE_CONTENT_DEFAULTS).filter((k) => !registryKeys.has(k));
if (extraDefaults.length) {
  fail(`lib/site-content/defaults.js has a key not in the registry: ${extraDefaults.join(', ')}`);
} else {
  pass('lib/site-content/defaults.js has no key outside the registry');
}

// ---------------------------------------------------------------------------
// 4. FAQ: seed count matches defaults count, both are 10, sort_order steps
//    of 10 with no gaps or duplicates (the site_faq_items_sort_order_key
//    unique constraint would reject a duplicate at apply time, but a gap or
//    a wrong step is a silent ordering bug this catches instead).
// ---------------------------------------------------------------------------
const faqSeedBlock = extractBlock(
  migrationSrc,
  'insert into public.site_faq_items (sort_order, question_az, answer_az, translations) values',
  'on conflict (sort_order) do nothing;',
);
const FAQ_ROW_ORDER = /^ {2}\((\d+),/gm;
const seededFaqOrders = [...faqSeedBlock.matchAll(FAQ_ROW_ORDER)].map((m) => Number(m[1]));

if (seededFaqOrders.length !== SITE_FAQ_DEFAULTS.length) {
  fail(`FAQ row count mismatch: migration seeds ${seededFaqOrders.length}, defaults.js has ${SITE_FAQ_DEFAULTS.length}`);
} else {
  pass(`FAQ row count matches: ${seededFaqOrders.length} in both the migration seed and defaults.js`);
}

const expectedOrders = SITE_FAQ_DEFAULTS.map((_, i) => (i + 1) * 10);
const ordersMatch = JSON.stringify(seededFaqOrders) === JSON.stringify(expectedOrders);
if (!ordersMatch) {
  fail(`FAQ sort_order sequence is not a clean 10/20/30/... step: got [${seededFaqOrders.join(', ')}]`);
} else {
  pass('FAQ sort_order sequence is a clean 10-step (10, 20, 30, ...)');
}

let faqItemsOk = true;
for (const item of SITE_FAQ_DEFAULTS) {
  for (const field of ['question', 'answer']) {
    for (const l of LOCALES) {
      if (typeof item[field]?.[l] !== 'string' || !item[field][l]) {
        fail(`defaults.js FAQ item sortOrder=${item.sortOrder}: missing ${field}.${l}`);
        faqItemsOk = false;
      }
    }
  }
}
if (faqItemsOk) pass('every FAQ default has az/en/ru question + answer');

// ---------------------------------------------------------------------------
process.exit(failed ? 1 : 0);
