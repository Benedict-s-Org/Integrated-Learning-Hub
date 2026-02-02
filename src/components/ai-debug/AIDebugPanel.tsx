import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Minimize2, Maximize2, Bot, GripHorizontal } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import type { Message } from "@/hooks/useAIDebug";

interface AIDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  onSend: (message: string, action?: string) => void;
  onClear: () => void;
}

export function AIDebugPanel({
  isOpen,
  onClose,
  messages,
  isLoading,
  error,
  onSend,
  onClear,
}: AIDebugPanelProps) {
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [size, setSize] = useState({ width: 420, height: 520 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized]);

  // Handle drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y)),
      });
    }
    if (isResizing) {
      setSize({
        width: Math.max(320, e.clientX - position.x),
        height: Math.max(300, e.clientY - position.y),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, position.x, position.y]);

  if (!isOpen) return null;

  const panelContent = (
    <div
      className="fixed z-[9999] flex flex-col bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 280 : size.width,
        height: isMinimized ? "auto" : size.height,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={16} className="opacity-60" />
          <Bot size={18} />
          <span className="font-semibold text-sm">AI 除錯助手</span>
        </div>
        <div className="flex items-center gap-1" data-no-drag>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">開始對話來分析程式碼或解釋錯誤</p>
                <p className="text-xs mt-1">可使用快速動作按鈕或直接輸入</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs">思考中...</span>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-3 text-sm">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <ChatInput onSend={onSend} onClear={onClear} isLoading={isLoading} />

          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
            }}
          >
            <svg
              className="w-full h-full text-muted-foreground/50"
              viewBox="0 0 16 16"
            >
              <path
                fill="currentColor"
                d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z"
              />
            </svg>
          </div>
        </>
      )}
    </div>
  );

  return createPortal(panelContent, document.body);
}
