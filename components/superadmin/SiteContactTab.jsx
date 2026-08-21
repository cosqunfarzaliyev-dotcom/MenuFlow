"use client";

// Contact-details management (Phase 4) — the three CONTACT_DETAIL_KEYS rows
// in `site_content` (lib/services/siteContentService.js), edited from their
// own dedicated form rather than folded into SitePagesTab.jsx's generic
// page-copy grid: these three have real shape validation (a wa.me link, an
// email address) that free-text page copy doesn't.
import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { upsertSiteContent, CONTACT_DETAIL_KEYS } from '@/lib/services/siteContentService';
import { publishSiteContent } from '@/lib/site-content/publish';
import { Card, CardBody, Field, Input, Button } from '@/components/kit';
import { useToast } from './Toast';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

const WHATSAPP_RE = /^https:\/\/wa\.me\/\d+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_RE = /^https:\/\/(www\.)?instagram\.com\/.+$/;

const rowsToForm = (content) => {
  const byKey = new Map(content.map((r) => [r.key, r]));
  return {
    'contact.whatsapp_url': byKey.get('contact.whatsapp_url')?.value_az || '',
    'contact.email': byKey.get('contact.email')?.value_az || '',
    'contact.address': byKey.get('contact.address')?.value_az || '',
    'contact.instagram_url': byKey.get('contact.instagram_url')?.value_az || '',
  };
};

export function SiteContactTab({ content, loading, refresh }) {
  const { t } = useSuperAdminTranslation();
  const notify = useToast();
  const [form, setForm] = useState(() => rowsToForm(content));
  const [saving, setSaving] = useState(false);
  // `content` starts empty ([]) until SuperAdminApp.jsx's refreshSiteContent()
  // resolves, so the form must pick up the real values once they arrive —
  // but only ONCE, not on every subsequent refetch (a post-save refresh must
  // not stomp whatever the admin is mid-typing). This is React's own
  // documented "adjust state when a prop changes" pattern (a conditional
  // setState call during the render body, gated so it fires exactly once),
  // not a useEffect — see react.dev/learn/you-might-not-need-an-effect.
  const [hasHydrated, setHasHydrated] = useState(false);
  if (!hasHydrated && !loading && content.length > 0) {
    setHasHydrated(true);
    setForm(rowsToForm(content));
  }

  const whatsappInvalid = form['contact.whatsapp_url'] !== '' && !WHATSAPP_RE.test(form['contact.whatsapp_url']);
  const emailInvalid = form['contact.email'] !== '' && !EMAIL_RE.test(form['contact.email']);
  const instagramInvalid = form['contact.instagram_url'] !== '' && !INSTAGRAM_RE.test(form['contact.instagram_url']);

  const handleSave = async (e) => {
    e.preventDefault();
    if (whatsappInvalid || emailInvalid || instagramInvalid) return;
    setSaving(true);
    for (const key of CONTACT_DETAIL_KEYS) {
      const { error } = await upsertSiteContent({ key, valueAz: form[key], translations: {} });
      if (error) {
        notify(t('saveFailedToast')(error.message), 'error');
        setSaving(false);
        return;
      }
    }
    await publishSiteContent();
    setSaving(false);
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
    <Card variant="plain">
      <CardBody>
        <p className="mb-5 text-[13px] text-[var(--k-text-3)]">{t('siteContactSubtitle')}</p>
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <Field label={t('siteWhatsappUrlLabel')} hint={t('siteWhatsappUrlHint')}>
            {(id, a11y) => (
              <Input
                id={id} {...a11y}
                type="url"
                value={form['contact.whatsapp_url']}
                onChange={(e) => setForm({ ...form, 'contact.whatsapp_url': e.target.value })}
                invalid={whatsappInvalid}
                placeholder="https://wa.me/994000000000"
              />
            )}
          </Field>
          {whatsappInvalid && <p className="text-[12px] text-[var(--k-danger)] -mt-2.5">{t('siteWhatsappUrlInvalid')}</p>}

          <Field label={t('siteEmailLabel')}>
            {(id, a11y) => (
              <Input
                id={id} {...a11y}
                type="email"
                value={form['contact.email']}
                onChange={(e) => setForm({ ...form, 'contact.email': e.target.value })}
                invalid={emailInvalid}
                placeholder="hello@menuflow.app"
              />
            )}
          </Field>
          {emailInvalid && <p className="text-[12px] text-[var(--k-danger)] -mt-2.5">{t('siteEmailInvalid')}</p>}

          <Field label={t('siteAddressLabel')}>
            {(id, a11y) => (
              <Input
                id={id} {...a11y}
                value={form['contact.address']}
                onChange={(e) => setForm({ ...form, 'contact.address': e.target.value })}
              />
            )}
          </Field>

          {/* Optional — left blank, the marketing footer/contact page both
              skip the Instagram card entirely rather than showing a dead
              link (see MarketingFooter.jsx / app/[locale]/contact/page.jsx). */}
          <Field label={t('siteInstagramUrlLabel')} hint={t('siteInstagramUrlHint')}>
            {(id, a11y) => (
              <Input
                id={id} {...a11y}
                type="url"
                value={form['contact.instagram_url']}
                onChange={(e) => setForm({ ...form, 'contact.instagram_url': e.target.value })}
                invalid={instagramInvalid}
                placeholder="https://instagram.com/menuflow"
              />
            )}
          </Field>
          {instagramInvalid && <p className="text-[12px] text-[var(--k-danger)] -mt-2.5">{t('siteInstagramUrlInvalid')}</p>}

          <Button type="submit" variant="primary" loading={saving} disabled={whatsappInvalid || emailInvalid || instagramInvalid} icon={<Save className="w-3.5 h-3.5" />}>
            {t('saveButton')}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default SiteContactTab;
