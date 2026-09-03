"use client";

import { useKumoToastManager } from "@cloudflare/kumo";
import { isAuthTimeout, withAuthTimeout } from "./auth-action";

type AuthError = { message?: string | null } | null | undefined;
type AuthLike<T> = { data?: T; error?: AuthError };

export type AuthFeedbackMessages = {
  errorTitle: string;
  fallbackError: string;
  timeoutTitle: string;
  timeoutDescription: string;
};

export function useAuthFeedback() {
  const toasts = useKumoToastManager();

  function showError(title: string, description: string) {
    toasts.add({ title, description });
  }

  async function run<T>(
    action: () => Promise<AuthLike<T>>,
    messages: AuthFeedbackMessages,
  ): Promise<{ data: T | undefined; errorMessage: string | null }> {
    try {
      const result = await withAuthTimeout(action());
      if (result.error) {
        const description = result.error.message ?? messages.fallbackError;
        showError(messages.errorTitle, description);
        return { data: result.data, errorMessage: description };
      }
      return { data: result.data, errorMessage: null };
    } catch (error) {
      const timeout = isAuthTimeout(error);
      const description = timeout
        ? messages.timeoutDescription
        : error instanceof Error && error.message
          ? error.message
          : messages.fallbackError;
      showError(timeout ? messages.timeoutTitle : messages.errorTitle, description);
      return { data: undefined, errorMessage: description };
    }
  }

  return { run, showError, toasts };
}
