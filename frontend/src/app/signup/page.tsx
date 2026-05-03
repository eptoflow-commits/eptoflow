import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <div className="w-full max-w-sm text-center space-y-4">
        <img src="/logo.svg" alt="Eptoflow" className="h-20 w-auto mx-auto" />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 space-y-3">
          <div className="text-3xl">🔒</div>
          <h1 className="text-lg font-bold text-gray-900">Access by invitation only</h1>
          <p className="text-sm text-gray-600">
            Accounts are created by your Eptoflow administrator. Please contact your admin to get access.
          </p>
          <Link href="/login" className="btn-primary w-full inline-block text-center mt-2">
            Back to Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
