"use client";

// Page-copy management for the public marketing site (Phase 4) — the
// SuperAdmin-side editor over `site_content`
// (supabase/migrations/0032_site_content_cms.sql), grouped by
// SITE_CONTENT_GROUPS (lib/services/siteContentService.js — the single
// registry app/[locale]/** also reads from). AZ is the source value; EN/RU
// are optional overrides that fall back to AZ when left blank
// (resolveSiteText(), same chain as products.translations).
//
// One Card per page section, one Save button per Card (not one giant
// all-46-keys form) — a SuperAdmin editing the FAQ page's hero copy
// shouldn't have to review/re-submit the home page's 25 keys to do it.
import React, { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { upsertSiteContent, SITE_CONTENT_GROUPS } from '@/lib/services/siteContentService';
import { publishSiteContent } from '@/lib/site-content/publish';
import { Card, CardHeader, CardBody, Field, Input, Textarea, Button, Tag } from '@/components/kit';
import { useToast } from './Toast';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

// Long-form fields get a 2-row Textarea; everything else (eyebrows, CTA
// button labels) is a single-line Input.
const isLongField = (key) => key.endsWith('.subtitle') || key.endsWith('.note');

// 'home.hero.cta_primary' -> 'Hero Cta Primary' — drops the page prefix
// (redundant with the section heading this renders under) and title-cases
// the rest. Internal admin-tool labeling, not customer-facing copy, so this
// mechanical derivation is good enough without a second labels registry to
// keep in sync.
const humanizeKey = (key) =>
  key.split('.').slice(1).join(' ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const SECTION_TITLE_KEYS = {
  home: 'siteSectionHome',
  features: 'siteSectionFeatures',
  faq: 'siteSectionFaqPage',
  demo: 'siteSectionDemo',
  contact: 'siteSectionContactPage',
  pricing: 'siteSectionPricing',
};

function rowsToDraft(rows) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const draft = {};
  for (const group of Object.values(SITE_CONTENT_GROUPS)) {
    for (const key of group) {
      const row = byKey.get(key);
      draft[key] = {
        valueAz: row?.value_az || '',
        en: row?.translations?.en || '',
        ru: row?.translations?.ru || '',
      };
    }
  }
  return draft;
}

function SectionCard({ groupKey, keys, draft, committed, onFieldChange, onSave, saving }) {
  const { t } = useSuperAdminTranslation();
  const isDirty = keys.some((key) => {
    const d = draft[key];
    const c = committed[key];
    return d.valueAz !== c.valueAz || d.en !== c.en || d.ru !== c.ru;
  });

  return (
    <Card variant="plain">
      <CardHeader
        title={t(SECTION_TITLE_KEYS[groupKey])}
        actions={
          <div className="flex items-center gap-2.5">
            {isDirty && <Tag tone="warning" size="sm">{t('siteUnsavedChangesHint')}</Tag>}
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!isDirty}
              icon={<Save className="w-3.5 h-3.5" />}
              onClick={() => onSave(groupKey, keys)}
            >
              {t('saveButton')}
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-5">
        {keys.map((key) => {
          const FieldControl = isLongField(key) ? Textarea : Input;
          return (
            <div key={key} className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <Field label={`${humanizeKey(key)} — ${t('siteFieldAz')}`}>
                {(id, a11y) => (
                  <FieldControl
                    id={id} {...a11y}
                    value={draft[key].valueAz}
                    onChange={(e) => onFieldChange(key, 'valueAz', e.target.value)}
                    rows={isLongField(key) ? 2 : undefined}
                  />
                )}
              </Field>
              <Field label={t('siteFieldEn')}>
                {(id, a11y) => (
                  <FieldControl
                    id={id} {...a11y}
                    value={draft[key].en}
                    onChange={(e) => onFieldChange(key, 'en', e.target.value)}
                    rows={isLongField(key) ? 2 : undefined}
                  />
                )}
              </Field>
              <Field label={t('siteFieldRu')}>
                {(id, a11y) => (
                  <FieldControl
                    id={id} {...a11y}
                    value={draft[key].ru}
                    onChange={(e) => onFieldChange(key, 'ru', e.target.value)}
                    rows={isLongField(key) ? 2 : undefined}
                  />
                )}
              </Field>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

export function SitePagesTab({ content, loading, refresh }) {
  const { t } = useSuperAdminTranslation();
  const notify = useToast();

  // `content` starts empty ([]) until SuperAdminApp.jsx's refreshSiteContent()
  // resolves. `draft` (what the admin is editing) and `committed` (the
  // per-key baseline each Card's dirty-check compares against) both need to
  // pick up the real values once they arrive, but only ONCE — a save in the
  // "home" Card triggers a parent refetch that must not stomp in-progress
  // edits sitting in the "features" Card below it. This is React's own
  // documented "adjust state when a prop changes" pattern (a conditional
  // setState call during the render body, gated so it fires exactly once on
  // the loading->loaded transition), not a useEffect+ref pair — see
  // react.dev/learn/you-might-not-need-an-effect. After that one-time
  // hydration, `committed` is advanced locally inside handleSave() below,
  // never again from the `content` prop.
  const initial = useMemo(() => rowsToDraft(content), [content]);
  const [draft, setDraft] = useState(initial);
  const [committed, setCommitted] = useState(initial);
  const [hasHydrated, setHasHydrated] = useState(false);
  if (!hasHydrated && !loading && content.length > 0) {
    setHasHydrated(true);
    setDraft(initial);
    setCommitted(initial);
  }

  const [savingGroup, setSavingGroup] = useState(null);

  const handleFieldChange = (key, field, value) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = async (groupKey, keys) => {
    setSavingGroup(groupKey);
    const changed = keys.filter((key) => {
      const d = draft[key];
      const c = committed[key];
      return d.valueAz !== c.valueAz || d.en !== c.en || d.ru !== c.ru;
    });

    for (const key of changed) {
      const d = draft[key];
      const { error } = await upsertSiteContent({
        key,
        valueAz: d.valueAz,
        translations: { en: d.en, ru: d.ru },
      });
      if (error) {
        notify(t('saveFailedToast')(error.message), 'error');
        setSavingGroup(null);
        return;
      }
    }

    await publishSiteContent();
    // Advance the dirty-check baseline for exactly the keys just saved,
    // locally — NOT by waiting for the parent's `content` prop to refetch
    // and flow back down (that path is deliberately one-shot, see the
    // hydration gate above). refresh() below still runs, so
    // SiteContactTab.jsx (which shares the same `content` array for the
    // contact.* keys) sees the update too.
    setCommitted((prev) => {
      const next = { ...prev };
      for (const key of changed) next[key] = draft[key];
      return next;
    });
    setSavingGroup(null);
    notify(t('siteContentSavedToast'));
    refresh();
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <p className="text-[13px] text-[var(--k-text-3)]">{t('loadingText')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-[var(--k-text-3)]">{t('sitePagesSubtitle')}</p>
      {Object.entries(SITE_CONTENT_GROUPS).map(([groupKey, keys]) => (
        <SectionCard
          key={groupKey}
          groupKey={groupKey}
          keys={keys}
          draft={draft}
          committed={committed}
          onFieldChange={handleFieldChange}
          onSave={handleSave}
          saving={savingGroup === groupKey}
        />
      ))}
    </div>
  );
}

export default SitePagesTab;
