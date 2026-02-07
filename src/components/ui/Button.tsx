import React from "react";
import { LucideIcon } from "lucide-react";

interface ButtonProps {
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost" | "gold";
  className?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  type?: "button" | "submit" | "reset";
}

const variants = {
  primary: "bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95",
  secondary: "bg-white text-primary border-2 border-primary/20 hover:bg-secondary hover:border-primary/40 hover:scale-105 active:scale-95",
  success: "bg-emerald-400 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-400/20 hover:scale-105 active:scale-95",
  danger: "bg-rose-400 text-white hover:bg-rose-500 shadow-lg shadow-rose-400/20 hover:scale-105 active:scale-95",
  ghost: "bg-transparent text-primary/60 hover:bg-primary/5 hover:text-primary",
  gold: "bg-amber-400 text-amber-900 hover:bg-amber-300 font-bold shadow-lg shadow-amber-400/30 hover:scale-105 active:scale-95",
};

export const Button: React.FC<ButtonProps> = ({
  onClick,
  onMouseDown,
  children,
  variant = "primary",
  className = "",
  disabled = false,
  icon: Icon,
  type = "button",
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
      className={`px-6 py-2.5 rounded-full font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={20} />}
      {children}
    </button>
  );
};
