import { LucideIcon } from "lucide-react";

export interface EditorTab {
    id: string;
    label: string;
    icon: LucideIcon;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";
