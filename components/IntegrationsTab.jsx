"use client";

import React, { useEffect, useState } from "react";
import { Plug, CheckCircle2, RefreshCw, Unplug, PlugZap } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { FEATURES } from "@/lib/services/entitlementService";
import { useFeature } from "@/hooks/useEntitlement";
import { CAPABILITIES } from "@/lib/services/capabilityService";
import { useCapability } from "@/hooks/useCapability";
import { PageHeader, Card, CardHeader, CardBody, Button, Input, Field, Switch, Tag, Banner, ConfirmDialog, useConfirmDialog } from "@/components/kit";
import { useAdminTranslation } from "@/lib/i18n/dictionaries/admin";

// POS (kassa) inteqrasiyası — hazırda yalnız Poster POS (0026_pos_integration.
// sql). api_token client-ə heç vaxt geri oxunmur (write-only) — status
// yalnız has_token boolean-ı ilə "quraşdırılıb/yoxdur" göstərir. Formanın
// hər submit-i upsert_pos_credentials RPC-sini çağırır; apiToken boş
// buraxılarsa RPC-nin özü mövcud token-i saxlayır (bax: savePosCredentials
// service funksiyasının şərhi).
export function IntegrationsTab() {
  const { t } = useAdminTranslation();
  const { posIntegration, loadPosIntegration, savePosIntegration, disconnectPosIntegrationAction, syncPosMenu, testPosConnection } = useAppStore();
  const posIntegrationEnabled = useFeature(FEATURES.POS_INTEGRATION);
  // Formal capability layer — role-level check, distinct from the
  // plan/entitlement check above. AdminApp.jsx already gates rendering this
  // component on CAPABILITIES.INTEGRATIONS, so this is defensive-only, same
  // reasoning DesignTab.jsx's own capability checks document.
  const canManageIntegrations = useCapability(CAPABILITIES.INTEGRATIONS);
  const confirmDialog = useConfirmDialog();

  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [syncMenuEnabled, setSyncMenuEnabled] = useState(true);
  const [syncOrdersEnabled, setSyncOrdersEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState(null);
  // "Now", refreshed on a 30s tick, so the "pending too long?" check below
  // advances even if nothing else changes posIntegration in the meantime.
  // Read as state (not Date.now() called inline during render) — calling an
  // impure function during render is a react-hooks/purity violation, and
  // CLAUDE.md's lint baseline doesn't budget for adding a second one.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (posIntegrationEnabled) loadPosIntegration();
  }, [posIntegrationEnabled, loadPosIntegration]);

  // posIntegration yükləndikdə formanı onunla doldur — apiToken İSTİSNA
  // (heç vaxt server-dən gəlmir, həmişə boş başlayır). loadPosIntegration()
  // özü asinxron olsa da, bu effect nəticəni (artıq store-da olan
  // posIntegration) sadəcə yerli state-ə güzgüləyir — CustomerApp.jsx-in
  // sessionStorage-dan səbət bərpası ilə eyni "sinxron güzgüləmə" forması,
  // ona görə eyni qəbul edilmiş eslint-disable.
  useEffect(() => {
    if (!posIntegration) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccountIdentifier(posIntegration.account_identifier || '');
    setSyncMenuEnabled(posIntegration.sync_menu_enabled);
    setSyncOrdersEnabled(posIntegration.sync_orders_enabled);
  }, [posIntegration]);

  if (!posIntegrationEnabled) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <PageHeader title={t('titleIntegrations')} />
        <Card variant="plain">
          <CardBody className="text-center py-10">
            <Plug className="w-8 h-8 text-[var(--k-text-3)] mx-auto mb-3" />
            <h3 className="text-base font-semibold text-[var(--k-text)] mb-1">{t('integrationsUpsellTitle')}</h3>
            <p className="text-sm text-[var(--k-text-3)] max-w-sm mx-auto">{t('integrationsUpsellBody')}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSavedMessage(false);
    const { error } = await savePosIntegration({
      accountIdentifier: accountIdentifier.trim(),
      apiToken: apiToken.trim(),
      syncMenuEnabled,
      syncOrdersEnabled,
    });
    setSaving(false);
    if (!error) {
      setApiToken(''); // write-only — heç vaxt formda saxlanmır
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3500);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage(null);
    const { result, error } = await syncPosMenu();
    setSyncing(false);
    if (!error && result) {
      setSyncMessage({ tone: 'success', text: t('integrationsSyncResultMessage')(result.categoriesUpserted, result.productsUpserted) });
    } else if (error) {
      setSyncMessage({ tone: 'danger', text: error.message });
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestMessage(null);
    const { result, error } = await testPosConnection();
    setTesting(false);
    if (!error && result) {
      setTestMessage({ tone: 'success', text: t('integrationsTestConnectionResultMessage')(result.categories, result.products) });
    } else if (error) {
      setTestMessage({ tone: 'danger', text: error.message });
    }
  };

  const handleDisconnect = () => {
    confirmDialog.confirm({
      title: t('integrationsDisconnectConfirmTitle'),
      message: t('integrationsDisconnectConfirmMessage'),
      onConfirm: () => {
        setApiToken('');
        setAccountIdentifier('');
        disconnectPosIntegrationAction();
      },
    });
  };

  const hasToken = Boolean(posIntegration?.has_token);
  const formDisabled = saving || !canManageIntegrations;

  // Menu sync only ever has 3 states — it's a synchronous request/response
  // (the admin clicks a button and waits), unlike order push below.
  const statusTag = (status, errorText) => {
    if (status === 'success') return <Tag tone="success">{t('integrationsStatusSuccess')}</Tag>;
    if (status === 'error') return <Tag tone="danger" title={errorText || undefined}>{t('integrationsStatusError')}</Tag>;
    return <Tag tone="neutral">{t('integrationsNeverSyncedLabel')}</Tag>;
  };

  // Order push is fired-and-forgotten by a DB trigger, so it needs a 5th
  // state: 'pending' means "sent, no reply yet" — and if that lingers past
  // PENDING_STALE_MS, it almost certainly means the Edge Function never
  // answered (most likely POS_ORDER_PUSH_SECRET isn't set — see
  // 0027_pos_order_push_observability.sql). Distinguishing "still waiting"
  // from "broken" from "turned off" is the whole point of this widened tag —
  // before it, all three read identically as "Heç vaxt".
  const PENDING_STALE_MS = 2 * 60 * 1000;
  const orderPushStatusTag = (status, errorText, syncEnabled, lastAttemptAt) => {
    if (!syncEnabled) return <Tag tone="neutral">{t('integrationsOrderPushDisabledLabel')}</Tag>;
    if (status === 'pending') {
      const ageMs = lastAttemptAt ? now - new Date(lastAttemptAt).getTime() : 0;
      if (ageMs < PENDING_STALE_MS) return <Tag tone="info">{t('integrationsStatusPending')}</Tag>;
      return <Tag tone="warning" title={t('integrationsStatusStaleHint')}>{t('integrationsStatusStale')}</Tag>;
    }
    if (status === 'success') return <Tag tone="success">{t('integrationsStatusSuccess')}</Tag>;
    if (status === 'error') return <Tag tone="danger" title={errorText || undefined}>{t('integrationsStatusError')}</Tag>;
    return <Tag tone="neutral">{t('integrationsNeverSyncedLabel')}</Tag>;
  };

  const formatSyncedAt = (iso) =>
    iso ? `${t('integrationsLastSyncedLabel')} ${new Date(iso).toLocaleString()}` : t('integrationsNeverSyncedLabel');

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <PageHeader title={t('titleIntegrations')} />

      {savedMessage && (
        <Banner tone="success" icon={<CheckCircle2 className="w-4 h-4 shrink-0" />} className="font-medium">
          {t('integrationsSavedMessage')}
        </Banner>
      )}

      <Card variant="plain">
        <CardHeader
          title={t('integrationsPosterTitle')}
          description={t('integrationsPosterDescription')}
          actions={<Tag tone={hasToken ? 'success' : 'neutral'}>{hasToken ? t('integrationsConnectedLabel') : t('integrationsNotConnectedLabel')}</Tag>}
        />
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset disabled={formDisabled} className="space-y-5 disabled:opacity-50">
              <Field label={t('integrationsAccountIdentifierLabel')}>
                {(id, a11y) => (
                  <Input
                    id={id} type="text" value={accountIdentifier}
                    onChange={(e) => setAccountIdentifier(e.target.value)}
                    placeholder={t('integrationsAccountIdentifierPlaceholder')} {...a11y}
                  />
                )}
              </Field>

              <Field label={t('integrationsApiTokenLabel')} hint={hasToken ? t('integrationsApiTokenConnectedHint') : undefined}>
                {(id, a11y) => (
                  <Input
                    id={id} type="password" value={apiToken} autoComplete="off"
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder={hasToken ? '••••••••' : t('integrationsApiTokenPlaceholder')} {...a11y}
                  />
                )}
              </Field>

              <Switch
                checked={syncMenuEnabled}
                onChange={setSyncMenuEnabled}
                label={t('integrationsSyncMenuLabel')}
                description={t('integrationsSyncMenuDescription')}
              />
              <Switch
                checked={syncOrdersEnabled}
                onChange={setSyncOrdersEnabled}
                label={t('integrationsSyncOrdersLabel')}
                description={t('integrationsSyncOrdersDescription')}
              />

              <Button type="submit" variant="primary" size="block" loading={saving}>
                {t('integrationsSaveButton')}
              </Button>
            </fieldset>
          </form>
        </CardBody>
      </Card>

      {hasToken && (
        <Card variant="plain">
          <CardHeader title={t('integrationsStatusSectionTitle')} />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--k-text-3)]">{t('integrationsMenuSyncStatusLabel')}</span>
              <div className="flex items-center gap-2">
                {statusTag(posIntegration?.menu_sync_status, posIntegration?.menu_sync_error)}
                <span className="text-xs text-[var(--k-text-3)]">{formatSyncedAt(posIntegration?.menu_synced_at)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--k-text-3)]">{t('integrationsOrderPushStatusLabel')}</span>
              <div className="flex items-center gap-2">
                {orderPushStatusTag(
                  posIntegration?.order_push_status,
                  posIntegration?.order_push_error,
                  posIntegration?.sync_orders_enabled,
                  posIntegration?.order_push_last_attempt_at,
                )}
                <span className="text-xs text-[var(--k-text-3)]">{formatSyncedAt(posIntegration?.order_push_synced_at)}</span>
              </div>
            </div>

            {syncMessage && (
              <Banner tone={syncMessage.tone} className="text-xs font-medium">{syncMessage.text}</Banner>
            )}
            {testMessage && (
              <Banner tone={testMessage.tone} className="text-xs font-medium">{testMessage.text}</Banner>
            )}

            <Button
              type="button" variant="secondary" size="block" loading={testing}
              disabled={!canManageIntegrations}
              onClick={handleTestConnection}
              icon={<PlugZap className="w-4 h-4" />}
            >
              {testing ? t('integrationsTestingConnectionLabel') : t('integrationsTestConnectionButton')}
            </Button>

            <Button
              type="button" variant="secondary" size="block" loading={syncing}
              disabled={!canManageIntegrations || !syncMenuEnabled}
              onClick={handleSyncNow}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              {syncing ? t('integrationsSyncingLabel') : t('integrationsSyncNowButton')}
            </Button>

            <Button
              type="button" variant="danger" size="block"
              disabled={!canManageIntegrations}
              onClick={handleDisconnect}
              icon={<Unplug className="w-4 h-4" />}
            >
              {t('integrationsDisconnectButton')}
            </Button>
          </CardBody>
        </Card>
      )}

      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}
