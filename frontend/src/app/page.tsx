import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-brand-900 mb-4">Eptoflow</h1>
        <p className="text-lg text-gray-700 mb-8">
          Smart irrigation and plant automation for ESP32. Monitor your plants, schedule
          watering, and control everything from your phone.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          <div className="card">
            <h2 className="font-semibold text-brand-700 mb-2">Basic — $2.99 / 30 days</h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>1 solenoid valve</li>
              <li>1 relay (motor or light)</li>
              <li>Manual ON/OFF</li>
              <li>Scheduling</li>
            </ul>
          </div>
          <div className="card border-brand-200">
            <h2 className="font-semibold text-brand-700 mb-2">Premium — $3.99 / 30 days</h2>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>3 solenoid valves</li>
              <li>Moisture sensor + automation</li>
              <li>1 relay (motor or light)</li>
              <li>Scheduling + In-app voice control</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/signup" className="btn-primary">Create account</Link>
          <Link href="/login" className="btn-secondary">Sign in</Link>
        </div>

        <p className="text-xs text-gray-500 mt-10">
          Built entirely on free and open-source software.
        </p>
      </div>
    </div>
  );
}
