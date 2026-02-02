import React, { useState, useRef, useCallback } from "react";
import { Volume2 } from "lucide-react";

interface PhonicsSound {
  id: string;
  sound_code: string;
  display_name: string;
  audio_url: string;
  category: string | null;
  sort_order: number | null;
}

interface PhonemeButtonProps {
  sound: PhonicsSound;
  isPlaying: boolean;
  isAdmin: boolean;
  onPlay: () => void;
  onEdit: () => void;
}

const categoryColors: Record<string, string> = {
  vowel: "from-red-400 to-pink-500",
  consonant: "from-blue-400 to-indigo-500",
  digraph: "from-green-400 to-emerald-500",
  blend: "from-amber-400 to-orange-500",
};

export function PhonemeButton({
  sound,
  isPlaying,
  isAdmin,
  onPlay,
  onEdit,
}: PhonemeButtonProps) {
  const [isPressing, setIsPressing] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const didLongPress = useRef(false);

  const gradientClass = categoryColors[sound.category || "vowel"] || categoryColors.vowel;

  const handleMouseDown = useCallback(() => {
    didLongPress.current = false;
    setIsPressing(true);

    if (isAdmin) {
      longPressTimer.current = setTimeout(() => {
        didLongPress.current = true;
        setIsPressing(false);
        onEdit();
      }, 500);
    }
  }, [isAdmin, onEdit]);

  const handleMouseUp = useCallback(() => {
    setIsPressing(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!didLongPress.current) {
      onPlay();
    }
    didLongPress.current = false;
  }, [onPlay]);

  const handleMouseLeave = useCallback(() => {
    setIsPressing(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    didLongPress.current = false;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseDown();
  }, [handleMouseDown]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseUp();
  }, [handleMouseUp]);

  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`
        relative w-20 h-20 rounded-xl bg-gradient-to-br ${gradientClass}
        flex flex-col items-center justify-center gap-1
        text-white font-bold shadow-lg
        transition-all duration-200 select-none
        hover:scale-110 hover:shadow-xl
        active:scale-95
        ${isPressing ? "scale-95 brightness-90" : ""}
        ${isPlaying ? "ring-4 ring-white/50 animate-pulse" : ""}
      `}
    >
      <span className="text-2xl font-black tracking-wide">
        {sound.display_name}
      </span>
      <Volume2
        size={14}
        className={`opacity-70 ${isPlaying ? "animate-bounce" : ""}`}
      />
      {isAdmin && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full text-[10px] text-yellow-900 flex items-center justify-center font-bold">
          ✎
        </span>
      )}
    </button>
  );
}
