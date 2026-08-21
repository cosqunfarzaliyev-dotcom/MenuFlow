// ---------------------------------------------------------------------------
// Public marketing site CMS — the service layer for the two structures added
// in supabase/migrations/0032_site_content_cms.sql:
//   Page copy + contact details -> site_content   (key/value, AZ + optional EN/RU)
//   FAQ questions/answers       -> site_faq_items  (ordered rows)
//
// This is the SINGLE source both the marketing pages (app/[locale]/**,
// server-rendered, reading via lib/supabase-server.js's `supabaseServer`)
// and the SuperAdmin "Veb sayt" mode tabs (SitePagesTab/SiteContactTab/
// SiteFaqTab, reading via the browser `supabase` client) read from and write
// to — same one-source-of-truth property planService.js documents between
// /pricing and the entitlement resolver.
//
// SITE_CONTENT_GROUPS is the frozen registry of every valid `site_content`
// key, grouped by the page it belongs to. It is the SuperAdmin editor's only
// input (Phase 4) and scripts/verify-site-content.mjs's source of truth —
// adding a new editable string means adding it here AND to the migration's
// seed AND to lib/site-content/defaults.js, in that order.
// ---------------------------------------------------------------------------
import { supabase, supabaseReady } from '@/lib/supabase';
import { SITE_CONTENT_DEFAULTS } from '@/lib/site-content/defaults';

export const SITE_CONTENT_GROUPS = {
  home: [
    'home.hero.eyebrow', 'home.hero.title', 'home.hero.subtitle',
    'home.hero.cta_primary', 'home.hero.cta_secondary', 'home.hero.note',
    'home.qr.eyebrow', 'home.qr.title', 'home.qr.subtitle',
    'home.features.eyebrow', 'home.features.title', 'home.features.subtitle',
    'home.ecosystem.eyebrow', 'home.ecosystem.title', 'home.ecosystem.subtitle',
    'home.pricing_cta.eyebrow', 'home.pricing_cta.title', 'home.pricing_cta.subtitle', 'home.pricing_cta.button',
    'home.faq_cta.eyebrow', 'home.faq_cta.title',
    'home.contact_cta.eyebrow', 'home.contact_cta.title', 'home.contact_cta.subtitle', 'home.contact_cta.button',
  ],
  features: [
    'features.hero.eyebrow', 'features.hero.title', 'features.hero.subtitle',
    'features.cta.title', 'features.cta.subtitle', 'features.cta.button',
  ],
  faq: ['faq.hero.eyebrow', 'faq.hero.title', 'faq.hero.subtitle'],
  demo: [
    'demo.hero.eyebrow', 'demo.hero.title', 'demo.hero.subtitle',
    'demo.cta.title', 'demo.cta.subtitle', 'demo.cta.button',
  ],
  contact: ['contact.hero.eyebrow', 'contact.hero.title', 'contact.hero.subtitle'],
  pricing: ['pricing.hero.title', 'pricing.hero.subtitle'],
};

// Separate from SITE_CONTENT_GROUPS (not folded into `contact`): these three
// are edited from SiteContactTab.jsx's own dedicated form (URL/email/address
// fields, not free-text page-copy inputs), even though they live in the same
// `site_content` table — see supabaseService.js's precedent for splitting
// tabs by editing UX, not by table.
export const CONTACT_DETAIL_KEYS = ['contact.whatsapp_url', 'contact.email', 'contact.address'];

export const SITE_CONTENT_KEYS = [...Object.values(SITE_CONTENT_GROUPS).flat(), ...CONTACT_DETAIL_KEYS];

// Page copy + contact details ------------------------------------------------

// All rows, unfiltered — callers key off SITE_CONTENT_KEYS/SITE_CONTENT_GROUPS
// themselves to pick out what they need (marketing pages want one key with a
// resolveSiteText() fallback chain; SitePagesTab wants every key in a group).
export const fetchSiteContent = async (client = supabase) => {
  if (!supabaseReady) return [];
  const { data, error } = await client.from('site_content').select('*');
  if (error) {
    console.error('fetchSiteContent error:', error);
    return [];
  }
  return data || [];
};

