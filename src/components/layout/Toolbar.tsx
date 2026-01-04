import { useRayforceStore } from '@core/store';

export function Toolbar() {
  const { status } = useRayforceStore();

  return (
    <header className="flex h-12 items-center justify-between border-b border-gray-800 bg-gray-900 px-4">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-ray-400 to-ray-600">
          <svg
            className="h-5 w-5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="8" strokeDasharray="4 2" />
          </svg>
        </div>
        <span className="text-lg font-semibold text-white">RayLens</span>
        <span className="rounded bg-ray-500/20 px-1.5 py-0.5 text-xs font-medium text-ray-400">
          Preview
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <div className="flex items-center gap-2 rounded-md bg-gray-800 px-3 py-1.5">
          <StatusDot status={status} />
          <span className="text-xs text-gray-400">
            {status === 'ready' ? 'Connected' : status === 'loading' ? 'Loading...' : 'Disconnected'}
          </span>
        </div>

        {/* Theme toggle placeholder */}
        <button
          className="rounded-md p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
          aria-label="Toggle theme"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        </button>

        {/* Settings placeholder */}
        <button
          className="rounded-md p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
          aria-label="Settings"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorClass =
    status === 'ready'
      ? 'bg-emerald-500'
      : status === 'loading'
        ? 'bg-amber-500 animate-pulse'
        : 'bg-red-500';

  return <div className={`h-2 w-2 rounded-full ${colorClass}`} />;
}
