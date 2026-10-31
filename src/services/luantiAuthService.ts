import { supabase } from '@/integrations/supabase/client';

export interface LuantiJoinCredentials {
  luantiUsername: string;
  password: string;
  serverHost: string;
  serverPort: number;
  expiresAt: string;
  joinHintSeconds?: number;
}

function functionsBaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw new Error('VITE_SUPABASE_URL is not configured');
  return `${url.replace(/\/$/, '')}/functions/v1/luanti-auth`;
}

export const luantiAuthService = {
  async mintJoin(): Promise<LuantiJoinCredentials> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      throw new Error('You must be signed in to enter Learning Community');
    }

    const response = await fetch(`${functionsBaseUrl()}/mint-join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
        apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '',
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Failed to mint join credentials (${response.status})`);
    }

    return {
      luantiUsername: payload.luantiUsername,
      password: payload.password,
      serverHost:
        (import.meta.env.VITE_LUANTI_SERVER_HOST as string | undefined) ||
        payload.serverHost ||
        '127.0.0.1',
      serverPort: Number(
        (import.meta.env.VITE_LUANTI_SERVER_PORT as string | undefined) ||
          payload.serverPort ||
          30000,
      ),
      expiresAt: payload.expiresAt,
      joinHintSeconds: Number(payload.joinHintSeconds ?? 3),
    };
  },
};
