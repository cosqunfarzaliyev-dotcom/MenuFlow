"use client";

// FAQ management (Phase 4) — add/edit/delete/reorder over `site_faq_items`
// (supabase/migrations/0032_site_content_cms.sql), rendered on the public
// /faq page in `sort_order` (published rows only — see app/[locale]/faq/
// page.jsx). Reorder is ▲/▼ buttons swapping a row with its neighbor, not
// drag-and-drop — no new dependency, same reasoning the FAQ accordion
// itself already documents (app/[locale]/faq/page.jsx's header comment).
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, HelpCircle } from 'lucide-react';
import {
  createFaqItem, updateFaqItem, deleteFaqItem, reorderFaqItems,
} from '@/lib/services/siteContentService';
import { publishSiteContent } from '@/lib/site-content/publish';
import {
  Card, CardBody, Field, Input, Textarea, Switch, Button, Tag, EmptyState,
  Sheet, SheetHeader, SheetFooter, ConfirmDialog, useConfirmDialog,
} from '@/components/kit';
import { useToast } from './Toast';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

const EMPTY_FORM = { questionAz: '', answerAz: '', questionEn: '', answerEn: '', questionRu: '', answerRu: '', isPublished: true };

function rowToForm(row) {
  if (!row) return EMPTY_FORM;
  return {
    questionAz: row.question_az || '',
    answerAz: row.answer_az || '',
    questionEn: row.translations?.en?.question || '',
    answerEn: row.translations?.en?.answer || '',
    questionRu: row.translations?.ru?.question || '',
    answerRu: row.translations?.ru?.answer || '',
    isPublished: row.is_published !== false,
  };
}

function FaqSheet({ item, onClose, onSave }) {
  const { t } = useSuperAdminTranslation();
  const isEdit = Boolean(item);
  const [form, setForm] = useState(() => rowToForm(item));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.questionAz.trim() || !form.answerAz.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Sheet isOpen onClose={onClose} side="right" size="lg" ariaLabel={isEdit ? t('editFaqModalTitle') : t('newFaqModalTitle')}>
      <SheetHeader title={isEdit ? t('editFaqModalTitle') : t('newFaqModalTitle')} onClose={onClose} />
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <Field label={t('questionAzFieldLabel')} required>
            {(id, a11y) => (
              <Input id={id} {...a11y} value={form.questionAz} onChange={(e) => setForm({ ...form, questionAz: e.target.value })} required />
            )}
          </Field>
          <Field label={t('answerAzFieldLabel')} required>
            {(id, a11y) => (
              <Textarea id={id} {...a11y} rows={3} value={form.answerAz} onChange={(e) => setForm({ ...form, answerAz: e.target.value })} required />
            )}
          </Field>

          <Field label={t('questionEnFieldLabel')}>
            {(id, a11y) => (
              <Input id={id} {...a11y} value={form.questionEn} onChange={(e) => setForm({ ...form, questionEn: e.target.value })} />
            )}
          </Field>
          <Field label={t('answerEnFieldLabel')}>
            {(id, a11y) => (
              <Textarea id={id} {...a11y} rows={3} value={form.answerEn} onChange={(e) => setForm({ ...form, answerEn: e.target.value })} />
            )}
          </Field>

          <Field label={t('questionRuFieldLabel')}>
            {(id, a11y) => (
              <Input id={id} {...a11y} value={form.questionRu} onChange={(e) => setForm({ ...form, questionRu: e.target.value })} />
            )}
          </Field>
          <Field label={t('answerRuFieldLabel')}>
            {(id, a11y) => (
              <Textarea id={id} {...a11y} rows={3} value={form.answerRu} onChange={(e) => setForm({ ...form, answerRu: e.target.value })} />
            )}
          </Field>

          <Switch
            checked={form.isPublished}
            onChange={(next) => setForm({ ...form, isPublished: next })}
            label={<span className="text-xs font-medium">{t('publishedFieldLabel')}</span>}
          />
        </div>

        <SheetFooter className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            {t('cancelButton')}
          </Button>
          <Button type="submit" variant="primary" loading={saving} className="flex-1">
            {t('saveButton')}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}

