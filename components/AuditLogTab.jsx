"use client";

import React, { useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAdminTranslation, LOCALE_TAGS } from "@/lib/i18n/dictionaries/admin";
import {
  PageHeader, Card, Tag, EmptyState,
  Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell,
} from "@/components/kit";

const formatWhen = (iso, localeTag) => {
  try {
    return new Date(iso).toLocaleString(localeTag, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

// audit_logs.action is always "<entityType>.<verb>" (see
// lib/services/promotionsService.js's logAuditEvent) — e.g. 'product.create',
// 'discount.delete'. The verb is the part the Badge cares about; anything
// that isn't create/update/delete (e.g. the one-off
// 'restaurant.onboarding_complete') falls back to a neutral "Other" tone
// rather than guessing at a color for a verb this table doesn't know about.
const ACTION_BADGE = {
  create: 'success',
  update: 'info',
  delete: 'danger',
};

const actionVerb = (action) => (action || '').split('.').pop();

// Audit Log: Kim / Nə vaxt / Nəyi dəyişib — hər admin əməliyyatından
// (məhsul, endirim, banner, dizayn dəyişikliyi) sonra avtomatik
// qeyd olunur (bax: lib/store.js -> recordAudit).
export function AuditLogTab() {
  const { t, language } = useAdminTranslation();
  const { auditLogs, loadAuditLogs } = useAppStore();

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('titleAudit')} description={t('auditSubtitle')} />

      {auditLogs.length === 0 ? (
        <EmptyState icon={<ClipboardList className="w-5 h-5" />} title={t('auditEmptyText')} description={t('auditNotFoundDescription')} />
      ) : (
        <Card variant="plain" className="overflow-hidden">
          <Table>
            <TableHead>
              <TableHeaderCell>{t('auditColWho')}</TableHeaderCell>
              <TableHeaderCell>{t('auditColWhen')}</TableHeaderCell>
              <TableHeaderCell>{t('auditColAction')}</TableHeaderCell>
              <TableHeaderCell>{t('auditColWhat')}</TableHeaderCell>
            </TableHead>
            <TableBody>
              {auditLogs.map((log) => {
                const verb = actionVerb(log.action);
                const badgeText = { create: t('auditActionCreate'), update: t('auditActionUpdate'), delete: t('auditActionDelete') }[verb] || t('auditActionOther');
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-[var(--k-text-2)] whitespace-nowrap">{log.actor_email || t('auditUnknownActor')}</TableCell>
                    <TableCell className="text-[var(--k-text-3)] whitespace-nowrap">{formatWhen(log.created_at, LOCALE_TAGS[language] || 'az-AZ')}</TableCell>
                    <TableCell>
                      <Tag tone={ACTION_BADGE[verb] || 'neutral'}>{badgeText}</Tag>
                    </TableCell>
                    <TableCell className="text-[var(--k-text)]">{log.summary || log.action}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

export default AuditLogTab;
