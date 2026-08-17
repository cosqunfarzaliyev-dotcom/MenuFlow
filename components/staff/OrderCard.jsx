import PropTypes from "prop-types";
import { Card, CardHeader, CardBody, Button, Banner } from "@/components/kit";
import { useStaffTranslation } from "@/lib/i18n/dictionaries/staff";

export function OrderCard({ order, tableName, onStatusChange, nextStatus, nextLabel, isCompleted, readOnly }) {
  const { t } = useStaffTranslation();
  const timeStr = new Date(order.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  // `nextLabel` is always supplied by StaffApp's call sites today (each
  // passes a translated label per column) — this fallback only covers a
  // hypothetical future caller that omits it, so it goes through the
  // dictionary (staff.js: defaultNextLabel) instead of a hardcoded string.
  const resolvedNextLabel = nextLabel ?? t('defaultNextLabel');

  return (
    <Card variant="plain" className={isCompleted ? "opacity-60" : ""}>
      <CardHeader className="flex items-center justify-between">
        <h4 className="font-semibold text-[var(--k-text)]">{tableName}</h4>
        <span className="text-xs text-[var(--k-text-3)] font-mono">{timeStr}</span>
      </CardHeader>
      <CardBody>
        <div className="space-y-3 mb-5">
          {order.items.map((item, index) => (
            <div key={`${item.id || item.product.id}-${index}`} className="flex justify-between items-start text-sm">
              <div>
                <span className="font-semibold text-[var(--k-accent)] mr-2">{item.quantity}x</span>
                <span className="text-[var(--k-text-2)]">{item.product.name}</span>
                {item.note && <div className="text-[10px] text-[var(--k-warning)] mt-0.5 ml-6 italic">{t('itemNotePrefix')} {item.note}</div>}
              </div>
            </div>
          ))}
        </div>
        {/* Order-level note ("Ümumi masa qeydi") — distinct from the per-item
            kitchen requests rendered above, so it gets its own block. */}
        {order.note && (
          <Banner tone="warning" className="mb-4">
            <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">{t('tableNoteLabel')}</span>
            <span className="text-xs italic">{order.note}</span>
          </Banner>
        )}
        {/* `readOnly` is the orders.manage capability gate (see StaffApp.jsx) —
            both roles that can reach /staff have it today, so this never hides
            the button in practice; it's here so a future view-only staff tier
            doesn't need a StaffApp rewrite, just a false in the role matrix. */}
        {!isCompleted && !readOnly && (
          <Button variant="primary" onClick={() => onStatusChange(order.id, nextStatus)} size="block">
            {resolvedNextLabel}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

OrderCard.propTypes = {
  order: PropTypes.shape({ id: PropTypes.string.isRequired, time: PropTypes.string.isRequired, items: PropTypes.array.isRequired, note: PropTypes.string }).isRequired,
  tableName: PropTypes.string.isRequired,
  onStatusChange: PropTypes.func.isRequired,
  nextStatus: PropTypes.string,
  nextLabel: PropTypes.string,
  isCompleted: PropTypes.bool,
  readOnly: PropTypes.bool,
};

OrderCard.defaultProps = { nextStatus: undefined, isCompleted: false, readOnly: false };
