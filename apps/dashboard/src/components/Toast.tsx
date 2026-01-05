import { useEffect, useState, useCallback } from 'react';
import { create } from 'zustand';

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message, duration = 4000) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));
    
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// ============================================================================
// CONFIRM MODAL
// ============================================================================

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: 'danger' | 'warning' | 'info';
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
}

interface ConfirmStore extends ConfirmState {
  show: (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm?: () => void;
    onCancel?: () => void;
  }) => Promise<boolean>;
  hide: () => void;
  resolve: ((value: boolean) => void) | null;
}

export const useConfirmStore = create<ConfirmStore>((set) => ({
  isOpen: false,
  title: 'Confirm',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  type: 'info',
  onConfirm: null,
  onCancel: null,
  resolve: null,
  
  show: (options) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        title: options.title || 'Confirm',
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        type: options.type || 'info',
        onConfirm: options.onConfirm || null,
        onCancel: options.onCancel || null,
        resolve,
      });
    });
  },
  
  hide: () => {
    set({
      isOpen: false,
      onConfirm: null,
      onCancel: null,
      resolve: null,
    });
  },
}));

// Convenience function
export const confirm = (message: string, options?: {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}) => {
  return useConfirmStore.getState().show({ message, ...options });
};

// Convenience functions
export const toast = {
  success: (message: string, duration?: number) => 
    useToastStore.getState().addToast('success', message, duration),
  error: (message: string, duration?: number) => 
    useToastStore.getState().addToast('error', message, duration),
  warning: (message: string, duration?: number) => 
    useToastStore.getState().addToast('warning', message, duration),
  info: (message: string, duration?: number) => 
    useToastStore.getState().addToast('info', message, duration),
};

// Toast container component
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

// Individual toast component
function ToastItem({ toast: t, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`toast toast-${t.type} ${isExiting ? 'toast-exit' : ''}`}>
      <span className="toast-icon">{icons[t.type]}</span>
      <span className="toast-message">{t.message}</span>
      <button className="toast-close" onClick={handleClose}>×</button>
    </div>
  );
}

// ============================================================================
// CONFIRM MODAL COMPONENT
// ============================================================================

export function ConfirmModal() {
  const { isOpen, title, message, confirmText, cancelText, type, onConfirm, onCancel, hide, resolve } = useConfirmStore();
  
  const handleConfirm = useCallback(() => {
    onConfirm?.();
    resolve?.(true);
    hide();
  }, [onConfirm, resolve, hide]);
  
  const handleCancel = useCallback(() => {
    onCancel?.();
    resolve?.(false);
    hide();
  }, [onCancel, resolve, hide]);
  
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
      if (e.key === 'Enter') handleConfirm();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCancel, handleConfirm]);
  
  if (!isOpen) return null;
  
  const typeColors = {
    danger: 'var(--accent-red)',
    warning: 'var(--accent-amber)',
    info: 'var(--accent-blue)',
  };
  
  const typeIcons = {
    danger: '⚠',
    warning: '⚠',
    info: 'ℹ',
  };
  
  return (
    <div className="confirm-overlay" onClick={handleCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header" style={{ borderLeftColor: typeColors[type] }}>
          <span className="confirm-icon" style={{ color: typeColors[type] }}>
            {typeIcons[type]}
          </span>
          <span className="confirm-title">{title}</span>
        </div>
        <div className="confirm-body">
          {message}
        </div>
        <div className="confirm-footer">
          <button className="btn" onClick={handleCancel}>
            {cancelText}
          </button>
          <button 
            className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
