import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "hover" | "flat";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = "default", ...props }, ref) => {
        const variants = {
            default: "bg-white border-2 border-gray-100 shadow-sm rounded-2xl",
            hover: "bg-white border-2 border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 rounded-2xl",
            flat: "bg-slate-50 border border-slate-100 rounded-xl",
        };

        return (
            <div
                ref={ref}
                className={cn(variants[variant], "p-4 md:p-6", className)}
                {...props}
            />
        );
    }
);
Card.displayName = "Card";
