import React, { useState, useRef, useCallback, useEffect } from "react";
import { X, Plus, Volume2 } from "lucide-react";
import { PhonemeButton } from "./PhonemeButton";
import { PhonemeEditor } from "./PhonemeEditor";
import { usePhonics, PhonicsSound } from "@/hooks/usePhonics";
import { Button } from "@/components/ui/Button";

interface PhonicsSoundWallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

const categories = [
  { value: "vowel", label: "母音 Vowels", color: "from-red-400 to-pink-500" },
  { value: "consonant", label: "子音 Consonants", color: "from-blue-400 to-indigo-500" },
  { value: "digraph", label: "雙字母 Digraphs", color: "from-green-400 to-emerald-500" },
  { value: "blend", label: "混合音 Blends", color: "from-amber-400 to-orange-500" },
];

export function PhonicsSoundWallModal({
  isOpen,
  onClose,
  isAdmin,
}: PhonicsSoundWallModalProps) {
  const {
    sounds,
    isLoading,
    error,
    fetchSounds,
    addSound,
    updateSound,
    deleteSound,
    uploadAudio,
    generateTTS,
  } = usePhonics();

  const [activeCategory, setActiveCategory] = useState("vowel");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingSound, setEditingSound] = useState<PhonicsSound | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSounds();
    }
  }, [isOpen, fetchSounds]);

  const filteredSounds = sounds.filter(
    (s) => s.category === activeCategory
  );

  const handlePlay = useCallback((sound: PhonicsSound) => {
    if (!sound.audio_url) {
      alert("此 Phoneme 尚未設定音檔");
      return;
    }

    setPlayingId(sound.id);

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    audioRef.current.src = sound.audio_url;
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.onerror = () => {
      setPlayingId(null);
      alert("播放失敗，請檢查音檔連結");
    };
    audioRef.current.play().catch(() => setPlayingId(null));
  }, []);

  const handleEdit = useCallback((sound: PhonicsSound) => {
    setEditingSound(sound);
    setShowEditor(true);
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingSound(undefined);
    setShowEditor(true);
  }, []);

  const handleSave = useCallback(
    async (data: Partial<PhonicsSound>) => {
      if (editingSound) {
        await updateSound(editingSound.id, data);
      } else {
        await addSound({ ...data, category: activeCategory });
      }
    },
    [editingSound, activeCategory, updateSound, addSound]
  );

  const handleDelete = useCallback(async () => {
    if (editingSound) {
      await deleteSound(editingSound.id);
    }
  }, [editingSound, deleteSound]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/10">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600/80 to-purple-600/80 backdrop-blur p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Volume2 size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Phonics Sound Wall
              </h2>
              <p className="text-sm text-white/70">
                點擊按鈕播放語音{isAdmin ? " · 長按編輯" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeCategory === cat.value
                  ? `bg-gradient-to-r ${cat.color} text-white shadow-lg scale-105`
                  : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-220px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white" />
              <span className="ml-3 text-white/70">載入中...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400">{error}</p>
              <Button variant="secondary" onClick={fetchSounds} className="mt-4">
                重試
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 justify-center">
              {filteredSounds.map((sound) => (
                <PhonemeButton
                  key={sound.id}
                  sound={sound}
                  isPlaying={playingId === sound.id}
                  isAdmin={isAdmin}
                  onPlay={() => handlePlay(sound)}
                  onEdit={() => handleEdit(sound)}
                />
              ))}
              
              {/* Add New Button (Admin Only) */}
              {isAdmin && (
                <button
                  onClick={handleAddNew}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-white/30 flex flex-col items-center justify-center gap-1 text-white/50 hover:text-white hover:border-white/60 transition-all hover:bg-white/10"
                >
                  <Plus size={24} />
                  <span className="text-xs">新增</span>
                </button>
              )}

              {filteredSounds.length === 0 && !isAdmin && (
                <div className="text-center py-8 text-white/50">
                  <p>此分類尚無 Phoneme</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 flex justify-center">
          <Button variant="ghost" onClick={onClose} className="text-white/70 hover:text-white">
            返回房間
          </Button>
        </div>
      </div>

      {/* Editor Modal */}
      <PhonemeEditor
        isOpen={showEditor}
        onClose={() => {
          setShowEditor(false);
          setEditingSound(undefined);
        }}
        existingSound={editingSound}
        onSave={handleSave}
        onDelete={editingSound ? handleDelete : undefined}
        onUploadAudio={uploadAudio}
        onGenerateTTS={generateTTS}
      />
    </div>
  );
}
