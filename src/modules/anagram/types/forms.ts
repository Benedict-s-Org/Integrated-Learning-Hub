// ─── Google Forms-like Schema ───────────────────────────────────────
// Used by FormRenderer (participant view) and FormEditor (admin CMS).

export interface FormDefinition {
  title: string;
  description?: string;
  theme?: { primary: string };
  navigation?: { mode: "single_page" | "sections" };
  sections: FormSection[];
}

export interface FormSection {
  id: string;
  title?: string;
  description?: string;
  nextButtonText?: string;
  backButtonText?: string;
  items: FormItem[];
}

export type FormItem =
  | InfoItem
  | ConsentItem
  | ShortTextItem
  | ParagraphItem
  | MultipleChoiceItem
  | CheckboxesItem
  | LinearScaleItem
  | NumberItem;

export interface InfoItem {
  type: "info";
  id: string;
  html: string;
}

export interface ConsentItem {
  type: "consent";
  id: string;
  label: string;
  required?: boolean;
}

export interface ShortTextItem {
  type: "short_text";
  id: string;
  title: string;
  required?: boolean;
  placeholder?: string;
}

export interface ParagraphItem {
  type: "paragraph";
  id: string;
  title: string;
  required?: boolean;
  placeholder?: string;
}

export interface MultipleChoiceItem {
  type: "multiple_choice";
  id: string;
  title: string;
  required?: boolean;
  options: string[];
}

export interface CheckboxesItem {
  type: "checkboxes";
  id: string;
  title: string;
  required?: boolean;
  options: string[];
}

export interface LinearScaleItem {
  type: "linear_scale";
  id: string;
  title: string;
  required?: boolean;
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface NumberItem {
  type: "number";
  id: string;
  title: string;
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
}
