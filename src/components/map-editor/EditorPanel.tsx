import React from "react";

interface EditorPanelProps {
    children: React.ReactNode;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ children }) => {
    return <div className="space-y-4">{children}</div>;
};