// EN/RU override for a single-string site_content value: {"en":"...","ru":"..."}
// — deliberately NOT cleanTranslations (supabaseService.js), which is shaped
// for {name, description} pairs on products/categories and lives on that
// write path. Sibling function, same reasoning: an admin who typed an EN
// override then cleared it must fall back to AZ, not save an empty string
// that would shadow it (getLocalizedProduct's exact failure mode, avoided
// here the same way).
export const cleanStringTranslations = (translations) => {
  if (!translations || typeof translations !== 'object') return {};
  const cleaned = {};
  for (const locale of ['en', 'ru']) {
    const value = translations[locale];
    if (typeof value === 'string' && value.trim()) cleaned[locale] = value.trim();
  }
  return cleaned;
};

// Explicit whitelist, never a spread — PostgREST 400s on any unknown key,
// and an omitted key here is a silent no-op (the trap toProductRow's own
// comment warns about, supabaseService.js L596-598).
const toSiteContentRow = (entry) => {
  const row = {};
  if (entry.valueAz !== undefined) row.value_az = entry.valueAz;
  if (entry.translations !== undefined) row.translations = cleanStringTranslations(entry.translations);
  return row;
};

// Upsert, not update-only: `key` is the primary key and every valid key is
// already seeded by 0032, but upsert also lets a future migration add a new
// registry key without needing a matching INSERT in its own seed section —
// the first SuperAdmin save for that key just creates the row.
export const upsertSiteContent = async ({ key, valueAz, translations }) => {
  if (!supabaseReady) return { row: null, error: new Error('Supabase not ready') };
  if (!SITE_CONTENT_KEYS.includes(key)) {
    return { row: null, error: new Error(`Unknown site_content key: ${key}`) };
  }
  const payload = { key, ...toSiteContentRow({ valueAz, translations }) };
  const { data, error } = await supabase.from('site_content').upsert(payload, { onConflict: 'key' }).select('*').single();
  if (error) {
    console.error('upsertSiteContent error:', error);
    return { row: null, error };
  }
  return { row: data, error: null };
};

// requested locale -> az -> defaultValue. Mirrors getLocalizedProduct's
// (lib/translations.js) DB-translation -> AZ-source chain exactly, minus the
// legacy-seed-map step (site_content has no offline demo-data precedent to
// fall back through — lib/site-content/defaults.js is that fallback instead,
// consulted by the CALLER when supabaseServerReady is false, not by this
// function, which only resolves within an already-fetched row).
export const resolveSiteText = (row, locale, defaultValue = '') => {
  if (!row) return defaultValue;
  if (locale === 'az') return row.value_az || defaultValue;
  const translated = row.translations?.[locale];
  return translated || row.value_az || defaultValue;
};

// Convenience for the marketing pages: turns fetchSiteContent()'s flat row
// array into a plain {key: resolvedString} object for the requested locale,
// falling back to lib/site-content/defaults.js per key when a row is
// missing entirely (supabaseServerReady === false, or a key was added to
// the registry but hasn't been seeded/saved yet) — the same "app still
// renders without .env.local" guarantee CLAUDE.md documents, extended here.
// Only ever includes SITE_CONTENT_KEYS entries — an unrelated row somehow
// present in the table is silently ignored, matching the registry-is-truth
// rule documented at the top of this file.
export const buildSiteContentMap = (rows, locale, defaults = SITE_CONTENT_DEFAULTS) => {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const map = {};
  for (const key of SITE_CONTENT_KEYS) {
    const fallback = defaults[key]?.[locale] || defaults[key]?.az || '';
    map[key] = resolveSiteText(byKey.get(key), locale, fallback);
  }
  return map;
};

// FAQ items -------------------------------------------------------------------

// { publishedOnly: true } is the marketing-page default (unpublished rows
// are SuperAdmin drafts); SiteFaqTab passes false to manage every row
// including drafts.
export const fetchFaqItems = async (client = supabase, { publishedOnly = true } = {}) => {
  if (!supabaseReady) return [];
  let query = client.from('site_faq_items').select('*').order('sort_order', { ascending: true });
  if (publishedOnly) query = query.eq('is_published', true);
  const { data, error } = await query;
  if (error) {
    console.error('fetchFaqItems error:', error);
    return [];
  }
  return data || [];
};

