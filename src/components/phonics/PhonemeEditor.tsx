import React, { useState, useEffect, useRef } from "react";
import { X, Upload, Sparkles, Play, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PhonicsSound {
  id: string;
  sound_code: string;
  display_name: string;
  audio_url: string;
  category: string | null;
  sort_order: number | null;
}

interface PhonemeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  existingSound?: PhonicsSound;
  onSave: (data: Partial<PhonicsSound>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onUploadAudio: (file: File) => Promise<string>;
  onGenerateTTS: (text: string) => Promise<string>;
}

const categories = [
  { value: "vowel", label: "母音 Vowels", color: "bg-red-500" },
  { value: "consonant", label: "子音 Consonants", color: "bg-blue-500" },
  { value: "digraph", label: "雙字母 Digraphs", color: "bg-green-500" },
  { value: "blend", label: "混合音 Blends", color: "bg-amber-500" },
];

export function PhonemeEditor({
  isOpen,
  onClose,
  existingSound,
  onSave,
  onDelete,
  onUploadAudio,
  onGenerateTTS,
}: PhonemeEditorProps) {
  const [displayName, setDisplayName] = useState("");
  const [soundCode, setSoundCode] = useState("");
  const [category, setCategory] = useState("vowel");
  const [audioUrl, setAudioUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (existingSound) {
      setDisplayName(existingSound.display_name);
      setSoundCode(existingSound.sound_code);
      setCategory(existingSound.category || "vowel");
      setAudioUrl(existingSound.audio_url);
      setSortOrder(existingSound.sort_order || 0);
      setTtsText(existingSound.display_name);
    } else {
      setDisplayName("");
      setSoundCode("");
      setCategory("vowel");
      setAudioUrl("");
      setSortOrder(0);
      setTtsText("");
    }
  }, [existingSound, isOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await onUploadAudio(file);
      setAudioUrl(url);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("上傳失敗，請重試");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) {
      alert("請輸入要生成語音的文字");
      return;
    }

    setIsGenerating(true);
    try {
      const url = await onGenerateTTS(ttsText);
      setAudioUrl(url);
    } catch (error) {
      console.error("TTS generation failed:", error);
      alert("語音生成失敗，請重試");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  };

  const handleSave = async () => {
    if (!displayName.trim() || !soundCode.trim()) {
      alert("請填寫顯示名稱和音標代碼");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        display_name: displayName.trim(),
        sound_code: soundCode.trim(),
        category,
        audio_url: audioUrl,
        sort_order: sortOrder,
      });
      onClose();
    } catch (error) {
      console.error("Save failed:", error);
      alert("儲存失敗，請重試");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm("確定要刪除這個 Phoneme 嗎？")) return;

    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("刪除失敗，請重試");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1001] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {existingSound ? "編輯 Phoneme" : "新增 Phoneme"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              顯示文字
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例: A a, SH sh"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Sound Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              音標代碼
            </label>
            <input
              type="text"
              value={soundCode}
              onChange={(e) => setSoundCode(e.target.value)}
              placeholder="例: a, sh, th"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分類
            </label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    category === cat.value
                      ? `${cat.color} text-white shadow-md`
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              排序順序
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Audio Source */}
          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              音檔來源
            </label>

            {/* Upload Option */}
            <div className="flex gap-2 mb-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mp3,audio/mpeg,audio/wav"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Upload size={16} />
                )}
                上傳音檔
              </Button>
            </div>

            {/* TTS Option */}
            <div className="flex gap-2">
              <input
                type="text"
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder="輸入文字生成語音"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <Button
                variant="gold"
                onClick={handleGenerateTTS}
                disabled={isGenerating || !ttsText.trim()}
                className="whitespace-nowrap"
              >
                {isGenerating ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                生成
              </Button>
            </div>

            {/* Audio Preview */}
            {audioUrl && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                <button
                  onClick={handlePreviewAudio}
                  className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
                >
                  <Play size={16} />
                </button>
                <span className="text-sm text-gray-600 truncate flex-1">
                  {audioUrl.split("/").pop() || "音檔已設定"}
                </span>
                <audio ref={audioRef} className="hidden" />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex gap-2">
          {existingSound && onDelete && (
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={isDeleting}
              className="mr-auto"
            >
              {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              刪除
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" size={16} /> : null}
            儲存
          </Button>
        </div>
      </div>
    </div>
  );
}
