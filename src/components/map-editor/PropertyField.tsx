import React from "react";

interface PropertyFieldProps {
    label: string;
    children: React.ReactNode;
    className?: string; // Additional classes for the container
}

export const PropertyField: React.FC<PropertyFieldProps> = ({ label, children, className }) => {
    return (
        <div className={className}>
            <label className="block text-xs text-slate-400 mb-1">{label}</label>
            {children}
        </div>
    );
};
