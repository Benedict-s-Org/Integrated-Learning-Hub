import { useState, useCallback } from "react";
import type { FormDefinition, FormItem } from "../../types/forms";

interface Props {
  definition: FormDefinition;
  onSubmit: (answers: Record<string, any>) => void;
  submitText?: string;
}

export default function FormRenderer({ definition, onSubmit, submitText = "Submit" }: Props) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const primary = definition.theme?.primary ?? "#673ab7";
  const isPaginated = definition.navigation?.mode === "sections" && definition.sections.length > 1;

  const setAnswer = useCallback((id: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    // Clear error on change
    setErrors((prev) => ({ ...prev, [id]: false }));
  }, []);

  // Collect all items across sections
  const allItems: FormItem[] = definition.sections.flatMap((s) => s.items);

  const validateItems = (items: FormItem[]): boolean => {
    const nextErrors: Record<string, boolean> = { ...errors };
    for (const item of items) {
      delete nextErrors[item.id];
    }
    
    let valid = true;
    for (const item of items) {
      if (item.type === "info") continue;
      const isRequired = "required" in item ? item.required : false;
      if (!isRequired) continue;

      const val = answers[item.id];
      let empty = false;

      switch (item.type) {
        case "consent":
          empty = val !== true;
          break;
        case "short_text":
        case "paragraph":
        case "multiple_choice":
          empty = !val || (typeof val === "string" && val.trim() === "");
          break;
        case "checkboxes":
          empty = !val || !Array.isArray(val) || val.length === 0;
          break;
        case "linear_scale":
        case "number":
          empty = val === undefined || val === null || val === "";
          break;
      }

      if (empty) {
        nextErrors[item.id] = true;
        valid = false;
      }
    }
    setErrors(nextErrors);
    return valid;
  };

  const handleNext = () => {
    const currentItems = definition.sections[currentSectionIndex].items;
    if (validateItems(currentItems)) {
      setCurrentSectionIndex((prev) => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    setCurrentSectionIndex((prev) => prev - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = () => {
    const itemsToValidate = isPaginated
      ? definition.sections[currentSectionIndex].items
      : allItems;
    if (validateItems(itemsToValidate)) {
      onSubmit(answers);
    }
  };

  // ─── Render individual item ──────────────────────────────────────
  const renderItem = (item: FormItem) => {
    const hasError = errors[item.id];

    switch (item.type) {
      case "info":
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl border p-5"
            style={{ borderColor: "#dadce0" }}
          >
            {/* SECURITY: html is admin-controlled via CMS; not user-generated */}
            <div dangerouslySetInnerHTML={{ __html: item.html }} />
          </div>
        );

      case "consent":
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl border p-5"
            style={{ borderColor: hasError ? "#d93025" : "#dadce0" }}
          >
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <div className="relative flex items-center mt-0.5">
                <input
                  type="checkbox"
                  checked={!!answers[item.id]}
                  onChange={(e) => setAnswer(item.id, e.target.checked)}
                  className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded border-2 transition-all"
                  style={{
                    borderColor: answers[item.id] ? primary : "#5f6368",
                    backgroundColor: answers[item.id] ? primary : "transparent",
                  }}
                />
                <svg
                  className="absolute left-[3px] top-[3px] h-3 w-3 stroke-white opacity-0 transition-opacity peer-checked:opacity-100 pointer-events-none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-sm text-[#202124] leading-relaxed font-medium">
                {item.label}
                {item.required && <span className="text-[#d93025] ml-1">*</span>}
              </span>
            </label>
            {hasError && (
              <p className="text-xs text-[#d93025] mt-2 font-medium">This question is required</p>
            )}
          </div>
        );

      case "short_text":
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl border p-5 space-y-3"
            style={{ borderColor: hasError ? "#d93025" : "#dadce0" }}
          >
            <p className="text-sm text-[#202124] font-medium">
              {item.title}
              {item.required && <span className="text-[#d93025] ml-1">*</span>}
            </p>
            <textarea
              value={answers[item.id] ?? ""}
              onChange={(e) => setAnswer(item.id, e.target.value)}
              placeholder={item.placeholder || "Your answer"}
              rows={1}
              className="w-full md:w-2/3 border-b-2 pb-1 bg-transparent focus:outline-none transition-colors text-sm text-[#202124] resize-y min-h-[32px] overflow-y-auto"
              style={{
                borderColor: hasError ? "#d93025" : answers[item.id] ? primary : "#dadce0",
                height: (answers[item.id] || "").includes('\n') ? 'auto' : '32px'
              }}
            />
            {hasError && (
              <p className="text-xs text-[#d93025] font-medium">This question is required</p>
            )}
          </div>
        );

      case "paragraph":
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl border p-5 space-y-3"
            style={{ borderColor: hasError ? "#d93025" : "#dadce0" }}
          >
            <p className="text-sm text-[#202124] font-medium">
              {item.title}
              {item.required && <span className="text-[#d93025] ml-1">*</span>}
            </p>
            <textarea
              value={answers[item.id] ?? ""}
              onChange={(e) => setAnswer(item.id, e.target.value)}
              placeholder={item.placeholder || "Your answer"}
              rows={3}
              className="w-full border-b-2 pb-1 bg-transparent focus:outline-none transition-colors resize-none text-sm text-[#202124]"
              style={{
                borderColor: hasError ? "#d93025" : answers[item.id] ? primary : "#dadce0",
              }}
            />
            {hasError && (
              <p className="text-xs text-[#d93025] font-medium">This question is required</p>
            )}
          </div>
        );

      case "multiple_choice":
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl border p-5 space-y-3"
            style={{ borderColor: hasError ? "#d93025" : "#dadce0" }}
          >
            <p className="text-sm text-[#202124] font-medium">
              {item.title}
              {item.required && <span className="text-[#d93025] ml-1">*</span>}
            </p>
            <div className="space-y-2">
              {item.options.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-3 py-1 cursor-pointer hover:bg-[#f8f9fa] rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div
                    className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                    style={{
                      borderColor: answers[item.id] === opt ? primary : "#5f6368",
                    }}
                  >
                    {answers[item.id] === opt && (
                      <div
                        className="w-[10px] h-[10px] rounded-full"
                        style={{ backgroundColor: primary }}
                      />
                    )}
                  </div>
                  <span className="text-sm text-[#202124]">{opt}</span>
                </label>
              ))}
            </div>
            {hasError && (
              <p className="text-xs text-[#d93025] font-medium">This question is required</p>
            )}
          </div>
        );

      case "checkboxes":
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl border p-5 space-y-3"
            style={{ borderColor: hasError ? "#d93025" : "#dadce0" }}
          >
            <p className="text-sm text-[#202124] font-medium">
              {item.title}
              {item.required && <span className="text-[#d93025] ml-1">*</span>}
            </p>
            <div className="space-y-2">
              {item.options.map((opt) => {
                const checked = (answers[item.id] as string[] | undefined)?.includes(opt) ?? false;
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-3 py-1 cursor-pointer hover:bg-[#f8f9fa] rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const cur = (answers[item.id] as string[]) || [];
                          const next = checked
                            ? cur.filter((v) => v !== opt)
                            : [...cur, opt];
                          setAnswer(item.id, next);
                        }}
                        className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded border-2 transition-all"
                        style={{
                          borderColor: checked ? primary : "#5f6368",
                          backgroundColor: checked ? primary : "transparent",
                        }}
                      />
                      <svg
                        className="absolute left-[3px] top-[3px] h-3 w-3 stroke-white opacity-0 transition-opacity peer-checked:opacity-100 pointer-events-none"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-sm text-[#202124]">{opt}</span>
                  </label>
                );
              })}
            </div>
            {hasError && (
              <p className="text-xs text-[#d93025] font-medium">This question is required</p>
            )}
          </div>
        );

      case "linear_scale": {
        const scale = Array.from(
          { length: item.max - item.min + 1 },
          (_, i) => item.min + i
        );
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl border p-5 space-y-3"
            style={{ borderColor: hasError ? "#d93025" : "#dadce0" }}
          >
            <p className="text-sm text-[#202124] font-medium">
              {item.title}
              {item.required && <span className="text-[#d93025] ml-1">*</span>}
            </p>
            <div className="flex items-center gap-1 flex-wrap">
              {item.minLabel && (
                <span className="text-xs text-[#5f6368] mr-2 shrink-0">{item.minLabel}</span>
              )}
              <div className="flex gap-1 flex-wrap justify-center flex-1">
                {scale.map((n) => {
                  const selected = answers[item.id] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswer(item.id, n)}
                      className="w-10 h-10 rounded-full text-sm font-medium transition-all border-2 flex items-center justify-center"
                      style={{
                        borderColor: selected ? primary : "#dadce0",
                        backgroundColor: selected ? primary : "transparent",
                        color: selected ? "#fff" : "#202124",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {item.maxLabel && (
                <span className="text-xs text-[#5f6368] ml-2 shrink-0">{item.maxLabel}</span>
              )}
            </div>
            {hasError && (
              <p className="text-xs text-[#d93025] font-medium">This question is required</p>
            )}
          </div>
        );
      }

      case "number":
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl border p-5 space-y-3"
            style={{ borderColor: hasError ? "#d93025" : "#dadce0" }}
          >
            <p className="text-sm text-[#202124] font-medium">
              {item.title}
              {item.required && <span className="text-[#d93025] ml-1">*</span>}
            </p>
            <input
              type="number"
              value={answers[item.id] ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                setAnswer(item.id, raw === "" ? "" : Number(raw));
              }}
              min={item.min}
              max={item.max}
              placeholder={item.placeholder || ""}
              className="w-full md:w-1/3 border-b-2 pb-1 bg-transparent focus:outline-none transition-colors text-sm text-[#202124]"
              style={{
                borderColor: hasError ? "#d93025" : answers[item.id] !== undefined && answers[item.id] !== "" ? primary : "#dadce0",
              }}
            />
            {hasError && (
              <p className="text-xs text-[#d93025] font-medium">This question is required</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "#f1f3f4" }}>
      <div className="max-w-[720px] mx-auto space-y-3">
        {/* ─── Intro card (title + description) ───────────────────── */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#dadce0" }}>
          {/* Theme bar */}
          <div
            className="h-[10px] rounded-t-xl"
            style={{ backgroundColor: primary }}
          />
          <div className="p-6 space-y-2">
            <h1 className="text-2xl font-semibold text-[#202124]">{definition.title}</h1>
            {definition.description && (
              <p className="text-sm text-[#5f6368]">{definition.description}</p>
            )}
          </div>
        </div>

        {/* ─── Sections & Items ────────────────────────────────────── */}
        {(isPaginated ? [definition.sections[currentSectionIndex]] : definition.sections).map((section) => (
          <div key={section.id} className="space-y-3">
            {(section.title || section.description) && (
              <div
                className="bg-white rounded-xl border p-5 space-y-1"
                style={{ borderColor: "#dadce0" }}
              >
                {section.title && (
                  <h2 className="text-base font-semibold text-[#202124]">{section.title}</h2>
                )}
                {section.description && (
                  <p className="text-sm text-[#5f6368]">{section.description}</p>
                )}
              </div>
            )}
            {section.items.map((item) => renderItem(item))}
          </div>
        ))}

        {/* ─── Navigation Buttons ──────────────────────────────────────── */}
        {isPaginated ? (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentSectionIndex > 0 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-2.5 rounded-md text-sm font-medium text-slate-700 bg-white border border-[#dadce0] hover:bg-slate-50 transition-colors"
                  >
                    {definition.sections[currentSectionIndex].backButtonText || "Back"}
                  </button>
                ) : <div />}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[#5f6368] font-medium hidden sm:inline-block">
                  Page {currentSectionIndex + 1} of {definition.sections.length}
                </span>
                {currentSectionIndex < definition.sections.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-8 py-2.5 rounded-md text-sm font-medium text-white transition-colors hover:opacity-90 active:scale-[0.97]"
                    style={{ backgroundColor: primary }}
                  >
                    {definition.sections[currentSectionIndex].nextButtonText || "Next"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-8 py-2.5 rounded-md text-sm font-medium text-white transition-colors hover:opacity-90 active:scale-[0.97]"
                    style={{ backgroundColor: primary }}
                  >
                    {submitText}
                  </button>
                )}
              </div>
            </div>
            {/* Mobile progress indicator */}
            <span className="text-xs text-[#5f6368] font-medium text-center block sm:hidden">
              Page {currentSectionIndex + 1} of {definition.sections.length}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-8 py-2.5 rounded-md text-sm font-medium text-white transition-colors hover:opacity-90 active:scale-[0.97]"
              style={{ backgroundColor: primary }}
            >
              {submitText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
