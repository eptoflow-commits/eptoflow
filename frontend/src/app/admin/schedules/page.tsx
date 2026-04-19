'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminSchedulesPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api<{ schedules: any[] }>('/api/admin/schedules', { auth: 'admin' }).then(r => setRows(r.schedules));
  }, []);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-100 rounded">
        <thead className="text-xs text-gray-500"><tr>
          <th className="p-2 text-left">User</th><th className="p-2 text-left">Device</th>
          <th className="p-2 text-left">Output</th><th className="p-2 text-left">Days</th>
          <th className="p-2 text-left">Start</th><th className="p-2 text-left">Duration</th>
          <th className="p-2 text-left">Enabled</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t text-sm">
              <td className="p-2">{r.email}</td>
              <td className="p-2 font-mono text-xs">{r.device_uid}</td>
              <td className="p-2">{r.zone_or_output}</td>
              <td className="p-2">{(r.days_of_week || []).join(',')}</td>
              <td className="p-2">{r.start_time}</td>
              <td className="p-2">{r.duration_seconds}s</td>
              <td className="p-2">{r.enabled ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
