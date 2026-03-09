import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  kind?: ToastKind;
  /** Message shown to the user. Keep short. */
  message: string;
  /** Auto-dismiss timeout in ms. Set to 0 to require manual dismiss. Default: 2500 */
  durationMs?: number;
  /** If true, user can close the toast. Default: true */
  dismissible?: boolean;
}

export interface ToastViewModel {
  id: string;
  kind: ToastKind;
  message: string;
  createdAtMs: number;
  durationMs: number;
  dismissible: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  /**
   * Flow name: ToastNotificationFlow
   *
   * Single canonical flow for transient notifications in the UI.
   *
   * Contract:
   * - Inputs: ToastOptions
   * - Output: string toastId (useful for correlation or manual dismissal)
   * - Errors: never throws
   * - Side effects: updates in-memory signal; schedules auto-dismiss timers
   *
   * Debuggability:
   * - Deterministic IDs and timestamps; state is inspectable via `toasts()`.
   */
  private readonly _toasts = signal<ToastViewModel[]>([]);

  // PUBLIC_INTERFACE
  /**
   * Current list of active toasts (newest first).
   */
  toasts(): ToastViewModel[] {
    return this._toasts();
  }

  // PUBLIC_INTERFACE
  /**
   * Show a toast notification.
   */
  show(options: ToastOptions): string {
    const toast: ToastViewModel = {
      id: this.newToastId(),
      kind: options.kind ?? 'info',
      message: options.message,
      createdAtMs: Date.now(),
      durationMs: options.durationMs ?? 2500,
      dismissible: options.dismissible ?? true,
    };

    // Newest first
    this._toasts.set([toast, ...this._toasts()].slice(0, 5));

    if (toast.durationMs > 0) {
      window.setTimeout(() => this.dismiss(toast.id), toast.durationMs);
    }

    return toast.id;
  }

  // PUBLIC_INTERFACE
  /**
   * Dismiss a toast by id (safe to call multiple times).
   */
  dismiss(id: string): void {
    const next = this._toasts().filter((t) => t.id !== id);
    if (next.length === this._toasts().length) return;
    this._toasts.set(next);
  }

  // PUBLIC_INTERFACE
  /**
   * Convenience helpers for common kinds.
   */
  success(message: string, durationMs?: number): string {
    return this.show({ kind: 'success', message, durationMs });
  }

  // PUBLIC_INTERFACE
  /** Convenience helper. */
  info(message: string, durationMs?: number): string {
    return this.show({ kind: 'info', message, durationMs });
  }

  // PUBLIC_INTERFACE
  /** Convenience helper. */
  warning(message: string, durationMs?: number): string {
    return this.show({ kind: 'warning', message, durationMs });
  }

  // PUBLIC_INTERFACE
  /** Convenience helper. */
  error(message: string, durationMs?: number): string {
    return this.show({ kind: 'error', message, durationMs });
  }

  private newToastId(): string {
    // readable + unique enough for ephemeral UI messages
    return `T-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
