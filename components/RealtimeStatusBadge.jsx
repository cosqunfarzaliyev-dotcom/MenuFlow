"use client";

import React, { useEffect, useState } from 'react';
import { getRealtimeStatus, addRealtimeStatusListener, removeRealtimeStatusListener, STATUS } from '@/lib/services/realtime';

const STATUS_META = {
  [STATUS.CONNECTED]: { dot: '🟢', label: 'Connected' },
  [STATUS.CONNECTING]: { dot: '🟡', label: 'Connecting' },
  [STATUS.RECONNECTING]: { dot: '🔵', label: 'Reconnecting' },
  [STATUS.DISCONNECTED]: { dot: '🔴', label: 'Disconnected' },
};

export function RealtimeStatusBadge({ className = '' }) {
  const [status, setStatus] = useState(() => getRealtimeStatus() || STATUS.DISCONNECTED);

  useEffect(() => {
    const handler = (s) => setStatus(s);
    addRealtimeStatusListener(handler);
    return () => removeRealtimeStatusListener(handler);
  }, []);

  const info = STATUS_META[status] || STATUS_META[STATUS.DISCONNECTED];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/6 text-xs font-semibold ${className}`} title={`Realtime: ${info.label}`}>
      <span className="text-sm leading-none">{info.dot}</span>
      <span className="hidden sm:inline">{info.label}</span>
    </div>
  );
}

export default RealtimeStatusBadge;
