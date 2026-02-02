import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Volume2, VolumeX, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PhonicsSound {
  id: string;
  sound_code: string;
  display_name: string;
  audio_url: string;
  category: string;
  sort_order: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  vowel: "母音 Vowels",
  consonant: "子音 Consonants",
  digraph: "雙字母 Digraphs",
  blend: "混合音 Blends",
};

const CATEGORY_COLORS: Record<string, string> = {
  vowel: "from-red-400 to-pink-500",
  consonant: "from-blue-400 to-indigo-500",
  digraph: "from-green-400 to-emerald-500",
  blend: "from-amber-400 to-orange-500",
};

const SoundCard = ({
  sound,
  isPlaying,
  onPlay,
}: {
  sound: PhonicsSound;
  isPlaying: boolean;
  onPlay: () => void;
}) => {
  const colorClass = CATEGORY_COLORS[sound.category] || "from-gray-400 to-gray-500";

  return (
    <button
      onClick={onPlay}
      className={`
        relative overflow-hidden rounded-2xl p-4 sm:p-6
        bg-gradient-to-br ${colorClass}
        text-white font-bold text-2xl sm:text-3xl
        shadow-lg hover:shadow-xl
        transform transition-all duration-200
        hover:scale-105 active:scale-95
        ${isPlaying ? "ring-4 ring-white ring-opacity-75 animate-pulse" : ""}
        focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50
      `}
    >
      <div className="flex flex-col items-center justify-center gap-1">
        <span className="drop-shadow-md">{sound.display_name}</span>
        <span className="text-xs sm:text-sm opacity-75 font-normal">
          {isPlaying ? (
            <Volume2 className="w-4 h-4 animate-bounce" />
          ) : (
            <VolumeX className="w-4 h-4 opacity-50" />
          )}
        </span>
      </div>

      {/* Decorative elements */}
      <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
      <div className="absolute -bottom-2 -left-2 w-12 h-12 bg-black/10 rounded-full blur-lg" />
    </button>
  );
};

export const PhonicsSoundWall = () => {
  const navigate = useNavigate();
  const [sounds, setSounds] = useState<PhonicsSound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchSounds = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("phonics_sounds")
          .select("*")
          .order("sort_order");

        if (fetchError) throw fetchError;
        setSounds(data || []);
      } catch (err) {
        console.error("Error fetching phonics sounds:", err);
        setError("無法載入音檔資料");
      } finally {
        setLoading(false);
      }
    };

    fetchSounds();
  }, []);

  const playSound = (sound: PhonicsSound) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If clicking on the same sound that's playing, just stop it
    if (playingId === sound.id) {
      setPlayingId(null);
      return;
    }

    // Play the new sound
    const audio = new Audio(sound.audio_url);
    audioRef.current = audio;
    setPlayingId(sound.id);

    audio.play().catch((err) => {
      console.error("Error playing audio:", err);
      setPlayingId(null);
    });

    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };

    audio.onerror = () => {
      console.error("Audio error for:", sound.audio_url);
      setPlayingId(null);
      audioRef.current = null;
    };
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Group sounds by category
  const groupedSounds = sounds.reduce(
    (acc, sound) => {
      const category = sound.category || "other";
      if (!acc[category]) acc[category] = [];
      acc[category].push(sound);
      return acc;
    },
    {} as Record<string, PhonicsSound[]>
  );

  // Order categories
  const categoryOrder = ["vowel", "consonant", "digraph", "blend"];
  const orderedCategories = categoryOrder.filter((cat) => groupedSounds[cat]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-full font-medium hover:bg-amber-600 transition-colors shadow-md"
          >
            <ArrowUp className="w-4 h-4" />
            <span>返回房間</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-amber-800">
            🔤 Phonics Sound Wall
          </h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {loading && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="ml-2 text-amber-700">載入中...</span>
          </div>
        )}

        {error && (
          <div className="text-center text-red-500 py-8">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              重試
            </button>
          </div>
        )}

        {!loading && !error && sounds.length === 0 && (
          <div className="text-center text-amber-600 py-12">
            <p className="text-lg">尚無音檔資料</p>
            <p className="text-sm mt-2 opacity-75">
              請聯繫管理員上傳 phonics 音檔
            </p>
          </div>
        )}

        {!loading && !error && sounds.length > 0 && (
          <div className="space-y-8 sm:space-y-12">
            {orderedCategories.map((category) => (
              <section key={category}>
                <h2 className="text-lg sm:text-xl font-bold text-amber-800 mb-4 flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded-full bg-gradient-to-br ${CATEGORY_COLORS[category]}`}
                  />
                  {CATEGORY_LABELS[category] || category}
                </h2>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3">
                  {groupedSounds[category].map((sound) => (
                    <SoundCard
                      key={sound.id}
                      sound={sound}
                      isPlaying={playingId === sound.id}
                      onPlay={() => playSound(sound)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-amber-600 text-sm">
        <p>點擊卡片聆聽發音 · Click a card to hear the sound</p>
      </footer>
    </div>
  );
};
