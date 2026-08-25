import PropTypes from "prop-types";
import { X } from "lucide-react";
import { Card, CardHeader, CardBody, Button, Banner, Tag } from "@/components/kit";
import { useStaffTranslation } from "@/lib/i18n/dictionaries/staff";

export function OrderCard({ order, tableName, onStatusChange, nextStatus, nextLabel, isCompleted, readOnly, onCancel }) {
  const { t } = useStaffTranslation();
  const timeStr = new Date(order.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  // `nextLabel` is always supplied by StaffApp's call sites today (each
  // passes a translated label per column) — this fallback only covers a
  // hypothetical future caller that omits it, so it goes through the
  // dictionary (staff.js: defaultNextLabel) instead of a hardcoded string.
  const resolvedNextLabel = nextLabel ?? t('defaultNextLabel');

  return (
    <Card variant="plain" className={isCompleted ? "opacity-60" : ""}>
      {/* Sizing note: this card is read across a kitchen/pass, not at
          desk distance, so the table name, the quantity and the product
          name are all deliberately a step or two larger than the kit's
          default body scale. The quantity gets a fixed-width tinted chip
          rather than an inline "2x" so a column of items lines up and the
          counts can be scanned vertically at a glance. */}
      <CardHeader className="flex items-center justify-between gap-3">
        <h4 className="font-bold text-xl leading-tight text-[var(--k-text)]">{tableName}</h4>
        <span className="text-sm text-[var(--k-text-3)] font-mono tabular-nums shrink-0">{timeStr}</span>
      </CardHeader>
      <CardBody>
        <div className="space-y-3 mb-5">
          {order.items.map((item, index) => (
            <div key={`${item.id || item.product.id}-${index}`} className="flex items-start gap-2.5">
              <span className="shrink-0 min-w-[2.25rem] rounded-[var(--k-r-sm)] bg-[var(--k-accent-soft)] px-1.5 py-0.5 text-center text-base font-bold tabular-nums text-[var(--k-accent)]">
                {item.quantity}×
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-base font-medium leading-snug text-[var(--k-text)]">{item.product.name}</span>
                {item.note && <div className="text-sm text-[var(--k-warning)] mt-1 italic">{t('itemNotePrefix')} {item.note}</div>}
              </div>
            </div>
          ))}
        </div>
        {/* Order-level note ("Ümumi masa qeydi") — distinct from the per-item
            kitchen requests rendered above, so it gets its own block. */}
        {order.note && (
          <Banner tone="warning" className="mb-4">
            <span className="block text-xs font-semibold uppercase tracking-wide opacity-80">{t('tableNoteLabel')}</span>
            <span className="text-sm italic">{order.note}</span>
          </Banner>
        )}
        {/* Total wasn't shown anywhere on this card before — payment status
            is meaningless without the amount it refers to. Orthogonal to
            order.status: a served order can still be 'unpaid'. */}
        {typeof order.total === 'number' && (
          <div className="mb-4 space-y-2 border-t border-[var(--k-border)] pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-bold tabular-nums text-[var(--k-text)]">{order.total.toFixed(2)} ₼</span>
              <Tag tone={order.paymentStatus === 'paid' ? 'success' : 'warning'}>
                {order.paymentStatus === 'paid' ? t('paidStatus') : t('unpaidStatus')}
              </Tag>
            </div>
            {/* The method the customer picked in the cart at checkout time
                (CartDrawer.jsx) — cash/card/Google Pay/Apple Pay all arrive
                with a ready label (order.paymentMethodLabel, set client-side
                at order creation); "pay at table" is stored as a null
                payment_method (there was nothing to label), so it falls back
                to payAtTableLabel here rather than rendering nothing, which
                used to read as "this order carries no payment info at all"
                instead of "customer will pay in person". */}
            <div className="flex items-center gap-1.5 text-xs text-[var(--k-text-3)]">
              <span className="font-medium">{t('paymentTypeLabel')}:</span>
              <Tag tone="neutral">{order.paymentMethodLabel || t('payAtTableLabel')}</Tag>
            </div>
          </div>
        )}
        {/* `readOnly` is the orders.manage capability gate (see StaffApp.jsx) —
            both roles that can reach /staff have it today, so this never hides
            the button in practice; it's here so a future view-only staff tier
            doesn't need a StaffApp rewrite, just a false in the role matrix. */}
        {!isCompleted && !readOnly && (
          <div className="flex gap-2">
            <Button variant="primary" size="lg" onClick={() => onStatusChange(order.id, nextStatus)} className="flex-1 text-base">
              {resolvedNextLabel}
            </Button>
            {/* Cancellation is a separate, explicit action from the
                pending -> accepted -> preparing -> ready -> served chain
                above (never something a "next stage" tap should ever land
                on by accident) — only offered while an order is still in
                progress, gated on the same orders.manage capability. */}
            {onCancel && (
              <Button
                variant="danger"
                size="icon"
                onClick={() => onCancel(order.id)}
                aria-label={t('cancelButton')}
                title={t('cancelButton')}
                // Matches the h-12 of the primary action beside it — the
                // kit has no `iconLg` size, and a 36px square next to a
                // 48px button reads as misaligned.
                className="h-12 w-12 shrink-0"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

OrderCard.propTypes = {
  order: PropTypes.shape({
    id: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
    items: PropTypes.array.isRequired,
    note: PropTypes.string,
    total: PropTypes.number,
    paymentStatus: PropTypes.oneOf(['paid', 'unpaid']),
    paymentMethodLabel: PropTypes.string,
  }).isRequired,
  tableName: PropTypes.string.isRequired,
  onStatusChange: PropTypes.func.isRequired,
  nextStatus: PropTypes.string,
  nextLabel: PropTypes.string,
  isCompleted: PropTypes.bool,
  readOnly: PropTypes.bool,
  onCancel: PropTypes.func,
};

OrderCard.defaultProps = { nextStatus: undefined, isCompleted: false, readOnly: false };
