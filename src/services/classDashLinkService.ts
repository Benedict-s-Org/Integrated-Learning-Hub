import { supabase } from '@/integrations/supabase/client';
import type { ClassDashErrorCode } from '@/utils/classDashAccess';

export interface ClassDashLinkRow {
  id: string;
  token: string;
  target_class: string;
  is_active: boolean;
  created_at: string;
  rotated_at?: string | null;
  allowed_cidrs?: string[] | null;
}

export interface ClassDashValidateResult {
  target_class: string;
  valid_until?: string;
  link_id?: string;
}

export interface ClassDashBootstrapResult extends ClassDashValidateResult {
  users: any[];
  daily_homework: any | null;
}

type ClassDashResponse<T> = T & { error?: ClassDashErrorCode; message?: string };

async function invokeClassDash<T>(body: Record<string, unknown>): Promise<ClassDashResponse<T>> {
  const { data, error } = await supabase.functions.invoke('class-dash', { body });
  if (error) {
    const msg = error.message || 'Edge function error';
    throw Object.assign(new Error(msg), { code: 'action_rejected' as ClassDashErrorCode });
  }
  const payload = (data || {}) as ClassDashResponse<T>;
  if (payload.error) {
    throw Object.assign(new Error(payload.message || payload.error), {
      code: payload.error as ClassDashErrorCode,
    });
  }
  return payload;
}

export async function validateClassDashLink(token: string): Promise<ClassDashValidateResult> {
  return invokeClassDash<ClassDashValidateResult>({ op: 'validate', token });
}

export async function manageClassDashLink(
  action: 'get' | 'generate' | 'regenerate' | 'disable',
  targetClass: string,
): Promise<{ link?: ClassDashLinkRow | null; success?: boolean }> {
  return invokeClassDash({ op: 'manage', action, target_class: targetClass });
}

export async function bootstrapClassDash(token: string): Promise<ClassDashBootstrapResult> {
  return invokeClassDash<ClassDashBootstrapResult>({ op: 'bootstrap', token });
}

export async function runClassDashAction(
  token: string,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ success?: boolean; id?: string; data?: unknown }> {
  return invokeClassDash({ op: 'action', token, action, payload });
}

export function classDashUrlForToken(token: string): string {
  return `${window.location.origin}/class-dash/${token}`;
}
