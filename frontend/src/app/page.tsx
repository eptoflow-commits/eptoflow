import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <img src="/logo.svg" alt="Eptoflow" className="h-16 w-auto mx-auto mb-8" />
        <h1 className="text-4xl md:text-5xl font-bold text-brand-900 mb-4 leading-tight">
          Smart Plant Care,<br />Wherever You Are
        </h1>
        <p className="text-lg text-gray-600 mb-10 max-w-xl mx-auto">
          Eptoflow gives you full control over your irrigation and plant automation
          system — from any device, anytime.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/signup" className="btn-primary px-8 py-3 text-base">Get Started</Link>
          <Link href="/login" className="btn-secondary px-8 py-3 text-base">Sign In</Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-6 mt-4">
          <div className="card text-center">
            <div className="text-3xl mb-3">💧</div>
            <h3 className="font-semibold text-brand-800 mb-1">Automated Watering</h3>
            <p className="text-sm text-gray-600">Schedule and automate watering cycles with precision — no manual effort required.</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold text-brand-800 mb-1">Real-time Monitoring</h3>
            <p className="text-sm text-gray-600">Track soil moisture, device status, and activity logs from your dashboard.</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">🎙️</div>
            <h3 className="font-semibold text-brand-800 mb-1">Voice Control</h3>
            <p className="text-sm text-gray-600">Control your irrigation system hands-free with built-in voice commands.</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">📱</div>
            <h3 className="font-semibold text-brand-800 mb-1">Works on Any Device</h3>
            <p className="text-sm text-gray-600">Installable app experience on mobile and desktop — works offline too.</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="font-semibold text-brand-800 mb-1">Secure & Reliable</h3>
            <p className="text-sm text-gray-600">End-to-end encrypted communication with automatic fail-safe protection.</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-semibold text-brand-800 mb-1">Instant Commands</h3>
            <p className="text-sm text-gray-600">Send commands that execute on your device within seconds, from anywhere.</p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-12">
          &copy; {new Date().getFullYear()} Eptoflow. All rights reserved.
        </p>
      </div>
    </div>
  );
}
