'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import type { Device, Schedule } from '@/lib/types';

const DAYS = [
  { v: 1, l: 'Mon' }, { v: 2, l: 'Tue' }, { v: 3, l: 'Wed' }, { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' }, { v: 6, l: 'Sat' }, { v: 7, l: 'Sun' },
];

export default function SchedulesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [form, setForm] = useState({
    device_id: '',
    zone_or_output: 'valve1',
    days_of_week: [1, 2, 3, 4, 5, 6, 7],
    start_time: '06:00',
    duration_seconds: 300,
    enabled: true,
  });
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const [d, s] = await Promise.all([
      api<{ devices: Device[] }>('/api/devices'),
      api<{ schedules: Schedule[] }>('/api/schedules'),
    ]);
    setDevices(d.devices);
    setSchedules(s.schedules);
    if (!form.device_id && d.devices[0]) setForm((f) => ({ ...f, device_id: d.devices[0].id }));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    try { await api('/api/schedules', { method: 'POST', body: JSON.stringify(form) }); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const del = async (id: string) => {
    await api(`/api/schedules/${id}`, { method: 'DELETE' }); load();
  };

  return (
    <AppShell>
      <h1 className="text-xl font-semibold mb-3">Schedules</h1>

      <form onSubmit={submit} className="card space-y-3 mb-4">
        {err && <div className="text-sm text-red-600">{err}</div>}
        <div>
          <label className="label">Device</label>
          <select className="input" value={form.device_id}
                  onChange={(e) => setForm({ ...form, device_id: e.target.value })} required>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.device_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Output</label>
          <select className="input" value={form.zone_or_output}
                  onChange={(e) => setForm({ ...form, zone_or_output: e.target.value })}>
            <option value="valve1">valve1</option>
            <option value="valve2">valve2 (premium)</option>
            <option value="valve3">valve3 (premium)</option>
            <option value="relay1">relay1</option>
          </select>
        </div>
        <div>
          <label className="label">Days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const active = form.days_of_week.includes(d.v);
              return (
                <button type="button" key={d.v}
                        className={`px-3 py-1 rounded-full text-sm border ${active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-700'}`}
                        onClick={() => setForm({
                          ...form,
                          days_of_week: active
                            ? form.days_of_week.filter((x) => x !== d.v)
                            : [...form.days_of_week, d.v].sort(),
                        })}>
                  {d.l}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start time</label>
            <input className="input" type="time" value={form.start_time}
                   onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div>
            <label className="label">Duration (sec)</label>
            <input className="input" type="number" min={1} max={3600} value={form.duration_seconds}
                   onChange={(e) => setForm({ ...form, duration_seconds: parseInt(e.target.value || '0') })} />
          </div>
        </div>
        <button className="btn-primary w-full">Add schedule</button>
      </form>

      <div className="grid gap-2">
        {schedules.map((s) => (
          <div key={s.id} className="card flex items-center justify-between">
            <div>
              <div className="text-sm font-medium capitalize">{s.zone_or_output} @ {s.start_time}</div>
              <div className="text-xs text-gray-500">
                {s.days_of_week.map((d) => DAYS[d - 1]?.l).join(', ')} · {s.duration_seconds}s
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <span className={s.enabled ? 'badge-green' : 'badge-gray'}>
                {s.enabled ? 'on' : 'off'}
              </span>
              <button className="text-sm text-red-600" onClick={() => del(s.id)}>Delete</button>
            </div>
          </div>
        ))}
        {schedules.length === 0 && <div className="card text-sm text-gray-500">No schedules yet.</div>}
      </div>
    </AppShell>
  );
}
