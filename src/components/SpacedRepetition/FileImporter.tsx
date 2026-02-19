import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, CheckCircle, Download, FileSpreadsheet, FileText, ArrowLeft } from 'lucide-react';
import {
    parseCSVQuestions,
    parseXLSXQuestions,
    validateImportedQuestions,
    generateCSVTemplate,
    generateXLSXTemplate,
    ImportedQuestion,
} from '../../utils/importParsers';
import { sortQuestionsByEmbeddedNumber } from '../../utils/questionUtils';

interface FileImporterProps {
    title: string;
    description: string;
    onImport: (questions: ImportedQuestion[], setTitle: string, setDescription: string) => void;
    onCancel: () => void;
}

export function FileImporter({ title: initialTitle, description: initialDescription, onImport, onCancel }: FileImporterProps) {
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);
    const [parsedQuestions, setParsedQuestions] = useState<ImportedQuestion[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [step, setStep] = useState<'upload' | 'preview'>('upload');
    const [fileName, setFileName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [autoSort, setAutoSort] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        setFileName(file.name);
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'xlsx' || ext === 'xls') {
            const reader = new FileReader();
            reader.onload = (event) => {
                const buffer = event.target?.result as ArrayBuffer;
                const parsed = parseXLSXQuestions(buffer);
                handleParsedResult(parsed);
            };
            reader.readAsArrayBuffer(file);
        } else if (ext === 'csv') {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                const parsed = parseCSVQuestions(content);
                handleParsedResult(parsed);
            };
            reader.readAsText(file);
        } else {
            setErrors(['Unsupported file type. Please upload a CSV or XLSX file.']);
        }
    };

    const handleParsedResult = (parsed: ImportedQuestion[]) => {
        if (parsed.length === 0) {
            setErrors(['No valid questions found in the file. Please check the format.']);
            setParsedQuestions([]);
            return;
        }

        const { valid, errors: validationErrors } = validateImportedQuestions(parsed);

        if (validationErrors.length > 0 && valid.length === 0) {
            setErrors(validationErrors);
            setParsedQuestions([]);
        } else {
            setErrors(validationErrors);
            setParsedQuestions(valid);
            setStep('preview');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const downloadCSVTemplate = () => {
        const content = generateCSVTemplate();
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'mcq_template.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadXLSXTemplate = () => {
        const buffer = generateXLSXTemplate();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'mcq_template.xlsx';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const handleImportInternal = () => {
        if (!title.trim()) {
            setErrors(['Please enter a set title']);
            return;
        }
        let finalQuestions = [...parsedQuestions];
        if (autoSort) {
            finalQuestions = sortQuestionsByEmbeddedNumber(finalQuestions);
        }
        onImport(finalQuestions, title, description);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-2xl font-bold text-gray-900">Import from File</h2>
            </div>

            {step === 'upload' ? (
                <div className="space-y-6">
                    {/* Set metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Set Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Biology Chapter 5"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional description..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Template downloads */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={downloadCSVTemplate}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
                        >
                            <Download className="w-4 h-4" />
                            <FileText className="w-4 h-4" />
                            Download CSV Template
                        </button>
                        <button
                            onClick={downloadXLSXTemplate}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                        >
                            <Download className="w-4 h-4" />
                            <FileSpreadsheet className="w-4 h-4" />
                            Download Excel Template
                        </button>
                    </div>

                    {/* Drop zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer ${isDragging
                            ? 'border-blue-500 bg-blue-50 shadow-inner'
                            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
                            }`}
                    >
                        <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
                        <p className="text-lg font-semibold text-gray-800 mb-1">
                            {isDragging ? 'Drop file here' : 'Drag & drop your file here'}
                        </p>
                        <p className="text-gray-500 text-sm">
                            Supports <span className="font-medium">.csv</span> and <span className="font-medium">.xlsx</span> files
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>

                    {/* Errors */}
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
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Success banner */}
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-green-900">
                                    Successfully parsed {parsedQuestions.length} questions
                                </p>
                                {fileName && (
                                    <p className="text-sm text-green-700 mt-0.5">from {fileName}</p>
                                )}
                                {errors.length > 0 && (
                                    <p className="text-sm text-amber-700 mt-1">
                                        ⚠️ {errors.length} row(s) had errors and were skipped
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Set metadata edit */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Set Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Biology Chapter 5"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional description..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Question preview */}
                    <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                        {parsedQuestions.map((q, idx) => (
                            <div key={idx} className="p-4 border border-gray-200 rounded-xl bg-white hover:shadow-sm transition-shadow">
                                <p className="font-semibold text-gray-900 mb-2.5">
                                    <span className="text-blue-600 mr-1.5">Q{idx + 1}.</span>
                                    {q.question}
                                </p>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    {q.choices.map((choice: string, choiceIdx: number) => (
                                        <div
                                            key={choiceIdx}
                                            className={`text-sm px-3 py-2 rounded-lg ${choiceIdx === q.correct_answer_index
                                                ? 'bg-green-50 text-green-800 border border-green-200 font-medium'
                                                : 'bg-gray-50 text-gray-700 border border-gray-100'
                                                }`}
                                        >
                                            <span className="font-mono font-bold mr-1.5">{String.fromCharCode(65 + choiceIdx)}.</span>
                                            {choice}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                    {q.explanation && (
                                        <span className="truncate max-w-[300px]">💡 {q.explanation}</span>
                                    )}
                                    {q.difficulty && (
                                        <span className={`px-2 py-0.5 rounded-full ${q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                            q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {q.difficulty}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4 mb-4 mt-6">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoSort}
                                onChange={(e) => setAutoSort(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Sort questions by embedded number (e.g. "1. Question")
                        </label>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleImportInternal}
                            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-sm"
                        >
                            Import {parsedQuestions.length} Questions
                        </button>
                        <button
                            onClick={() => {
                                setStep('upload');
                                setParsedQuestions([]);
                                setErrors([]);
                                setFileName('');
                            }}
                            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        >
                            Upload Different File
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
