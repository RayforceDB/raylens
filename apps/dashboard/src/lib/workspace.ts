import { Workspace, Query } from '../store';
import { toast } from '../components/Toast';

const STORAGE_KEY = 'raylens-workspace';
const WORKSPACES_KEY = 'raylens-workspaces';

/**
 * Strip transient data from workspace before persisting.
 * We don't want to save query results, running state, or errors - 
 * these should be fresh on each load.
 */
function sanitizeWorkspaceForStorage(workspace: Workspace): Workspace {
  return {
    ...workspace,
    queries: workspace.queries.map(q => ({
      id: q.id,
      name: q.name,
      code: q.code,
      isRunning: false,
      // Explicitly exclude: lastResult, lastRun, lastError
    } as Query)),
  };
}

// ============================================================================
// LOCAL STORAGE
// ============================================================================

export function saveWorkspaceToStorage(workspace: Workspace): void {
  try {
    const sanitized = sanitizeWorkspaceForStorage(workspace);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    
    // Also update the workspaces list
    const workspaces = getWorkspacesList();
    const existing = workspaces.findIndex(w => w.id === workspace.id);
    const entry = {
      id: workspace.id,
      name: workspace.name,
      updatedAt: Date.now(),
    };
    
    if (existing >= 0) {
      workspaces[existing] = entry;
    } else {
      workspaces.push(entry);
    }
    
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
    console.log('[Workspace] Saved to storage:', workspace.name);
  } catch (err) {
    console.error('[Workspace] Failed to save:', err);
  }
}

export function loadWorkspaceFromStorage(): Workspace | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data) as Workspace;
    }
  } catch (err) {
    console.error('[Workspace] Failed to load:', err);
  }
  return null;
}

export function clearWorkspaceStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(WORKSPACES_KEY);
  console.log('[Workspace] Cleared storage');
}

export function getWorkspacesList(): Array<{ id: string; name: string; updatedAt: number }> {
  try {
    const data = localStorage.getItem(WORKSPACES_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Workspace] Failed to get list:', err);
  }
  return [];
}

// ============================================================================
// FILE EXPORT/IMPORT
// ============================================================================

export function exportWorkspaceToFile(workspace: Workspace): void {
  const sanitized = sanitizeWorkspaceForStorage(workspace);
  const data = JSON.stringify(sanitized, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${workspace.name.toLowerCase().replace(/\s+/g, '-')}.lens.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importWorkspaceFromFile(): Promise<Workspace | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.lens.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      
      try {
        const text = await file.text();
        const workspace = JSON.parse(text) as Workspace;
        resolve(workspace);
      } catch (err) {
        console.error('[Workspace] Failed to import:', err);
        toast.error('Failed to import workspace: Invalid file format');
        resolve(null);
      }
    };
    
    input.click();
  });
}

// ============================================================================
// URL SHARING
// ============================================================================

export function encodeWorkspaceForUrl(workspace: Workspace): string {
  const sanitized = sanitizeWorkspaceForStorage(workspace);
  const data = JSON.stringify(sanitized);
  // Use base64 encoding for URL safety
  const encoded = btoa(encodeURIComponent(data));
  return encoded;
}

export function decodeWorkspaceFromUrl(encoded: string): Workspace | null {
  try {
    const data = decodeURIComponent(atob(encoded));
    return JSON.parse(data) as Workspace;
  } catch (err) {
    console.error('[Workspace] Failed to decode from URL:', err);
    return null;
  }
}

export function getShareUrl(workspace: Workspace): string {
  // For large workspaces, we'd use a shortened URL service
  // For now, just embed in URL hash (has limits)
  const encoded = encodeWorkspaceForUrl(workspace);
  return `${window.location.origin}${window.location.pathname}#/share/${encoded}`;
}

export function parseShareUrl(): Workspace | null {
  const hash = window.location.hash;
  if (hash.startsWith('#/share/')) {
    const encoded = hash.slice(8);
    return decodeWorkspaceFromUrl(encoded);
  }
  return null;
}

