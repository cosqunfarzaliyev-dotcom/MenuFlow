"use client";

// SuperAdmin -> Bildirişlər: platforma elanları restoran sahiblərinə.
// Admin panelinin yuxarı sağındakı zəng ikonu bu cədvəli oxuyur (bax
// AdminApp.jsx-in NotificationsSheet-i). Struktur SiteFaqTab.jsx-in birbaşa
// təkrarıdır: kompoz forma + Sheet (bura Sheet YERİNƏ inline kart istifadə
// olunur, çünki forma səhifənin əsas məzmunudur, ikinci dərəcəli redaktə
// axını deyil) + siyahı + useToast + useConfirmDialog.
import React, { useMemo, useState } from 'react';
import { Megaphone, Edit2, Trash2, Send, FileEdit } from 'lucide-react';
import {
  createAnnouncement, updateAnnouncement, deleteAnnouncement,
  ANNOUNCEMENT_TEMPLATES, ANNOUNCEMENT_LEVELS,
} from '@/lib/services/announcementService';
import {
  Card, CardHeader, CardBody, Field, Input, Textarea, Select, Switch, Button, Tag,
  EmptyState, LoadingState, ConfirmDialog, useConfirmDialog,
} from '@/components/kit';
import { useToast } from './Toast';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

const EMPTY_FORM = { title: '', body: '', level: 'info', targetAll: true, targetIds: [] };

const rowToForm = (row) => ({
  title: row.title || '',
  body: row.body || '',
  level: ANNOUNCEMENT_LEVELS.includes(row.level) ? row.level : 'info',
  targetAll: !row.target_restaurant_ids?.length,
  targetIds: row.target_restaurant_ids?.map((id) => id.toString()) || [],
});

const LEVEL_TONE = { info: 'info', warning: 'warning', critical: 'danger' };

