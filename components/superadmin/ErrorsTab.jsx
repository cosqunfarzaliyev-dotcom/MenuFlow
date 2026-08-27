"use client";

// ---------------------------------------------------------------------------
// SuperAdmin -> Xətalar. Reads client_errors (0047_client_error_log.sql).
//
// Deliberately read-and-clear only: there is nothing to configure here. Its
// whole job is answering "is anything broken right now, and where" — which
// before this table existed had no answer at all, because a JS error in a
// customer's browser reached nobody.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Monitor } from 'lucide-react';
import { fetchClientErrors, deleteClientErrors } from '@/lib/services/errorService';
import { formatRelativeTime, LOCALE_TAGS } from './constants';
import { useToast } from './Toast';
import { Button, Tag, EmptyState, ConfirmDialog, useConfirmDialog } from '@/components/kit';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

// One tone per surface so a cluster in a single panel is visible at a glance
// without reading a single message.
const SURFACE_TONES = {
  customer: 'accent',
  admin: 'warning',
  staff: 'success',
  superadmin: 'danger',
  marketing: 'neutral',
};

export function ErrorsTab() {
  const { t, language } = useSuperAdminTranslation();
  const localeTag = LOCALE_TAGS[language] || 'az-AZ';
  const notify = useToast();
  const confirmDialog = useConfirmDialog();
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  // No setLoading(true) here, and the setState calls live inside .then rather
  // than the effect body: `loading` already starts true above, and this tab
  // fully unmounts when the super admin switches tabs (it is gated behind
  // `activeTab === 'errors'` in SuperAdminApp), so every mount starts from a
  // clean loading state without a synchronous setState inside the effect
  // (react-hooks/set-state-in-effect). Exactly the idiom AdminApp's UsersTab
  // records for the same reason.
  useEffect(() => {
    let cancelled = false;
    fetchClientErrors({ limit: 100 }).then((rows) => {
      if (cancelled) return;
      setErrors(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Event handlers, not effects — free to set state directly.
  const load = async () => setErrors(await fetchClientErrors({ limit: 100 }));

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleClear = () => {
    confirmDialog.confirm({
      title: t('clearErrorsConfirmTitle'),
      message: t('clearErrorsConfirmMessage')(errors.length),
      onConfirm: async () => {
        setClearing(true);
        const { error } = await deleteClientErrors(errors.map((e) => e.id));
        setClearing(false);
        if (error) {
          notify(t('updateFailedToast')(error.message), 'error');
          return;
        }
        notify(t('errorsClearedToast'));
        load();
      },
    });
  };

  if (loading) {
    return <div className="py-16 text-center"><p className="text-[13px] text-[var(--k-text-3)]">{t('loadingText')}</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--k-text-3)]">{t('errorCountSuffix')(errors.length)}</p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" onClick={handleRefresh} loading={refreshing} icon={<RefreshCw className="w-4 h-4" />}>
            {t('refreshButton')}
          </Button>
          {errors.length > 0 && (
            <Button variant="secondary" onClick={handleClear} loading={clearing} icon={<Trash2 className="w-4 h-4" />}>
              {t('clearErrorsButton')}
            </Button>
          )}
        </div>
      </div>

      {errors.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="w-5 h-5" />}
          title={t('noErrorsTitle')}
          description={t('noErrorsDescription')}
        />
      ) : (
        <div className="space-y-2">
          {errors.map((e) => (
            <div key={e.id} className="rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] p-4">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-sm font-medium text-[var(--k-text)] break-words">{e.message}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <Tag tone={SURFACE_TONES[e.surface] || 'neutral'}>{e.surface || '—'}</Tag>
                  <span className="text-[11px] text-[var(--k-text-3)] whitespace-nowrap">
                    {formatRelativeTime(e.created_at, t, localeTag)}
                  </span>
                </div>
              </div>
              {e.url && (
                <p className="text-[11px] text-[var(--k-text-3)] break-all flex items-start gap-1.5">
                  <Monitor className="w-3 h-3 mt-0.5 shrink-0" />
                  {e.url}
                </p>
              )}
              {/* Collapsed by default — a stack trace is what you open once you
                  have decided this row is the one worth chasing. */}
              {e.stack && (
                <details className="mt-2">
                  <summary className="text-[11px] font-medium text-[var(--k-accent)] cursor-pointer">
                    {t('stackTraceLabel')}
                  </summary>
                  <pre className="mt-1.5 text-[10px] leading-relaxed text-[var(--k-text-3)] whitespace-pre-wrap break-all max-h-56 overflow-y-auto">
                    {e.stack}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}

export default ErrorsTab;
