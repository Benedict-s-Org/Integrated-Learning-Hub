import { useState } from "react";
import type { Demographics as DemographicsData } from "../types/experiment";

interface Props {
  onComplete: (data: DemographicsData) => void;
}

export default function Demographics({ onComplete }: Props) {
  const [form, setForm] = useState<DemographicsData>({
    age: "",
    gender: "",
    education: "",
    nativeLanguage: "",
    englishProficiency: "",
  });

  const update = (field: keyof DemographicsData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isValid =
    form.age &&
    form.gender &&
    form.education &&
    form.nativeLanguage &&
    form.englishProficiency;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <h1 className="text-2xl font-bold text-gray-900">
            Background Information
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Please provide some basic information before we begin.
          </p>
        </div>

        {/* Age */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Age
          </label>
          <input
            type="number"
            min="16"
            max="99"
            value={form.age}
            onChange={(e) => update("age", e.target.value)}
            placeholder="Enter your age"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Gender
          </label>
          <div className="grid grid-cols-3 gap-2">
            {["Male", "Female", "Other"].map((g) => (
              <button
                key={g}
                onClick={() => update("gender", g.toLowerCase())}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                  form.gender === g.toLowerCase()
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Education */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Education Level
          </label>
          <select
            value={form.education}
            onChange={(e) => update("education", e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors bg-white"
          >
            <option value="">Select...</option>
            <option value="secondary">Secondary school</option>
            <option value="undergraduate">Undergraduate student</option>
            <option value="bachelor">Bachelor's degree</option>
            <option value="master">Master's student / degree</option>
            <option value="phd">PhD student / degree</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Native Language */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Native Language
          </label>
          <select
            value={form.nativeLanguage}
            onChange={(e) => update("nativeLanguage", e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors bg-white"
          >
            <option value="">Select...</option>
            <option value="english">English</option>
            <option value="chinese">Chinese (Mandarin / Cantonese)</option>
            <option value="spanish">Spanish</option>
            <option value="hindi">Hindi</option>
            <option value="arabic">Arabic</option>
            <option value="french">French</option>
            <option value="japanese">Japanese</option>
            <option value="korean">Korean</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* English Proficiency */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            English Proficiency
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "native", label: "Native speaker" },
              { value: "c1c2", label: "Advanced (C1–C2)" },
              { value: "b2", label: "Upper-intermediate (B2)" },
              { value: "b1", label: "Intermediate (B1)" },
              { value: "a2", label: "Elementary (A2)" },
              { value: "a1", label: "Beginner (A1)" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => update("englishProficiency", opt.value)}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all border-2 ${
                  form.englishProficiency === opt.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onComplete(form)}
          disabled={!isValid}
          className={`w-full py-3 rounded-xl font-semibold text-lg transition-all ${
            isValid
              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isValid ? "Continue →" : "Please fill in all fields"}
        </button>
      </div>
    </div>
  );
}
