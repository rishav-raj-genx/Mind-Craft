export default function ClerkSetupScreen() {
  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#1E293B] border border-[#334155] rounded-2xl p-8 shadow-2xl">
        <div className="w-14 h-14 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Clerk Configuration Required</h1>
        <p className="text-gray-400 text-sm mb-6">
          To launch Mindcraft, configure your Clerk publishable key in{' '}
          <code className="text-indigo-300 bg-[#0F172A] px-2 py-0.5 rounded">frontend-react/.env.local</code> (or{' '}
          <code className="text-indigo-300 bg-[#0F172A] px-2 py-0.5 rounded">frontend-react/.env</code>).
        </p>
        <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-4 mb-6 font-mono text-xs text-emerald-400 overflow-x-auto">
          <code>VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</code>
        </div>
        <p className="text-xs text-gray-400">
          Obtain your key from the{' '}
          <a
            href="https://dashboard.clerk.com"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 underline hover:text-indigo-300"
          >
            Clerk Dashboard
          </a>{' '}
          under <strong>API Keys</strong>.
        </p>
      </div>
    </div>
  );
}

