import PropTypes from "prop-types";
import { Card, CardHeader, CardBody, Button, Alert } from "@/components/ui";
import { useStaffTranslation } from "@/lib/i18n/dictionaries/staff";

export function OrderCard({ order, tableName, onStatusChange, nextStatus, nextLabel, nextColor, isCompleted, readOnly }) {
  const { t } = useStaffTranslation();
  const timeStr = new Date(order.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  // `nextLabel` is always supplied by StaffApp's call sites today (each
  // passes a translated label per column) — this fallback only covers a
  // hypothetical future caller that omits it, so it goes through the
  // dictionary (staff.js: defaultNextLabel) instead of a hardcoded string.
  const resolvedNextLabel = nextLabel ?? t('defaultNextLabel');

  return (
    <Card context="dark" variant="flat" className={isCompleted ? "opacity-70" : ""}>
      <CardHeader className="flex items-center justify-between">
        <h4 className="font-bold text-lg text-white">{tableName}</h4>
        <span className="text-xs text-slate-400 font-mono">{timeStr}</span>
      </CardHeader>
      <CardBody>
        <div className="space-y-3 mb-5">
          {order.items.map((item, index) => (
            <div key={`${item.id || item.product.id}-${index}`} className="flex justify-between items-start text-sm">
              <div>
                <span className="font-bold text-blue-400 mr-2">{item.quantity}x</span>
                <span className="text-slate-200">{item.product.name}</span>
                {item.note && <div className="text-[10px] text-amber-400 mt-0.5 ml-6 italic">{t('itemNotePrefix')} {item.note}</div>}
              </div>
            </div>
          ))}
        </div>
        {/* Order-level note ("Ümumi masa qeydi") — distinct from the per-item
            kitchen requests rendered above, so it gets its own block. */}
        {order.note && (
          <Alert tone="warning" className="mb-4 rounded-xl px-3 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-400/80">{t('tableNoteLabel')}</span>
            <span className="text-xs italic text-amber-200">{order.note}</span>
          </Alert>
        )}
        {/* `readOnly` is the orders.manage capability gate (see StaffApp.jsx) —
            both roles that can reach /staff have it today, so this never hides
            the button in practice; it's here so a future view-only staff tier
            doesn't need a StaffApp rewrite, just a false in the role matrix. */}
        {!isCompleted && !readOnly && (
          <Button onClick={() => onStatusChange(order.id, nextStatus)} size="block" className={nextColor}>
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
  nextColor: PropTypes.string,
  isCompleted: PropTypes.bool,
  readOnly: PropTypes.bool,
};

OrderCard.defaultProps = { nextStatus: undefined, nextColor: "bg-blue-600 hover:bg-blue-500", isCompleted: false, readOnly: false };