// Sibling of cleanStringTranslations, shaped for {question, answer} pairs —
// the products.translations {name, description} pattern (0029), applied to
// FAQ's own two text fields instead.
export const cleanFaqTranslations = (translations) => {
  if (!translations || typeof translations !== 'object') return {};
  const cleaned = {};
  for (const locale of ['en', 'ru']) {
    const entry = translations[locale];
    if (!entry || typeof entry !== 'object') continue;
    const trimmed = {};
    if (typeof entry.question === 'string' && entry.question.trim()) trimmed.question = entry.question.trim();
    if (typeof entry.answer === 'string' && entry.answer.trim()) trimmed.answer = entry.answer.trim();
    if (Object.keys(trimmed).length > 0) cleaned[locale] = trimmed;
  }
  return cleaned;
};

const toFaqItemRow = (item) => {
  const row = {};
  if (item.questionAz !== undefined) row.question_az = item.questionAz;
  if (item.answerAz !== undefined) row.answer_az = item.answerAz;
  if (item.translations !== undefined) row.translations = cleanFaqTranslations(item.translations);
  if (item.isPublished !== undefined) row.is_published = item.isPublished;
  if (item.sortOrder !== undefined) row.sort_order = item.sortOrder;
  return row;
};

// New rows land at the end of the published list by default — one extra
// read (max sort_order) rather than asking the caller to compute it, since
// the unique constraint on sort_order means a wrong guess 409s.
export const createFaqItem = async ({ questionAz, answerAz, translations, isPublished = true }) => {
  if (!supabaseReady) return { item: null, error: new Error('Supabase not ready') };
  const { data: existing, error: maxError } = await supabase
    .from('site_faq_items')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) {
    console.error('createFaqItem error:', maxError);
    return { item: null, error: maxError };
  }
  const nextSortOrder = (existing?.sort_order ?? 0) + 10;
  const { data, error } = await supabase
    .from('site_faq_items')
    .insert({ ...toFaqItemRow({ questionAz, answerAz, translations, isPublished }), sort_order: nextSortOrder })
    .select('*')
    .single();
  if (error) {
    console.error('createFaqItem error:', error);
    return { item: null, error };
  }
  return { item: data, error: null };
};

export const updateFaqItem = async (item) => {
  if (!supabaseReady) return { item: null, error: new Error('Supabase not ready') };
  const { id, ...rest } = item;
  const { data, error } = await supabase.from('site_faq_items').update(toFaqItemRow(rest)).eq('id', id).select('*').single();
  if (error) {
    console.error('updateFaqItem error:', error);
    return { item: null, error };
  }
  return { item: data, error: null };
};

export const deleteFaqItem = async (id) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase.from('site_faq_items').delete().eq('id', id);
  if (error) console.error('deleteFaqItem error:', error);
  return { error: error || null };
};

// Reassigns sort_order for every id in `idsInDesiredOrder`, in that order.
// Two passes, not one: site_faq_items_sort_order_key (0032) is a UNIQUE
// constraint, so writing final values directly in a single pass can try to
// put two rows at the same sort_order mid-sequence (e.g. swapping items at
// 10/20 needs an intermediate state). Pass 1 moves every row to a disjoint
// negative scratch range first; pass 2 assigns the real 10/20/30/... values
// in final order. supabase-js has no client-side transaction API, so this
// is sequential awaited updates, not a single atomic statement — acceptable
// here because a reorder is a low-frequency SuperAdmin action, not a
// customer-facing write path.
export const reorderFaqItems = async (idsInDesiredOrder) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  try {
    for (let i = 0; i < idsInDesiredOrder.length; i++) {
      const { error } = await supabase.from('site_faq_items').update({ sort_order: -(i + 1) }).eq('id', idsInDesiredOrder[i]);
      if (error) throw error;
    }
    for (let i = 0; i < idsInDesiredOrder.length; i++) {
      const { error } = await supabase.from('site_faq_items').update({ sort_order: (i + 1) * 10 }).eq('id', idsInDesiredOrder[i]);
      if (error) throw error;
    }
    return { error: null };
  } catch (error) {
    console.error('reorderFaqItems error:', error);
    return { error };
  }
};

// requested locale -> az. Mirrors resolveSiteText's chain, folded into one
// {id, question, answer} shape for FAQ rendering (no defaultValue param —
// question_az/answer_az are NOT NULL, so there is always something to show).
export const resolveFaqItem = (row, locale) => {
  if (!row) return null;
  if (locale === 'az') return { id: row.id, question: row.question_az, answer: row.answer_az };
  const translated = row.translations?.[locale];
  return {
    id: row.id,
    question: translated?.question || row.question_az,
    answer: translated?.answer || row.answer_az,
  };
};
