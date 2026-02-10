import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning";
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant = "default", ...props }, ref) => {
        const variants = {
            default: "border-transparent bg-blue-500 text-white hover:bg-blue-600",
            secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200",
            outline: "text-slate-950 border-slate-200 hover:bg-slate-100",
            destructive: "border-transparent bg-red-500 text-white hover:bg-red-600",
            success: "border-transparent bg-green-500 text-white hover:bg-green-600",
            warning: "border-transparent bg-yellow-400 text-yellow-900 hover:bg-yellow-500",
        };

        return (
            <div
                ref={ref}
                className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    variants[variant],
                    className
                )}
                {...props}
            />
        );
    }
);
Badge.displayName = "Badge";
