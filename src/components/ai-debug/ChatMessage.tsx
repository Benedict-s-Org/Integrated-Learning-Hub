import React from "react";
import { User, Bot } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

function parseMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = text.split("\n");
  let inCodeBlock = false;
  let codeContent = "";
  let codeLang = "";
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={key++}
            className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-sm font-mono my-2"
          >
            <code>{codeContent.trim()}</code>
          </pre>
        );
        codeContent = "";
        codeLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="font-bold text-base mt-3 mb-1">
          {line.slice(4)}
        </h3>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="font-bold text-lg mt-3 mb-1">
          {line.slice(3)}
        </h2>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key++} className="font-bold text-xl mt-3 mb-1">
          {line.slice(2)}
        </h1>
      );
      continue;
    }

    // List items
    if (line.match(/^[-*] /)) {
      elements.push(
        <li key={key++} className="ml-4 list-disc">
          {parseInline(line.slice(2))}
        </li>
      );
      continue;
    }
    if (line.match(/^\d+\. /)) {
      const match = line.match(/^(\d+)\. (.*)/);
      if (match) {
        elements.push(
          <li key={key++} className="ml-4 list-decimal">
            {parseInline(match[2])}
          </li>
        );
      }
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      elements.push(<br key={key++} />);
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={key++} className="my-1">
        {parseInline(line)}
      </p>
    );
  }

  // Handle unclosed code block
  if (inCodeBlock && codeContent) {
    elements.push(
      <pre
        key={key++}
        className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-sm font-mono my-2"
      >
        <code>{codeContent.trim()}</code>
      </pre>
    );
  }

  return elements;
}

function parseInline(text: string): React.ReactNode {
  // Simple inline parsing for bold, italic, inline code
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={key++}
          className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-sm font-mono"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Normal character
    const nextSpecial = remaining.search(/[`*]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div
        className={`flex-1 max-w-[85%] rounded-xl px-4 py-2 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <div className="text-sm leading-relaxed break-words">
          {parseMarkdown(content)}
        </div>
      </div>
    </div>
  );
}
