import React, { useState, useRef, useEffect } from "react";
import { Send, Code, AlertCircle, Lightbulb, Trash2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string, action?: string) => void;
  onClear: () => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, onClear, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleQuickAction = (action: string, prefix: string) => {
    if (isLoading) return;
    const message = input.trim() ? `${prefix}\n\n${input.trim()}` : prefix;
    onSend(message, action);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-border bg-card p-3">
      {/* Quick Actions */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          onClick={() => handleQuickAction("analyze", "請分析以下程式碼：")}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <Code size={14} />
          分析程式碼
        </button>
        <button
          onClick={() => handleQuickAction("explain", "請解釋以下錯誤訊息：")}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          <AlertCircle size={14} />
          解釋錯誤
        </button>
        <button
          onClick={() => handleQuickAction("improve", "請建議如何改進以下程式碼：")}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          <Lightbulb size={14} />
          建議改進
        </button>
        <button
          onClick={onClear}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 ml-auto"
        >
          <Trash2 size={14} />
          清除對話
        </button>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="輸入訊息或貼上程式碼..."
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
