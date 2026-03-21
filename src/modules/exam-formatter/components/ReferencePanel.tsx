import React, { useRef } from 'react';
import { useExam } from '../store/ExamContext';
import { Upload, X, FileType } from 'lucide-react';

export const ReferencePanel: React.FC = () => {
    const { referenceFile, setReferenceFile } = useExam();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        setReferenceFile({
            url,
            name: file.name,
            type: file.type
        });
    };

    const clearReference = () => {
        if (referenceFile) {
            URL.revokeObjectURL(referenceFile.url);
            setReferenceFile(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 border-l border-gray-200 w-80 shadow-inner">
            <div className="p-4 border-b bg-white flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Reference</h3>
                    <p className="text-[10px] text-gray-400">Visual guide for formatting</p>
                </div>
                {referenceFile && (
                    <button 
                        onClick={clearReference}
                        className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title="Remove Reference"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-hidden relative">
                {!referenceFile ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 text-orange-400">
                            <Upload size={32} />
                        </div>
                        <h4 className="text-sm font-bold text-gray-600 mb-1">Upload Template</h4>
                        <p className="text-xs text-gray-400 mb-6">PDF or DOCX for visual reference</p>
                        
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            className="hidden"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-2 bg-white border border-orange-200 text-orange-600 rounded-xl text-sm font-bold hover:bg-orange-50 transition-all shadow-sm"
                        >
                            Select File
                        </button>
                    </div>
                ) : (
                    <div className="h-full flex flex-col">
                        <div className="p-3 bg-orange-50 text-orange-700 text-[10px] font-medium flex items-center gap-2">
                            <FileType size={12} />
                            <span className="truncate">{referenceFile.name}</span>
                        </div>
                        
                        <div className="flex-1 bg-gray-200 relative overflow-hidden">
                            {referenceFile.type === 'application/pdf' ? (
                                <iframe 
                                    src={referenceFile.url} 
                                    className="w-full h-full border-none"
                                    title="Reference PDF"
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white m-2 rounded shadow-sm">
                                    <div className="p-4 bg-blue-50 text-blue-500 rounded-full mb-4">
                                        <FileType size={32} />
                                    </div>
                                    <h5 className="text-sm font-bold text-gray-700 mb-2">DOCX Reference</h5>
                                    <p className="text-xs text-gray-400 mb-4">
                                        Advanced DOCX preview coming soon. 
                                        Please use PDF for high-fidelity visual matching.
                                    </p>
                                    <a 
                                        href={referenceFile.url} 
                                        download={referenceFile.name}
                                        className="text-xs text-blue-600 font-bold hover:underline"
                                    >
                                        Download to View
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
