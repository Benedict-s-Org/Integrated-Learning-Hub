import React from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import manifestContent from '../../.agent/codebase_manifest.md?raw';

const CodebaseManifestPage: React.FC = () => {
    return (
        <AdminLayout title="Codebase Manifest">
            <div className="max-w-4xl mx-auto py-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <path d="m10 13-2 2 2 2" />
                                    <path d="m14 17 2-2-2-2" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Codebase Manifest</h1>
                                <p className="text-slate-200 text-sm">Live Reference Architecture for AI Agents</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 prose prose-slate max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {manifestContent}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default CodebaseManifestPage;
