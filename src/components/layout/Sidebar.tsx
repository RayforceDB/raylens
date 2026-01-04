import { useRayforceStore } from '@core/store';

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, loadSampleData, datasetLoading, dataset } =
    useRayforceStore();

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed left-2 top-14 z-20 rounded-md border border-gray-700 bg-gray-900 p-2 text-gray-400 hover:text-white"
        aria-label="Open sidebar"
      >
        <ChevronRightIcon />
      </button>
    );
  }

  return (
    <aside className="flex w-64 flex-col border-r border-gray-800 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <span className="text-sm font-medium text-gray-200">Data</span>
        <button
          onClick={toggleSidebar}
          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
          aria-label="Close sidebar"
        >
          <ChevronLeftIcon />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {/* Load data section */}
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
            Data Source
          </h3>
          <button
            onClick={() => loadSampleData()}
            disabled={datasetLoading}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-left text-sm text-white hover:border-gray-600 hover:bg-gray-750 disabled:opacity-50 transition-colors"
          >
            {datasetLoading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                Loading...
              </span>
            ) : (
              'Load Sample Data'
            )}
          </button>
        </section>

        {/* Schema explorer */}
        {dataset && (
          <section>
            <h3 className="mb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
              Columns
            </h3>
            <div className="space-y-1">
              {dataset.schema.map((col) => (
                <ColumnItem key={col.name} column={col} />
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

interface ColumnItemProps {
  column: {
    name: string;
    type: string;
  };
}

function ColumnItem({ column }: ColumnItemProps) {
  return (
    <div
      className="group flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-800 active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', column.name);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <TypeIcon type={column.type} />
      <span className="flex-1 truncate text-sm text-gray-300 group-hover:text-white">
        {column.name}
      </span>
      <span className="opacity-0 transition-opacity group-hover:opacity-100">
        <DragIcon />
      </span>
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  const iconClass = getTypeIconClass(type);
  return (
    <span className={`flex h-4 w-4 items-center justify-center rounded text-2xs font-bold ${iconClass}`}>
      {getTypeIcon(type)}
    </span>
  );
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'i64':
    case 'i32':
    case 'i16':
      return '#';
    case 'f64':
      return '.#';
    case 'timestamp':
    case 'date':
    case 'time':
      return '⏱';
    case 'symbol':
      return 'Aa';
    case 'b8':
      return '◉';
    case 'c8':
      return '"';
    default:
      return '?';
  }
}

function getTypeIconClass(type: string): string {
  switch (type) {
    case 'i64':
    case 'i32':
    case 'i16':
    case 'f64':
      return 'bg-emerald-500/20 text-emerald-400';
    case 'timestamp':
    case 'date':
    case 'time':
      return 'bg-violet-500/20 text-violet-400';
    case 'symbol':
      return 'bg-amber-500/20 text-amber-400';
    case 'b8':
      return 'bg-pink-500/20 text-pink-400';
    case 'c8':
      return 'bg-indigo-500/20 text-indigo-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

function ChevronLeftIcon() {
  return (
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
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
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
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg
      className="h-4 w-4 text-gray-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 8h16M4 16h16"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-ray-500"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
