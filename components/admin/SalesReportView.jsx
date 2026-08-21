"use client";

// ---------------------------------------------------------------------------
// components/admin/SalesReportView.jsx
//
// Z/X sales report — shared by AdminApp.jsx's "Hesabat" tab (the signed-in
// admin's own restaurant) and SuperAdmin's per-restaurant drill-down
// (components/superadmin/RestaurantsTab.jsx). Deliberately a separate file
// from AdminApp.jsx rather than a local function there, since SuperAdmin
// needs the exact same view for an arbitrary restaurant's data.
//
// X report: "so far today" — locked to now, real-time mid-shift check.
// Z report: a specific full calendar day (defaults today, date is
// editable to reprint any past day) — the detailed closing document.
// Per the user's own scope decision, neither actually "closes"/locks
// anything server-side — both are just generated on demand from the same
// already-loaded `orders` array (no new query, no new RPC). Aggregation
// itself lives in lib/services/reportService.js so the math can't drift
// between the two report types or between this file and
// PaymentsManagement's existing numbers.
//
// Export = the browser's own print dialog (window.print() + a print-scoped
// CSS block), the same pattern AdminApp.jsx already uses for QR codes
// (~line 847-860) — no new PDF/CSV dependency.
// ---------------------------------------------------------------------------
import React, { useMemo, useState } from 'react';
import { Wallet, CreditCard, Smartphone, DollarSign, Clock, Ban, Receipt, Printer } from 'lucide-react';
import { Card, CardHeader, CardBody, PageHeader, Button, Tabs, TabsTrigger, Input, EmptyState } from '@/components/kit';
import { useAdminTranslation, LOCALE_TAGS } from '@/lib/i18n/dictionaries/admin';
import { buildSalesReport, getDayRange, getTodaySoFarRange } from '@/lib/services/reportService';

const toDateInputValue = (date) => {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

function ReportKpiCard({ label, value, icon, tint }) {
  return (
    <Card variant="plain">
      <CardBody className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-[var(--k-r)] flex items-center justify-center shrink-0 ${tint}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[var(--k-text-3)] text-[11px] font-medium uppercase tracking-wide mb-1 truncate">{label}</p>
          <h4 className="text-lg font-semibold text-[var(--k-text)] truncate">{value}</h4>
        </div>
      </CardBody>
    </Card>
  );
}

function PaymentMethodRow({ label, icon, tint, data, symbol }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-1">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-8 h-8 rounded-[var(--k-r)] flex items-center justify-center shrink-0 ${tint}`}>{icon}</span>
        <span className="text-sm text-[var(--k-text-2)] truncate">{label}</span>
      </div>
      <div className="flex items-center gap-4 text-sm shrink-0">
        <span className="text-[var(--k-text-3)]">{data.count}</span>
        <span className="k-nums font-semibold text-[var(--k-text)] min-w-[90px] text-right">{data.total.toFixed(2)} {symbol}</span>
      </div>
    </div>
  );
}

