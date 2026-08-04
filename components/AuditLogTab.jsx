"use client";

import React, { useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { useAppStore } from "@/lib/store";

const formatWhen = (iso) => {
  try {
    return new Date(iso).toLocaleString('az-AZ', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

// Audit Log: Kim / Nə vaxt / Nəyi dəyişib — hər admin əməliyyatından
// (məhsul, kampaniya, endirim, banner, dizayn dəyişikliyi) sonra avtomatik
// qeyd olunur (bax: lib/store.js -> recordAudit).
export function AuditLogTab() {
  const { auditLogs, loadAuditLogs } = useAppStore();

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-5 h-5 text-blue-400" />
        <h2 className="font-bold text-lg text-white">Audit Log</h2>
      </div>
      {auditLogs.length === 0 ? (
        <p className="text-sm text-slate-500">Hələ heç bir dəyişiklik qeydə alınmayıb.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-4 font-bold">Kim</th>
                <th className="py-2 pr-4 font-bold">Nə vaxt</th>
                <th className="py-2 pr-4 font-bold">Nəyi dəyişib</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-800/60">
                  <td className="py-2.5 pr-4 text-slate-300 whitespace-nowrap">{log.actor_email || 'Naməlum'}</td>
                  <td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap">{formatWhen(log.created_at)}</td>
                  <td className="py-2.5 pr-4 text-white">{log.summary || log.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AuditLogTab;
