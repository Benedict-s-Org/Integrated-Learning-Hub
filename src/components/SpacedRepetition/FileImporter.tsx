import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, Download, FileSpreadsheet, FileText, ArrowLeft } from 'lucide-react';
import {
    parseCSVQuestions,
    parseXLSXQuestions,
    validateImportedQuestions,
    generateCSVTemplate,
    generateXLSXTemplate,
    ImportedQuestion,
} from '../../utils/importParsers';

interface FileImporterProps {
    title: string;
    description: string;
    onImport: (questions: ImportedQuestion[], setTitle: string, setDescription: string) => void;
    onCancel: () => void;
}

export function FileImporter({ title, description, onImport, onCancel }: FileImporterProps) {
    const [errors, setErrors] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
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
            return;
        }

        const { valid, errors: validationErrors } = validateImportedQuestions(parsed);

        if (validationErrors.length > 0 && valid.length === 0) {
            setErrors(validationErrors);
        } else {
            setErrors(validationErrors);
            onImport(valid, title, description);
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

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-2xl font-bold text-gray-900">Import from File</h2>
            </div>

            <div className="space-y-6">
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
        </div>
    );
}
