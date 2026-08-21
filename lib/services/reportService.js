// ---------------------------------------------------------------------------
// Z/X sales report aggregation — pure functions, no I/O. Shared by AdminApp's
// "Hesabat" tab and SuperAdmin's per-restaurant drill-down
// (components/admin/SalesReportView.jsx), both of which already have the
// restaurant's full `orders` array in memory (fetchOrders has no date
// filter) — a report is just filtering + reducing that same array, not a
// new query.
//
// Every rule here is lifted from components/AdminApp.jsx's existing
// PaymentsManagement/PaymentSchemaTable (~2237-2332), not re-derived —
// cancelled orders never count as revenue (same rule settle_table_payment()
// and superAdminService.fetchRestaurantStats() already enforce elsewhere),
// "collected" means paymentStatus === 'paid', payment methods bucket into
// cash / card / wallet (google_pay+apple_pay) / unspecified.
// ---------------------------------------------------------------------------
import { ORDER_STATUS } from '@/lib/store';

// [start, end) for the calendar day containing `date`, in the browser's own
// local timezone — matches AnalyticsDashboard's existing 'day' filter
// (toDateString() comparison) rather than inventing a new, inconsistent
// notion of "business day". No restaurant-level timezone column exists in
// the schema today (confirmed) — this is the same assumption the rest of
// the app already makes, not a new gap this feature introduces.
export const getDayRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start, to: end };
};

// X report: "so far today" — locked to now, not the full day, since the
// point of an X report is a mid-shift check that never implies the day is
// over.
export const getTodaySoFarRange = () => {
  const { from } = getDayRange(new Date());
  return { from, to: new Date() };
};

const inRange = (order, from, to) => {
  const t = new Date(order.time).getTime();
  return t >= from.getTime() && t < to.getTime();
};

const sumTotal = (list) => list.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

const getTableName = (tables, order) => {
  const table = tables.find((tb) => tb.id === order.tableId);
  return table ? table.name : order.table;
};

// Bucket shape reused for cash/card/wallet/unspecified — same fields
// PaymentSchemaTable already renders per method (count + total), so the
// report's payment-method section is a straight reuse of that row shape.
const bucket = (list) => ({ count: list.length, total: sumTotal(list) });

export const buildSalesReport = ({ orders, tables, from, to }) => {
  const inPeriod = orders.filter((o) => inRange(o, from, to));

  const cancelled = inPeriod.filter((o) => o.status === ORDER_STATUS.CANCELLED);
  const payable = inPeriod.filter((o) => o.status !== ORDER_STATUS.CANCELLED);

  const cash = payable.filter((o) => o.paymentMethod === 'cash');
  const card = payable.filter((o) => o.paymentMethod === 'card');
  const wallet = payable.filter((o) => ['google_pay', 'apple_pay'].includes(o.paymentMethod));
  const unspecified = payable.filter((o) => !['cash', 'card', 'google_pay', 'apple_pay'].includes(o.paymentMethod));

  const paid = payable.filter((o) => o.paymentStatus === 'paid');
  const unpaid = payable.filter((o) => o.paymentStatus === 'unpaid');

  const byTableMap = new Map();
  for (const order of payable) {
    const key = order.tableId || order.table;
    const entry = byTableMap.get(key) || { tableId: order.tableId, tableName: getTableName(tables, order), orderCount: 0, total: 0 };
    entry.orderCount += 1;
    entry.total += Number(order.total) || 0;
    byTableMap.set(key, entry);
  }
  const byTable = [...byTableMap.values()].sort((a, b) => b.total - a.total);

  return {
    from,
    to,
    orderCount: payable.length,
    revenueTotal: sumTotal(payable),
    paidTotal: sumTotal(paid),
    unpaidTotal: sumTotal(unpaid),
    unpaidCount: unpaid.length,
    averageOrderValue: payable.length > 0 ? sumTotal(payable) / payable.length : 0,
    cancelledCount: cancelled.length,
    cancelledTotal: sumTotal(cancelled),
    byPaymentMethod: { cash: bucket(cash), card: bucket(card), wallet: bucket(wallet), unspecified: bucket(unspecified) },
    byTable,
  };
};
