import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log('Starting weekly toilet coins transfer...');

        const { error } = await supabase.rpc('transfer_toilet_coins_weekly');

        if (error) {
            console.error('Error executing weekly toilet coins transfer:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        console.log('Successfully completed weekly toilet coins transfer.');
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error('Fatal error in weekly-coin-transfer:', error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});
