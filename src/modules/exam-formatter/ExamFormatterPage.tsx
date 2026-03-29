import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { ReferencePanel } from './components/ReferencePanel';
import { NotionImportModal } from './components/NotionImportModal';
import { Toolbar } from './components/Toolbar';
import { ExamProvider } from './store/ExamContext';
import { PanelRight } from 'lucide-react';

const ExamFormatter: React.FC = () => {
    const [showReference, setShowReference] = useState(false);
    const [showNotionModal, setShowNotionModal] = useState(false);
    const [showInspector, setShowInspector] = useState(true);

    return (
        <ExamProvider>
            <div className="flex h-screen w-full bg-white overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col relative bg-gray-100 overflow-hidden">
                    <Toolbar 
                        showReference={showReference}
                        setShowReference={setShowReference}
                        onOpenNotion={() => setShowNotionModal(true)}
                        showInspector={showInspector}
                        setShowInspector={setShowInspector}
                    />
                    <div className="flex-1 relative overflow-hidden flex">
                        <div className="flex-1 overflow-auto p-8 flex justify-center">
                            <Canvas />
                        </div>
                        {showReference && (
                            <div className="w-80 h-full animate-in slide-in-from-right duration-300 border-l border-gray-200 bg-white shadow-lg overflow-y-auto">
                                <ReferencePanel />
                            </div>
                        )}
                    </div>
                </main>
                {showInspector && (
                    <div className="hidden lg:block w-72 h-full border-l border-gray-200 bg-white shadow-lg z-10 animate-in slide-in-from-right duration-200">
                        <Inspector onClose={() => setShowInspector(false)} />
                    </div>
                )}
                {!showInspector && (
                    <button 
                        onClick={() => setShowInspector(true)}
                        className="fixed right-0 top-1/2 -translate-y-1/2 bg-white border border-r-0 border-gray-200 p-3 rounded-l-xl shadow-xl hover:bg-orange-50 hover:text-orange-600 transition-all z-20 group flex flex-col items-center gap-3 active:scale-95"
                        title="Open Inspector"
                    >
                        <PanelRight size={20} className="text-gray-400 group-hover:text-orange-600" />
                        <span className="[writing-mode:vertical-lr] text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] group-hover:text-orange-600">Inspector</span>
                    </button>
                )}
                {showNotionModal && <NotionImportModal onClose={() => setShowNotionModal(false)} />}
            </div>
        </ExamProvider>
    );
};


export default ExamFormatter;
