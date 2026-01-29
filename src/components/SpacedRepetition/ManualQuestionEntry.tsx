import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface Question {
  question: string;
  choices: [string, string, string, string];
  correct_answer_index: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

interface ManualQuestionEntryProps {
  title: string;
  description: string;
  onSave: (questions: Question[], setTitle: string, setDescription: string) => void;
  onCancel: () => void;
}

export function ManualQuestionEntry({
  title: initialTitle,
  description: initialDescription,
  onSave,
  onCancel,
}: ManualQuestionEntryProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [errors, setErrors] = useState<string[]>([]);

  const addQuestion = () => {
    const newQuestion: Question = {
      question: '',
      choices: ['', '', '', ''],
      correct_answer_index: 0,
      explanation: '',
      difficulty: 'medium',
      tags: [],
    };
    setQuestions([...questions, newQuestion]);
    setExpandedIndex(questions.length);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateChoices = (index: number, choiceIndex: number, value: string) => {
    const updated = [...questions];
    const choices = [...updated[index].choices];
    choices[choiceIndex] = value;
    updated[index].choices = choices as [string, string, string, string];
    setQuestions(updated);
  };

  const validateAndSave = () => {
    const newErrors: string[] = [];

    if (!title.trim()) {
      newErrors.push('Set title is required');
    }

    if (questions.length === 0) {
      newErrors.push('Add at least one question');
    }

    questions.forEach((q, idx) => {
      if (!q.question.trim()) {
        newErrors.push(`Question ${idx + 1}: Question text is required`);
      }
      if (q.choices.some(c => !c.trim())) {
        newErrors.push(`Question ${idx + 1}: All 4 answer choices are required`);
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(questions, title, description);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Question Set</h2>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Set Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Biology Chapter 5"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description for this question set..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="font-semibold text-red-900 mb-2">Please fix these errors:</p>
          <ul className="space-y-1">
            {errors.map((error, idx) => (
              <li key={idx} className="text-sm text-red-700">• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4 mb-8">
        {questions.map((question, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <span className="font-semibold text-gray-900">Question {idx + 1}</span>
              <div className="flex items-center gap-2">
                {expandedIndex === idx ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeQuestion(idx);
                  }}
                  className="p-1 hover:bg-red-100 rounded transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-red-600" />
                </button>
              </div>
            </button>

            {expandedIndex === idx && (
              <div className="p-4 space-y-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                  <textarea
                    value={question.question}
                    onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                    placeholder="Enter your question here..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {question.choices.map((choice, choiceIdx) => (
                    <div key={choiceIdx}>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                        <input
                          type="radio"
                          name={`correct-${idx}`}
                          checked={question.correct_answer_index === choiceIdx}
                          onChange={() => updateQuestion(idx, { correct_answer_index: choiceIdx })}
                          className="w-4 h-4"
                        />
                        Choice {String.fromCharCode(65 + choiceIdx)}
                      </label>
                      <input
                        type="text"
                        value={choice}
                        onChange={(e) => updateChoices(idx, choiceIdx, e.target.value)}
                        placeholder={`Enter choice ${String.fromCharCode(65 + choiceIdx)}...`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                    <select
                      value={question.difficulty}
                      onChange={(e) => updateQuestion(idx, { difficulty: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={question.tags.join(', ')}
                      onChange={(e) =>
                        updateQuestion(idx, {
                          tags: e.target.value.split(',').map(t => t.trim()).filter(t => t),
                        })
                      }
                      placeholder="e.g., biology, chapter5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (optional)</label>
                  <textarea
                    value={question.explanation}
                    onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                    placeholder="Explain why this answer is correct..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={addQuestion}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Question
        </button>

        <button
          onClick={validateAndSave}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Save Question Set
        </button>

        <button
          onClick={onCancel}
          className="px-6 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}