export function SiteFaqTab({ items, loading, refresh }) {
  const { t } = useSuperAdminTranslation();
  const notify = useToast();
  const confirmDialog = useConfirmDialog();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [reordering, setReordering] = useState(false);

  const toRow = (form) => ({
    questionAz: form.questionAz.trim(),
    answerAz: form.answerAz.trim(),
    translations: {
      en: { question: form.questionEn.trim(), answer: form.answerEn.trim() },
      ru: { question: form.questionRu.trim(), answer: form.answerRu.trim() },
    },
    isPublished: form.isPublished,
  });

  const handleSave = async (form) => {
    const { error } = editingItem
      ? await updateFaqItem({ id: editingItem.id, ...toRow(form) })
      : await createFaqItem(toRow(form));
    if (error) {
      notify(t('saveFailedToast')(error.message), 'error');
      return;
    }
    await publishSiteContent();
    setIsCreateOpen(false);
    setEditingItem(null);
    notify(editingItem ? t('faqUpdatedToast') : t('faqCreatedToast'));
    refresh();
  };

  const handleDelete = (item) => {
    confirmDialog.confirm({
      title: t('deleteFaqConfirmTitle'),
      message: t('deleteFaqConfirmMessage')(item.question_az),
      onConfirm: async () => {
        const { error } = await deleteFaqItem(item.id);
        if (error) {
          notify(t('deleteFailedToast'), 'error');
          return;
        }
        await publishSiteContent();
        notify(t('faqDeletedToast'));
        refresh();
      },
    });
  };

  const handleMove = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setReordering(true);
    const { error } = await reorderFaqItems(reordered.map((row) => row.id));
    setReordering(false);
    if (error) {
      notify(t('saveFailedToast')(error.message), 'error');
      return;
    }
    await publishSiteContent();
    notify(t('faqReorderedToast'));
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[var(--k-text-3)]">{t('siteFaqSubtitle')}</p>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)} className="shrink-0" icon={<Plus className="w-4 h-4" />}>
          {t('newFaqButton')}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<HelpCircle className="w-5 h-5" />} title={t('noFaqItemsYet')} description="" />
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <Card key={item.id} variant="plain">
              <CardBody className="flex items-start gap-3 py-4">
                <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0 || reordering}
                    aria-label={t('moveUpAriaLabel')}
                    className="rounded-[var(--k-r-sm)] p-1 text-[var(--k-text-3)] hover:bg-[var(--k-surface-2)] hover:text-[var(--k-text)] disabled:opacity-30"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === items.length - 1 || reordering}
                    aria-label={t('moveDownAriaLabel')}
                    className="rounded-[var(--k-r-sm)] p-1 text-[var(--k-text-3)] hover:bg-[var(--k-surface-2)] hover:text-[var(--k-text)] disabled:opacity-30"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[var(--k-text)] font-semibold text-sm">{item.question_az}</h3>
                    <Tag tone={item.is_published ? 'success' : 'neutral'} size="sm">
                      {item.is_published ? t('publishedLabel') : t('draftLabel')}
                    </Tag>
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--k-text-3)] line-clamp-2">{item.answer_az}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="p-2 rounded-[var(--k-r-sm)] hover:bg-[var(--k-surface-2)] text-[var(--k-text-3)] hover:text-[var(--k-text)]"
                    title={t('editTitle')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-2 rounded-[var(--k-r-sm)] hover:bg-[var(--k-danger-soft)] text-[var(--k-text-3)] hover:text-[var(--k-danger)]"
                    title={t('deleteTitle')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {isCreateOpen && <FaqSheet onClose={() => setIsCreateOpen(false)} onSave={handleSave} />}
      {editingItem && <FaqSheet item={editingItem} onClose={() => setEditingItem(null)} onSave={handleSave} />}
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}

export default SiteFaqTab;
