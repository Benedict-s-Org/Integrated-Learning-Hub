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
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
  success: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
  danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
  gold: "bg-amber-400 text-amber-900 hover:bg-amber-300 font-bold",
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
      className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};
