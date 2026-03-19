import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook to check if the current user is the Super Admin (first admin created).
 * Uses the `is_first_admin` RPC from Supabase.
 */
export function useSuperAdmin() {
    const { user, isAdmin, session } = useAuth();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) {
            setIsSuperAdmin(false);
            setLoading(false);
            return;
        }

        const check = async () => {
            try {
                const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                const { data, error } = await supabase.functions.invoke('auth/check-super-admin', {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token || anonKey}`,
                        'apikey': anonKey
                    },
                    body: { adminUserId: user.id }
                });
                if (!error && data) {
                    setIsSuperAdmin(data.isSuperAdmin === true);
                }
            } catch (err) {
                console.error('Failed to check super admin status:', err);
            } finally {
                setLoading(false);
            }
        };

        check();
    }, [user?.id, isAdmin]);

    return { isSuperAdmin, loading };
}
