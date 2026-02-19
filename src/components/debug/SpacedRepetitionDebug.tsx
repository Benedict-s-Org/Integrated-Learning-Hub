import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

// Mock types
interface MockQuestion {
    id: string;
    question_text: string;
    correct_answer_index: number;
}

interface MockSessionState {
    currentQuestionIndex: number;
    questions: MockQuestion[];
    results: any[];
}

export function SpacedRepetitionDebug() {
    const [sessionState, setSessionState] = useState<MockSessionState | null>(null);
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) => setLog(prev => [...prev, `${new Date().toISOString().split('T')[1]} - ${msg}`]);

    useEffect(() => {
        // Init mock session
        setSessionState({
            currentQuestionIndex: 0,
            questions: [
                { id: 'q1', question_text: 'Question 1', correct_answer_index: 0 },
                { id: 'q2', question_text: 'Question 2', correct_answer_index: 1 },
                { id: 'q3', question_text: 'Question 3', correct_answer_index: 2 },
            ],
            results: []
        });
        addLog('Session initialized');
    }, []);

    const handleNext = () => {
        addLog('handleNext called');
        setSessionState(prev => {
            if (!prev) return null;
            addLog(`Updating index from ${prev.currentQuestionIndex} to ${prev.currentQuestionIndex + 1}`);
            return {
                ...prev,
                currentQuestionIndex: prev.currentQuestionIndex + 1
            };
        });
    };

    const handleAnswer = (index: number) => {
        addLog(`handleAnswer called with index ${index}`);
        setSessionState(prev => {
            if (!prev) return null;
            addLog(`Adding result for q${prev.currentQuestionIndex + 1}`);
            return {
                ...prev,
                results: [...prev.results, { question_id: prev.questions[prev.currentQuestionIndex].id, selected: index }]
            };
        });
    };

    if (!sessionState) return <div>Loading...</div>;

    const currentQ = sessionState.questions[sessionState.currentQuestionIndex];
    const isFinished = sessionState.currentQuestionIndex >= sessionState.questions.length;

    return (
        <div className="p-4 space-y-4">
            <Card className="p-4">
                <h2 className="text-xl font-bold mb-2">Debug Console</h2>
                <div className="h-48 overflow-y-auto bg-gray-100 p-2 text-xs font-mono">
                    {log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
            </Card>

            {!isFinished ? (
                <Card className="p-4">
                    <h3 className="text-lg font-bold">Current Question: {currentQ?.question_text}</h3>
                    <p>Index: {sessionState.currentQuestionIndex}</p>
                    <div className="flex gap-2 mt-4">
                        <Button onClick={() => handleAnswer(0)}>Answer A</Button>
                        <Button onClick={() => handleAnswer(1)}>Answer B</Button>
                        <Button onClick={handleNext}>Next</Button>
                    </div>
                </Card>
            ) : (
                <div className="text-xl font-bold text-green-600">Finished!</div>
            )}
        </div>
    );
}
