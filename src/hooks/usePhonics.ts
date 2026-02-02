import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PhonicsSound {
  id: string;
  sound_code: string;
  display_name: string;
  audio_url: string;
  category: string | null;
  sort_order: number | null;
  created_at: string | null;
}

export function usePhonics() {
  const [sounds, setSounds] = useState<PhonicsSound[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSounds = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("phonics_sounds")
        .select("*")
        .order("category")
        .order("sort_order", { ascending: true });

      if (fetchError) throw fetchError;
      setSounds(data || []);
    } catch (err) {
      console.error("Failed to fetch sounds:", err);
      setError("載入失敗，請重試");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addSound = useCallback(async (data: Partial<PhonicsSound>) => {
    if (!data.sound_code || !data.display_name) {
      throw new Error("Missing required fields");
    }

    const { data: newSound, error: insertError } = await supabase
      .from("phonics_sounds")
      .insert({
        sound_code: data.sound_code,
        display_name: data.display_name,
        audio_url: data.audio_url || "",
        category: data.category || "vowel",
        sort_order: data.sort_order || 0,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    
    setSounds((prev) => [...prev, newSound]);
    return newSound;
  }, []);

  const updateSound = useCallback(async (id: string, data: Partial<PhonicsSound>) => {
    const { data: updatedSound, error: updateError } = await supabase
      .from("phonics_sounds")
      .update({
        sound_code: data.sound_code,
        display_name: data.display_name,
        audio_url: data.audio_url,
        category: data.category,
        sort_order: data.sort_order,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    setSounds((prev) =>
      prev.map((s) => (s.id === id ? updatedSound : s))
    );
    return updatedSound;
  }, []);

  const deleteSound = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from("phonics_sounds")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    setSounds((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const uploadAudio = useCallback(async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("phonics-audio")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("phonics-audio")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }, []);

  const generateTTS = useCallback(async (text: string): Promise<string> => {
    const response = await fetch(
      `https://lpyhtbvycxqjjqpwjxyh.supabase.co/functions/v1/tts-phonics`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg",
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg`,
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!response.ok) {
      throw new Error("TTS generation failed");
    }

    // Get the audio blob and upload to storage
    const audioBlob = await response.blob();
    const fileName = `tts-${crypto.randomUUID()}.mp3`;
    const filePath = `generated/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("phonics-audio")
      .upload(filePath, audioBlob, {
        contentType: "audio/mpeg",
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("phonics-audio")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }, []);

  return {
    sounds,
    isLoading,
    error,
    fetchSounds,
    addSound,
    updateSound,
    deleteSound,
    uploadAudio,
    generateTTS,
  };
}
