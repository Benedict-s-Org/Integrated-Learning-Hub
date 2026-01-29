import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { parseCSVQuestions, validateImportedQuestions } from '../../utils/importParsers';

interface CSVImporterProps {
  title: string;
  description: string;
  onImport: (questions: any[], setTitle: string, setDescription: string) => void;
  onCancel: () => void;
}

export function CSVImporter({ title, description, onImport, onCancel }: CSVImporterProps) {
  const [csvContent, setCsvContent] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      parseAndValidate(content);
    };
    reader.readAsText(file);
  };

  const parseAndValidate = (content: string) => {
    const parsed = parseCSVQuestions(content);
    const { valid, errors: validationErrors } = validateImportedQuestions(parsed);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setParsedQuestions([]);
    } else {
      setErrors([]);
      setParsedQuestions(valid);
      setStep('preview');
    }
  };

  const handleManualPaste = () => {
    if (!csvContent.trim()) {
      setErrors(['Please paste CSV content']);
      return;
    }
    parseAndValidate(csvContent);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Import from CSV</h2>

      {step === 'upload' ? (
        <div className="space-y-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <Upload className="w-12 h-12 mx-auto text-blue-600 mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">Drop your CSV file here</p>
            <p className="text-gray-600">or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or paste CSV content</span>
            </div>
          </div>

          <div>
            <textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Paste your CSV content here..."
              rows={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          {errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 mb-2">Import errors:</p>
                  <ul className="space-y-1">
                    {errors.map((error, idx) => (
                      <li key={idx} className="text-sm text-red-700">• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleManualPaste}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Parse CSV
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">
                Successfully parsed {parsedQuestions.length} questions
              </p>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {parsedQuestions.map((q, idx) => (
              <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                <p className="font-semibold text-gray-900 mb-2">Q{idx + 1}: {q.question}</p>
                <div className="space-y-1 mb-3">
                  {q.choices.map((choice: string, choiceIdx: number) => (
                    <div
                      key={choiceIdx}
                      className={`text-sm p-2 rounded ${
                        choiceIdx === q.correct_answer_index
                          ? 'bg-green-100 text-green-900 font-medium'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {String.fromCharCode(65 + choiceIdx)}. {choice}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p className="text-xs text-gray-600 italic">💡 {q.explanation}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onImport(parsedQuestions, title, description)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Import {parsedQuestions.length} Questions
            </button>
            <button
              onClick={() => {
                setStep('upload');
                setCsvContent('');
                setParsedQuestions([]);
              }}
              className="px-6 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}