/**
 * Mechanical guard for the customer-menu colour presets shipped in
 * lib/services/themePresetService.js (migration 0043).
 *
 * A preset is a palette we hand the restaurant owner as a safe starting point.
 * If one of them fails contrast, we are the reason a customer cannot read the
 * menu — so each is asserted against WCAG 2.x AA:
 *
 *   1. Body text on the page background   >= 4.5:1
 *   2. Body text on the card surface      >= 4.5:1
 *   3. Button label on the button colour  >= 4.5:1, where the label is whatever
 *      pickReadableForeground() will actually choose at runtime.
 *   4. Every preset key has a themePreset<Key>Label entry in all three locale
 *      blocks of lib/i18n/dictionaries/admin.js.
 *   5. DEFAULT_THEME matches the DB column defaults in the 0043 migration, so
 *      the panel's "reset" button and the schema cannot drift apart.
 *
 * Text/regex parsing rather than dynamic import, same standalone-node style as
 * every other scripts/verify-*.mjs (those modules import via the `@/` alias,
 * which plain Node cannot resolve outside the Next.js build).
 *
 * Run: node scripts/verify-theme-presets.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failed = false;
const fail = (msg) => { console.error('FAIL:', msg); failed = true; };
const pass = (msg) => console.log('PASS:', msg);

// --- WCAG relative luminance / contrast (mirrors lib/utils.js) --------------
const parseHex = (hex) => {
  const raw = String(hex || '').trim().replace(/^#/, '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const luminance = (hex) => {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const ch = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2]);
};
const contrast = (a, b) => {
  const la = luminance(a); const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};
const pickForeground = (bg) => {
  const l = luminance(bg);
  if (l === null) return '#FFFFFF';
  return l > 0.5 ? '#18181B' : '#FFFFFF';
};

// --- Parse the preset registry ---------------------------------------------
const presetSrc = readFileSync(path.join(ROOT, 'lib/services/themePresetService.js'), 'utf8');

const readPalette = (block) => {
  const get = (field) => block.match(new RegExp(field + ":\\s*'(#[0-9a-fA-F]{3,6})'"))?.[1];
  return { background: get('background'), surface: get('surface'), text: get('text'), primary: get('primary') };
};

const presetBlocks = [...presetSrc.matchAll(/\{\s*key:\s*'([a-z]+)'\s*,([^}]*)\}/g)];
if (presetBlocks.length === 0) fail('themePresetService.js: no presets parsed — did the registry shape change?');

const AA = 4.5;
let contrastProblems = 0;
for (const [, key, body] of presetBlocks) {
  const p = readPalette(body);
  const missing = Object.entries(p).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) { fail(`preset '${key}': missing field(s) ${missing.join(', ')}`); contrastProblems++; continue; }

  const onBg = contrast(p.text, p.background);
  const onSurface = contrast(p.text, p.surface);
  const label = pickForeground(p.primary);
  const onButton = contrast(label, p.primary);

  for (const [what, ratio] of [['text on background', onBg], ['text on surface', onSurface], [`button label (${label}) on button`, onButton]]) {
    if (ratio === null) { fail(`preset '${key}': unparseable colour in "${what}"`); contrastProblems++; }
    else if (ratio < AA) { fail(`preset '${key}': ${what} is ${ratio.toFixed(2)}:1, below the ${AA}:1 AA bar`); contrastProblems++; }
  }
}
if (contrastProblems === 0) pass(`all ${presetBlocks.length} presets clear WCAG AA ${AA}:1 for text and button labels`);

// --- Every preset key is translated in all three locales --------------------
const adminDict = readFileSync(path.join(ROOT, 'lib/i18n/dictionaries/admin.js'), 'utf8');
let missingLabels = 0;
for (const [, key] of presetBlocks) {
  const labelKey = `themePreset${key.charAt(0).toUpperCase()}${key.slice(1)}Label`;
  const count = (adminDict.match(new RegExp(`^\\s*${labelKey}:`, 'gm')) || []).length;
  if (count !== 3) { fail(`admin.js: '${labelKey}' appears ${count} time(s), expected 3 (az/en/ru)`); missingLabels++; }
}
if (missingLabels === 0) pass(`all ${presetBlocks.length} preset labels present in az/en/ru`);

// --- DEFAULT_THEME must equal the migration's column defaults ---------------
const migration = readFileSync(path.join(ROOT, 'supabase/migrations/0043_customer_theme_colors.sql'), 'utf8');
const defaultBlock = presetSrc.match(/DEFAULT_THEME\s*=\s*\{([^}]*)\}/)?.[1] || '';
const defaults = readPalette(defaultBlock);
// `text` comes from an ALTER ... SET DEFAULT rather than the ADD COLUMN above:
// theme_secondary_color already existed (0006) and 0043 realigns its default
// to the value .kit-light used to hardcode. This check exists because the
// first version of it only compared background/surface and therefore missed
// exactly that mismatch.
const schemaDefaults = {
  background: migration.match(/theme_background_color text not null default '(#[0-9A-Fa-f]{6})'/)?.[1],
  surface: migration.match(/theme_surface_color text not null default '(#[0-9A-Fa-f]{6})'/)?.[1],
  text: migration.match(/alter column theme_secondary_color set default '(#[0-9A-Fa-f]{6})'/)?.[1],
};
let driftCount = 0;
for (const field of ['background', 'surface', 'text']) {
  if (!schemaDefaults[field]) { fail(`0043 migration: could not read the default for theme_${field}_color`); driftCount++; }
  else if (defaults[field]?.toUpperCase() !== schemaDefaults[field].toUpperCase()) {
    fail(`DEFAULT_THEME.${field} (${defaults[field]}) != 0043 column default (${schemaDefaults[field]})`);
    driftCount++;
  }
}
if (driftCount === 0) pass('DEFAULT_THEME matches the 0043 column defaults');

if (failed) process.exit(1);
console.log(`PASS: theme preset invariants hold for ${presetBlocks.length} presets`);
