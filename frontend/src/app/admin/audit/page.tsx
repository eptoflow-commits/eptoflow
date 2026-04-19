'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminAuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api<{ audit_logs: any[] }>('/api/admin/audit-logs', { auth: 'admin' }).then(r => setRows(r.audit_logs));
  }, []);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-100 rounded">
        <thead className="text-xs text-gray-500"><tr>
          <th className="p-2 text-left">When</th>
          <th className="p-2 text-left">Actor</th>
          <th className="p-2 text-left">Action</th>
          <th className="p-2 text-left">Entity</th>
          <th className="p-2 text-left">Metadata</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t text-sm">
              <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
              <td className="p-2">{r.actor_type}</td>
              <td className="p-2">{r.action}</td>
              <td className="p-2">{r.entity_type}</td>
              <td className="p-2 font-mono text-xs">
                {r.metadata ? JSON.stringify(r.metadata) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
