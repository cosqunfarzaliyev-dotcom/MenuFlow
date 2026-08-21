/**
 * Verifies lib/translations.js's getLocalizedProduct/getLocalizedCategoryName
 * resolve the DB-translation -> legacy-demo-map -> AZ-source precedence chain
 * correctly (0029_product_category_translations.sql). Pure function tests,
 * no DB — same "closest thing to a test" style as the other
 * scripts/verify-*.mjs files.
 *
 * Run: node scripts/verify-translations.mjs
 */
import { getLocalizedProduct, getLocalizedCategoryName, productTranslations } from '../lib/translations.js';

let failed = false;
const fail = (msg) => {
  console.error('FAIL:', msg);
  failed = true;
};
const pass = (msg) => console.log('PASS:', msg);

// 1. DB translation wins when present.
{
  const product = { id: 'uuid-1', name: 'Pizza', description: 'Original desc', translations: { en: { name: 'Pizza EN' } } };
  const result = getLocalizedProduct(product, 'en');
  if (result.name !== 'Pizza EN') fail(`DB translation should win: got name=${result.name}`);
  if (result.description !== 'Original desc') fail('missing DB description should fall back to the AZ description, not blank it');
}

// 2. Falls back to the AZ name when translations.en is absent entirely.
{
  const product = { id: 'uuid-2', name: 'Burger', description: 'Desc' };
  const result = getLocalizedProduct(product, 'en');
  if (result.name !== 'Burger') fail(`no translations object should fall back to AZ name, got ${result.name}`);
}

// 3. An empty-string translation is treated as absent (cleanTranslations on
//    the write path should already strip these, but the READ path must not
//    trust a stale/hand-inserted empty string either).
{
  const product = { id: 'uuid-3', name: 'Salad', description: 'Desc', translations: { en: { name: '' } } };
  const result = getLocalizedProduct(product, 'en');
  if (result.name !== 'Salad') fail(`empty-string translation must fall back to AZ name, got "${result.name}"`);
}

// 4. lang === 'az' returns the exact same object reference — cheap
//    perf invariant the pre-existing code already had; a regression here
//    would mean every AZ render now allocates a new object per product.
{
  const product = { id: 'uuid-4', name: 'Kabab', description: 'Desc' };
  if (getLocalizedProduct(product, 'az') !== product) fail('lang=az must return the same object reference, not a clone');
}

// 5. Legacy demo map still wins for a seed id with no DB translations column
//    at all (offline data/menu.json mode) — proves this mode didn't regress.
{
  const legacyId = Object.keys(productTranslations)[0]; // 'p1'
  const product = { id: legacyId, name: 'Seed AZ Name', description: 'Seed AZ Desc' };
  const result = getLocalizedProduct(product, 'en');
  const expected = productTranslations[legacyId].en;
  if (result.name !== expected.name) fail(`legacy demo map should still resolve for seed id '${legacyId}', got name=${result.name}`);
}

// 6. DB translation beats the legacy demo map when a row somehow has both
//    (shouldn't happen in practice — DB rows have UUID ids, not seed ids —
//    but precedence order must still be DB-first if it ever does).
{
  const legacyId = Object.keys(productTranslations)[0];
  const product = { id: legacyId, name: 'AZ', description: 'AZ desc', translations: { en: { name: 'DB wins' } } };
  const result = getLocalizedProduct(product, 'en');
  if (result.name !== 'DB wins') fail(`DB translation must beat the legacy map, got name=${result.name}`);
}

// 7. getLocalizedCategoryName mirrors the same precedence (DB -> AZ; no
//    legacy map to test against a real category id since categoryTranslations
//    is keyed by demo slugs like 'pizza', which IS its own legacy-map check).
{
  const dbCategory = { id: 'uuid-cat-1', name: 'Şirniyyat', translations: { ru: { name: 'Десерты РУ' } } };
  if (getLocalizedCategoryName(dbCategory, 'ru') !== 'Десерты РУ') fail('category DB translation should win');

  const noTransCategory = { id: 'uuid-cat-2', name: 'İçkilər' };
  if (getLocalizedCategoryName(noTransCategory, 'ru') !== 'İçkilər') fail('category with no translations should fall back to AZ name');

  const legacyCategory = { id: 'pizza', name: 'Pizzalar' };
  if (getLocalizedCategoryName(legacyCategory, 'en') !== 'Pizzas') fail("legacy category map should still resolve for seed id 'pizza'");

  if (getLocalizedCategoryName(dbCategory, 'az') !== dbCategory.name) fail('lang=az must return category.name unchanged');
}

// 8. Sanity: only the requested locale's own key is read — a translations
//    object that has 'ru' but not 'en' must fall back to AZ for lang='en',
//    not accidentally cross-read the other locale. Matches the DB check
//    constraint's shape (0029: translations - 'en' - 'ru' must be empty) —
//    there's never a third key to worry about in real data, but the
//    resolver itself must not silently substitute the wrong locale either.
{
  const product = { id: 'uuid-5', name: 'Fallback', description: 'Desc', translations: { ru: { name: 'RU only' } } };
  const result = getLocalizedProduct(product, 'en');
  if (result.name !== 'Fallback') fail(`translations.ru present but translations.en absent must fall back to AZ for lang='en', got name="${result.name}"`);
}

if (failed) {
  process.exit(1);
}

console.log('PASS: translation resolver precedence chain resolves correctly for all 8 checks');