// `items`/`loading`/`refresh` come from SuperAdminApp, same shape SiteFaqTab
// already uses. The fetch/loading-flag effect lives THERE, not here — one
// shared mount effect already loads restaurants/users/plans/siteContent/faq,
// and folding announcements into it means this file never owns a "load on
// mount" effect of its own (see SuperAdminApp.jsx's refreshAnnouncements).
export function AnnouncementsTab({ restaurants, items, loading, refresh }) {
  const { t } = useSuperAdminTranslation();
  const notify = useToast();
  const confirmDialog = useConfirmDialog();

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const restaurantOptions = useMemo(
    () => (restaurants || []).map((r) => ({ id: r.id?.toString(), name: r.name })),
    [restaurants],
  );

  const applyTemplate = (key) => {
    const tpl = ANNOUNCEMENT_TEMPLATES.find((item) => item.key === key);
    if (!tpl) return;
    setForm((f) => ({ ...f, title: tpl.title, body: tpl.body, level: tpl.level }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setForm(rowToForm(row));
    setFormError(null);
  };

  // `publish`: true -> "Göndər" (is_published=true, published_at=now()),
  // false -> "Qaralama saxla" (is_published=false). Same form, same
  // validation, only the flag sent to the service differs — matches
  // PromotionsTab's create/edit-share-one-handler pattern.
  const handleSubmit = async (publish) => {
    if (!form.title.trim() || !form.body.trim()) {
      setFormError(t('announcementEmptyError'));
      return;
    }
    if (!form.targetAll && form.targetIds.length === 0) {
      setFormError(t('announcementNoTargetError'));
      return;
    }
    setFormError(null);
    setSaving(true);
    const payload = {
      title: form.title,
      body: form.body,
      level: form.level,
      targetRestaurantIds: form.targetAll ? [] : form.targetIds,
      isPublished: publish,
    };
    const { error } = editingId
      ? await updateAnnouncement(editingId, payload)
      : await createAnnouncement(payload);
    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    notify(publish ? t('announcementSentToast') : t('announcementSavedToast'));
    resetForm();
    refresh();
  };

  const handleDelete = (row) => {
    confirmDialog.confirm({
      title: t('deleteAnnouncementConfirmTitle'),
      message: t('deleteAnnouncementConfirmMessage')(row.title || ''),
      onConfirm: async () => {
        const { error } = await deleteAnnouncement(row.id);
        if (error) {
          notify(error.message, 'error');
          return;
        }
        notify(t('announcementDeletedToast'));
        if (editingId === row.id) resetForm();
        refresh();
      },
    });
  };

  const targetSummary = (row) =>
    row.target_restaurant_ids?.length
      ? t('announcementTargetSummaryCount')(row.target_restaurant_ids.length)
      : t('announcementTargetSummaryAll');

  return (
    <div className="space-y-6">
      <Card variant="plain">
        <CardHeader>
          <h2 className="font-semibold text-[var(--k-text)] flex items-center gap-2 text-sm">
            <Megaphone className="w-4 h-4 text-[var(--k-accent)]" />
            {t('tabAnnouncements')}
          </h2>
          <p className="text-xs text-[var(--k-text-3)] mt-1">{t('announcementsSubtitle')}</p>
        </CardHeader>
        <CardBody className="space-y-4">
          {formError && (
            <p className="text-xs font-medium text-[var(--k-danger)]">{formError}</p>
          )}

          <Field label={t('announcementTemplateLabel')}>
            {(id, a11y) => (
              <Select id={id} {...a11y} value="" onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">{t('announcementTemplateNone')}</option>
                {ANNOUNCEMENT_TEMPLATES.filter((tpl) => tpl.title).map((tpl) => (
                  <option key={tpl.key} value={tpl.key}>{tpl.title}</option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label={t('announcementTitleLabel')} className="sm:col-span-2">
              {(id, a11y) => (
                <Input
                  id={id} {...a11y} value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('announcementTitlePlaceholder')}
                />
              )}
            </Field>
            <Field label={t('announcementLevelLabel')}>
              {(id, a11y) => (
                <Select id={id} {...a11y} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  <option value="info">{t('announcementLevelInfo')}</option>
                  <option value="warning">{t('announcementLevelWarning')}</option>
                  <option value="critical">{t('announcementLevelCritical')}</option>
                </Select>
              )}
            </Field>
          </div>

          <Field label={t('announcementBodyLabel')}>
            {(id, a11y) => (
              <Textarea
                id={id} {...a11y} rows={4} value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder={t('announcementBodyPlaceholder')}
              />
            )}
          </Field>

          <Switch
            checked={form.targetAll}
            onChange={(next) => setForm({ ...form, targetAll: next, targetIds: next ? [] : form.targetIds })}
            label={t('announcementTargetAllLabel')}
            description={t('announcementTargetAllHint')}
          />

          {!form.targetAll && (
            <Field label={t('announcementTargetPickLabel')}>
              {(id) => (
                <div id={id} className="max-h-48 overflow-y-auto space-y-1.5 rounded-[var(--k-r)] border border-[var(--k-border)] p-3 bg-[var(--k-surface-2)]">
                  {restaurantOptions.length === 0 ? (
                    <p className="text-xs text-[var(--k-text-3)]">—</p>
                  ) : (
                    restaurantOptions.map((r) => {
                      const checked = form.targetIds.includes(r.id);
                      return (
                        <label key={r.id} className="flex items-center gap-2.5 text-sm text-[var(--k-text)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.targetIds, r.id]
                                : form.targetIds.filter((tid) => tid !== r.id);
                              setForm({ ...form, targetIds: next });
                            }}
                            className="accent-[var(--k-accent)]"
                          />
                          {r.name}
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </Field>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="primary" loading={saving} className="flex-1" icon={<Send className="w-4 h-4" />} onClick={() => handleSubmit(true)}>
              {t('announcementSendButton')}
            </Button>
            <Button variant="secondary" disabled={saving} icon={<FileEdit className="w-4 h-4" />} onClick={() => handleSubmit(false)}>
              {t('announcementDraftButton')}
            </Button>
            {editingId && (
              <Button variant="ghost" disabled={saving} onClick={resetForm}>
                {t('cancelEditAnnouncement')}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Card variant="plain">
        <CardBody className="space-y-3">
          {loading ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <EmptyState icon={<Megaphone className="w-5 h-5" />} title={t('noAnnouncementsYet')} description="" />
          ) : (
            items.map((row) => (
              <div
                key={row.id}
                className={`flex items-start justify-between gap-3 p-4 rounded-[var(--k-r-lg)] bg-[var(--k-surface-2)] border ${editingId === row.id ? 'border-[var(--k-accent)]/60' : 'border-[var(--k-border)]'}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--k-text)] truncate">{row.title}</p>
                    <Tag tone={LEVEL_TONE[row.level] || 'neutral'} size="sm">
                      {t(`announcementLevel${row.level.charAt(0).toUpperCase()}${row.level.slice(1)}`)}
                    </Tag>
                    <Tag tone={row.is_published ? 'success' : 'neutral'} size="sm">
                      {row.is_published ? t('announcementSentBadge') : t('announcementDraftBadge')}
                    </Tag>
                  </div>
                  <p className="text-xs text-[var(--k-text-3)] mt-1 line-clamp-2">{row.body}</p>
                  <p className="text-[11px] text-[var(--k-text-3)] mt-1">{targetSummary(row)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleEdit(row)}
                    aria-label={t('editAnnouncementAriaLabel')(row.title)}
                    className="p-2 rounded-[var(--k-r-sm)] bg-[var(--k-surface-3)] text-[var(--k-text-2)] hover:text-[var(--k-text)] transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(row)}
                    aria-label={t('deleteAnnouncementAriaLabel')(row.title)}
                    className="p-2 rounded-[var(--k-r-sm)] bg-[var(--k-danger-soft)] text-[var(--k-danger)] hover:opacity-80 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}

export default AnnouncementsTab;
