import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { ReferencePanel } from './components/ReferencePanel';
import { NotionImportModal } from './components/NotionImportModal';
import { ExamProvider } from './store/ExamContext';

const ExamFormatter: React.FC = () => {
    const [showReference, setShowReference] = useState(false);
    const [showNotionModal, setShowNotionModal] = useState(false);

    return (
        <ExamProvider>
            <div className="flex h-screen w-full bg-white overflow-hidden">
                <Sidebar 
                    showReference={showReference} 
                    setShowReference={setShowReference} 
                    onOpenNotion={() => setShowNotionModal(true)}
                />
                <main className="flex-1 flex flex-col relative bg-gray-100">
                    <div className="absolute inset-0 overflow-hidden flex">
                        <div className="flex-1 overflow-auto p-8 flex justify-center">
                            <Canvas />
                        </div>
                        {showReference && (
                            <div className="animate-in slide-in-from-right duration-300 border-l border-gray-200">
                                <ReferencePanel />
                            </div>
                        )}
                    </div>
                </main>
                <div className="hidden lg:block w-72 border-l border-gray-200 bg-white shadow-lg z-10">
                    <Inspector />
                </div>
                {showNotionModal && <NotionImportModal onClose={() => setShowNotionModal(false)} />}
            </div>
        </ExamProvider>
    );
};


export default ExamFormatter;
