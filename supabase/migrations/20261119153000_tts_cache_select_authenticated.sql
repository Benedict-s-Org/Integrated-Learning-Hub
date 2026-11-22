-- Allow signed-in users to look up shared Drive TTS bindings for Preview reuse.
-- Writes stay service-role / Edge Function only (no INSERT/UPDATE/DELETE policies here).

DROP POLICY IF EXISTS "Authenticated users can read tts_cache" ON public.tts_cache;

CREATE POLICY "Authenticated users can read tts_cache"
  ON public.tts_cache
  FOR SELECT
  TO authenticated
  USING (true);
