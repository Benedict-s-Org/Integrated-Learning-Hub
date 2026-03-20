import { useAuth } from '@/context/AuthContext';

/**
 * Hook to check if the current user is the Super Admin (first admin created).
 * Uses the `is_first_admin` RPC from Supabase.
 */
export function useSuperAdmin() {
    const { realIsSuperAdmin, realIsSuperAdminLoading } = useAuth();
    return { isSuperAdmin: realIsSuperAdmin, loading: realIsSuperAdminLoading };
}
