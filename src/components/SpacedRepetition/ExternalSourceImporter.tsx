import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, Copy, Check } from 'lucide-react';
import {
  parseNotionJSON,
  parseAnkiJSON,
  validateImportedQuestions,
} from '../../utils/importParsers';

interface ExternalSourceImporterProps {
  source: 'notion' | 'anki' | 'google';
  title: string;
  description: string;
  onImport: (questions: any[], setTitle: string, setDescription: string) => void;
  onCancel: () => void;
}

export function ExternalSourceImporter({
  source,
  title,
  description,
  onImport,
  onCancel,
}: ExternalSourceImporterProps) {
  const [jsonContent, setJsonContent] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sourceConfig = {
    notion: {
      title: 'Import from Notion',
      instructions: [
        'Open your Notion database with questions',
        'Click the ⋯ menu → Export → Markdown & CSV → JSON',
        'Save and upload the JSON file below',
      ],
    },
    anki: {
      title: 'Import from Anki',
      instructions: [
        'In Anki, select your deck',
        'File → Export → Format: JSON',
        'Uncheck "Include scheduling information"',
        'Export and upload the file below',
      ],
    },
    google: {
      title: 'Import from Google Sheets',
      instructions: [
        'Open your Google Sheets with questions',
        'File → Download → Comma-separated values (.csv)',
        'Upload the CSV file below',
      ],
    },
  };

  const config = sourceConfig[source];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonContent(content);
      parseAndValidate(content);
    };
    reader.readAsText(file);
  };

  const parseAndValidate = (content: string) => {
    let parsed: any[] = [];

    try {
      if (source === 'notion') {
        parsed = parseNotionJSON(content);
      } else if (source === 'anki') {
        parsed = parseAnkiJSON(content);
      } else if (source === 'google') {
        const lines = content.split('\n');
        const firstLine = lines[0];
        const isCSV = firstLine.includes(',');
        if (!isCSV) {
          setErrors(['This doesn\'t appear to be CSV format']);
          return;
        }
        parsed = parseGoogleSheets(content);
      }

      const { valid, errors: validationErrors } = validateImportedQuestions(parsed);

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setParsedQuestions([]);
      } else {
        setErrors([]);
        setParsedQuestions(valid);
        setStep('preview');
      }
    } catch (error) {
      setErrors([`Failed to parse ${source} file: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  const parseGoogleSheets = (csv: string) => {
    const lines = csv.trim().split('\n');
    const questions: any[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const columns = parseCSVRow(line);
      if (columns.length >= 6) {
        const [question, choice1, choice2, choice3, choice4, correctIndex] = columns;
        questions.push({
          question: question.trim(),
          choices: [choice1.trim(), choice2.trim(), choice3.trim(), choice4.trim()],
          correct_answer_index: parseInt(correctIndex || '0', 10),
          explanation: '',
          difficulty: 'medium',
          tags: [],
        });
      }
    }

    return questions;
  };

  const parseCSVRow = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleManualPaste = () => {
    if (!jsonContent.trim()) {
      setErrors(['Please paste content']);
      return;
    }
    parseAndValidate(jsonContent);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{config.title}</h2>

      {step === 'upload' ? (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">How to export:</h3>
            <ol className="space-y-2">
              {config.instructions.map((instruction, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-gray-700">
                  <span className="font-semibold text-blue-600 flex-shrink-0">{idx + 1}.</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <Upload className="w-12 h-12 mx-auto text-blue-600 mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">Drop file here</p>
            <p className="text-gray-600">or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={source === 'google' ? '.csv' : '.json'}
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or paste content</span>
            </div>
          </div>

          <div>
            <textarea
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              placeholder={`Paste your ${source === 'google' ? 'CSV' : 'JSON'} content here...`}
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
              Parse Content
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
                setJsonContent('');
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