export function SalesReportView({ orders, tables, restaurantName, currencySymbol }) {
  const { t, language } = useAdminTranslation();
  const symbol = currencySymbol || '₼';
  const [reportType, setReportType] = useState('x'); // 'x' | 'z'
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));

  const { from, to } = useMemo(() => {
    if (reportType === 'x') return getTodaySoFarRange();
    // `selectedDate` is a plain yyyy-mm-dd from <input type="date">, parsed
    // as browser-local midnight — matches getDayRange's own local-day logic.
    return getDayRange(new Date(`${selectedDate}T00:00:00`));
  }, [reportType, selectedDate]);

  const report = useMemo(() => buildSalesReport({ orders, tables, from, to }), [orders, tables, from, to]);

  const periodLabel = reportType === 'x'
    ? `${from.toLocaleDateString(LOCALE_TAGS[language] || 'az-AZ')} · ${t('reportSoFarLabel')}`
    : from.toLocaleDateString(LOCALE_TAGS[language] || 'az-AZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-report-area, #print-report-area * { visibility: visible; }
          #print-report-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}} />

      <div className="print:hidden space-y-4">
        <Tabs>
          <TabsTrigger active={reportType === 'x'} onClick={() => setReportType('x')}>{t('xReportLabel')}</TabsTrigger>
          <TabsTrigger active={reportType === 'z'} onClick={() => setReportType('z')}>{t('zReportLabel')}</TabsTrigger>
        </Tabs>
        <p className="text-xs text-[var(--k-text-3)] max-w-xl">
          {reportType === 'x' ? t('xReportDescription') : t('zReportDescription')}
        </p>
        {reportType === 'z' && (
          <div className="max-w-[200px]">
            <Input type="date" value={selectedDate} max={toDateInputValue(new Date())} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        )}
      </div>

      <div id="print-report-area" className="space-y-6">
        <PageHeader
          title={reportType === 'x' ? t('xReportLabel') : t('zReportLabel')}
          description={`${restaurantName || 'MenuFlow'} · ${periodLabel}`}
          actions={
            <Button variant="primary" onClick={() => window.print()} className="print:hidden" icon={<Printer className="w-4 h-4" />}>
              {t('printReportButton')}
            </Button>
          }
        />

        {report.orderCount === 0 && report.cancelledCount === 0 ? (
          <EmptyState icon={<Receipt className="w-5 h-5" />} title={t('reportNoOrdersTitle')} description={t('reportNoOrdersDescription')} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ReportKpiCard label={t('reportKpiRevenue')} value={`${report.revenueTotal.toFixed(2)} ${symbol}`} icon={<DollarSign className="w-5 h-5 text-[var(--k-warning)]" />} tint="bg-[var(--k-warning-soft)]" />
              <ReportKpiCard label={t('reportKpiOrderCount')} value={report.orderCount} icon={<Receipt className="w-5 h-5 text-[var(--k-accent)]" />} tint="bg-[var(--k-accent-soft)]" />
              <ReportKpiCard label={t('reportKpiAvgOrder')} value={`${report.averageOrderValue.toFixed(2)} ${symbol}`} icon={<DollarSign className="w-5 h-5 text-[var(--k-info)]" />} tint="bg-[var(--k-info-soft)]" />
              <ReportKpiCard label={t('kpiTotalPayments')} value={`${report.paidTotal.toFixed(2)} ${symbol}`} icon={<Wallet className="w-5 h-5 text-[var(--k-success)]" />} tint="bg-[var(--k-success-soft)]" />
              <ReportKpiCard label={t('kpiUnpaid')} value={`${report.unpaidCount} · ${report.unpaidTotal.toFixed(2)} ${symbol}`} icon={<Clock className="w-5 h-5 text-[var(--k-danger)]" />} tint="bg-[var(--k-danger-soft)]" />
              <ReportKpiCard label={t('reportKpiCancelled')} value={`${report.cancelledCount} · ${report.cancelledTotal.toFixed(2)} ${symbol}`} icon={<Ban className="w-5 h-5 text-[var(--k-text-3)]" />} tint="bg-[var(--k-surface-3)]" />
            </div>

            <Card variant="plain">
              <CardHeader><h4 className="text-sm font-semibold text-[var(--k-text)]">{t('reportByPaymentMethodTitle')}</h4></CardHeader>
              <CardBody className="divide-y divide-[var(--k-border)]">
                <PaymentMethodRow label={t('kpiCash')} icon={<Wallet className="w-4 h-4 text-[var(--k-success)]" />} tint="bg-[var(--k-success-soft)]" data={report.byPaymentMethod.cash} symbol={symbol} />
                <PaymentMethodRow label={t('kpiPosTerminal')} icon={<CreditCard className="w-4 h-4 text-[var(--k-accent)]" />} tint="bg-[var(--k-accent-soft)]" data={report.byPaymentMethod.card} symbol={symbol} />
                <PaymentMethodRow label={t('kpiWallet')} icon={<Smartphone className="w-4 h-4 text-[var(--k-info)]" />} tint="bg-[var(--k-info-soft)]" data={report.byPaymentMethod.wallet} symbol={symbol} />
                {report.byPaymentMethod.unspecified.count > 0 && (
                  <PaymentMethodRow label={t('reportUnspecifiedMethodLabel')} icon={<DollarSign className="w-4 h-4 text-[var(--k-text-3)]" />} tint="bg-[var(--k-surface-3)]" data={report.byPaymentMethod.unspecified} symbol={symbol} />
                )}
              </CardBody>
            </Card>

            {report.byTable.length > 0 && (
              <Card variant="plain">
                <CardHeader><h4 className="text-sm font-semibold text-[var(--k-text)]">{t('reportByTableTitle')}</h4></CardHeader>
                <CardBody className="divide-y divide-[var(--k-border)]">
                  {report.byTable.map((row) => (
                    <div key={row.tableId || row.tableName} className="flex items-center justify-between gap-3 py-2 px-1 text-sm">
                      <span className="text-[var(--k-text-2)]">{row.tableName}</span>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-[var(--k-text-3)]">{row.orderCount}</span>
                        <span className="k-nums font-semibold text-[var(--k-text)] min-w-[90px] text-right">{row.total.toFixed(2)} {symbol}</span>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}
          </>
        )}

        <p className="print:hidden text-[11px] text-[var(--k-text-3)]">
          {t('reportGeneratedAtLabel')} {new Date().toLocaleString(LOCALE_TAGS[language] || 'az-AZ')}
        </p>
      </div>
    </div>
  );
}

export default SalesReportView;
