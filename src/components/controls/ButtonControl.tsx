/**
 * ButtonControl - Interactive button component
 * 
 * Based on KX Dashboards button component with:
 * - Multiple variants (primary, secondary, outline, danger)
 * - Icon support
 * - Loading state
 * - Rayfall action execution
 * - Confirmation dialog
 * - Keyboard shortcuts
 */

import { useState, useCallback, useEffect } from 'react';
import { useRayLensStore } from '@core/store';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonControlProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  fullWidth?: boolean;
  
  // Action configuration
  action?: 'query' | 'navigate' | 'setVariable' | 'custom';
  query?: string; // Rayfall query to execute
  url?: string; // URL to navigate to
  variable?: string; // Variable name to set
  variableValue?: string; // Value to set
  customAction?: () => void | Promise<void>;
  
  // Confirmation
  confirmMessage?: string;
  
  // Keyboard shortcut
  shortcut?: string; // e.g., "Ctrl+Enter" or "F5"
  
  // Callbacks
  onClick?: () => void;
  onSuccess?: (result: unknown) => void;
  onError?: (error: Error) => void;
}

export function ButtonControl({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  fullWidth = false,
  action,
  query,
  url,
  variable,
  variableValue,
  customAction,
  confirmMessage,
  shortcut,
  onClick,
  onSuccess,
  onError,
}: ButtonControlProps) {
  const { bridge, status } = useRayLensStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Execute the configured action
  const executeAction = useCallback(async () => {
    setLastResult(null);
    setLastError(null);
    
    try {
      switch (action) {
        case 'query':
          if (!query) throw new Error('No query specified');
          if (!bridge || status !== 'ready') throw new Error('Rayforce not connected');
          
          setIsLoading(true);
          const result = await bridge.eval(query);
          setLastResult(String(result));
          onSuccess?.(result);
          break;

        case 'navigate':
          if (!url) throw new Error('No URL specified');
          window.open(url, '_blank');
          onSuccess?.(url);
          break;

        case 'setVariable':
          if (!variable) throw new Error('No variable specified');
          // In a real app, this would set a dashboard variable
          console.log(`[ButtonControl] Setting ${variable} = ${variableValue}`);
          onSuccess?.({ variable, value: variableValue });
          break;

        case 'custom':
          if (customAction) {
            setIsLoading(true);
            await customAction();
            onSuccess?.(null);
          }
          break;

        default:
          // No action configured, just trigger onClick
          break;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setLastError(error.message);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }

    onClick?.();
  }, [action, query, url, variable, variableValue, customAction, bridge, status, onClick, onSuccess, onError]);

  // Handle click with optional confirmation
  const handleClick = useCallback(() => {
    if (disabled || isLoading) return;

    if (confirmMessage) {
      setShowConfirm(true);
    } else {
      executeAction();
    }
  }, [disabled, isLoading, confirmMessage, executeAction]);

  // Confirm dialog
  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    executeAction();
  }, [executeAction]);

  // Keyboard shortcut
  useEffect(() => {
    if (!shortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const parts = shortcut.toLowerCase().split('+');
      const key = parts.pop() || '';
      const requiresCtrl = parts.includes('ctrl') || parts.includes('cmd');
      const requiresShift = parts.includes('shift');
      const requiresAlt = parts.includes('alt');

      const matchesKey = e.key.toLowerCase() === key || e.code.toLowerCase() === key;
      const matchesMods = 
        (requiresCtrl ? (e.ctrlKey || e.metaKey) : true) &&
        (requiresShift ? e.shiftKey : true) &&
        (requiresAlt ? e.altKey : true);

      if (matchesKey && matchesMods) {
        e.preventDefault();
        handleClick();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, handleClick]);

  // Style classes based on variant and size
  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-ray-600 hover:bg-ray-500 text-white border-transparent',
    secondary: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border-transparent',
    outline: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
    danger: 'bg-red-600 hover:bg-red-500 text-white border-transparent',
    ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 border-transparent',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  const iconSizes: Record<ButtonSize, string> = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded overflow-hidden">
      {/* Header - shows action type */}
      {action && (
        <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-2xs text-gray-500 uppercase">
            {action === 'query' ? 'Query Button' : 
             action === 'navigate' ? 'Link Button' :
             action === 'setVariable' ? 'Variable Button' : 'Action Button'}
          </span>
          {shortcut && (
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-2xs rounded">
              {shortcut}
            </kbd>
          )}
        </div>
      )}

      {/* Button */}
      <div className={`flex-1 flex items-center justify-center p-3 ${fullWidth ? '' : ''}`}>
        <button
          onClick={handleClick}
          disabled={disabled || isLoading}
          className={`
            inline-flex items-center justify-center font-medium rounded border transition-colors
            ${variantClasses[variant]}
            ${sizeClasses[size]}
            ${fullWidth ? 'w-full' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isLoading ? 'cursor-wait' : ''}
          `}
        >
          {isLoading ? (
            <div className={`${iconSizes[size]} border-2 border-current border-t-transparent rounded-full animate-spin`} />
          ) : icon && iconPosition === 'left' ? (
            <span className={iconSizes[size]}>{icon}</span>
          ) : null}
          
          <span>{label}</span>
          
          {!isLoading && icon && iconPosition === 'right' && (
            <span className={iconSizes[size]}>{icon}</span>
          )}
        </button>
      </div>

      {/* Result/Error display */}
      {(lastResult || lastError) && (
        <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700">
          {lastError ? (
            <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded">
              <div className="text-2xs text-red-600 dark:text-red-400 font-medium">Error</div>
              <div className="text-2xs text-red-500 dark:text-red-300 break-all">{lastError}</div>
            </div>
          ) : lastResult ? (
            <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded">
              <div className="text-2xs text-emerald-600 dark:text-emerald-400 font-medium">Success</div>
              <div className="text-2xs text-emerald-500 dark:text-emerald-300 break-all max-h-16 overflow-y-auto">
                {lastResult}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Query preview */}
      {action === 'query' && query && (
        <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="text-2xs text-gray-500 mb-0.5">Query:</div>
          <code className="text-2xs text-emerald-600 dark:text-emerald-400 break-all block max-h-12 overflow-y-auto font-mono">
            {query}
          </code>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Confirm Action</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">{confirmMessage}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-3 py-1.5 text-xs text-white bg-ray-600 hover:bg-ray-500 rounded transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Button Group component for multiple related buttons
export function ButtonGroup({
  children,
  direction = 'horizontal',
}: {
  children: React.ReactNode;
  direction?: 'horizontal' | 'vertical';
}) {
  return (
    <div className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row'} gap-1`}>
      {children}
    </div>
  );
}

// Toggle Button component
export function ToggleButton({
  label,
  checked = false,
  onChange,
  size = 'md',
  disabled = false,
}: {
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  size?: ButtonSize;
  disabled?: boolean;
}) {
  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <button
      onClick={() => !disabled && onChange?.(!checked)}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-medium rounded border transition-colors
        ${sizeClasses[size]}
        ${checked 
          ? 'bg-ray-600 hover:bg-ray-500 text-white border-ray-600' 
          : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {label}
    </button>
  );
}

// Icon Button component (no label)
export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-ray-600 hover:bg-ray-500 text-white',
    secondary: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200',
    outline: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  const iconSizes: Record<ButtonSize, string> = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        inline-flex items-center justify-center rounded transition-colors
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span className={iconSizes[size]}>{icon}</span>
    </button>
  );
}
