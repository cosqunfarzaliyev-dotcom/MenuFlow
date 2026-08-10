import PropTypes from "prop-types";

export function OrderCard({ order, tableName, onStatusChange, nextStatus, nextLabel, nextColor, isCompleted }) {
  const timeStr = new Date(order.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg ${isCompleted ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <h4 className="font-bold text-lg text-white">{tableName}</h4>
        <span className="text-xs text-slate-400 font-mono">{timeStr}</span>
      </div>
      <div className="space-y-3 mb-5">
        {order.items.map((item, index) => (
          <div key={`${item.id || item.product.id}-${index}`} className="flex justify-between items-start text-sm">
            <div>
              <span className="font-bold text-blue-400 mr-2">{item.quantity}x</span>
              <span className="text-slate-200">{item.product.name}</span>
              {item.note && <div className="text-[10px] text-amber-400 mt-0.5 ml-6 italic">Qeyd: {item.note}</div>}
            </div>
          </div>
        ))}
      </div>
      {/* Order-level note ("Ümumi masa qeydi") — distinct from the per-item
          kitchen requests rendered above, so it gets its own block. */}
      {order.note && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-400/80">Masa qeydi</span>
          <span className="text-xs italic text-amber-200">{order.note}</span>
        </div>
      )}
      {!isCompleted && (
        <button onClick={() => onStatusChange(order.id, nextStatus)} className={`w-full py-2.5 rounded-xl text-white font-bold text-sm transition-colors ${nextColor}`}>
          {nextLabel}
        </button>
      )}
    </div>
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
};

OrderCard.defaultProps = { nextStatus: undefined, nextLabel: "Növbəti mərhələ", nextColor: "bg-blue-600 hover:bg-blue-500", isCompleted: false };
