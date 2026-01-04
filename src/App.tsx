import { useEffect, useState } from 'react';
import { useRayforceStore } from '@core/store';
import { AppShell } from '@components/layout/AppShell';

export default function App() {
  const { status, error, init } = useRayforceStore();
  const [initAttempted, setInitAttempted] = useState(false);

  useEffect(() => {
    if (!initAttempted) {
      setInitAttempted(true);
      init();
    }
  }, [initAttempted, init]);

  if (status === 'loading') {
    return <LoadingScreen message="Initializing RayforceDB..." />;
  }

  if (status === 'error') {
    return <ErrorScreen message={error ?? 'Failed to initialize'} onRetry={init} />;
  }

  return <AppShell />;
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-ray-500/20" />
          <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-ray-500" />
        </div>
        <p className="mt-6 text-gray-400">{message}</p>
      </div>
    </div>
  );
}

function ErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
      <div className="max-w-md text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg
            className="h-8 w-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">
          Initialization Failed
        </h2>
        <p className="mt-2 text-gray-400">{message}</p>
        <button
          onClick={onRetry}
          className="mt-6 rounded-lg bg-ray-600 px-4 py-2 text-sm font-medium text-white hover:bg-ray-500 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
