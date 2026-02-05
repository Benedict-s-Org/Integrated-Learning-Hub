import React, { useState, useEffect, useRef } from 'react';
import { Feather, AlertCircle, Play, RefreshCw, Pencil } from 'lucide-react';

const SENTENCES = [
    { text: "The cat sat on the mat", words: ["The", "cat", "sat", "on", "the", "mat"] },
    { text: "I like to eat apples", words: ["I", "like", "to", "eat", "apples"] },
    { text: "She runs very fast", words: ["She", "runs", "very", "fast"] },
    { text: "Birds fly in the sky", words: ["Birds", "fly", "in", "the", "sky"] },
];

export const WordSnakeGame: React.FC = () => {
    // Game State
    const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover' | 'success'>('start');
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [collectedWords, setCollectedWords] = useState<string[]>([]);
    const [score, setScore] = useState(0);
    const [pressure, setPressure] = useState(0);
    const [health, setHealth] = useState(100);

    // Physics & Position
    const [position, setPosition] = useState({ x: 20, y: 50 }); // Start on the left side
    const [targets, setTargets] = useState<any[]>([]);

    // Snake Tail Logic
    const positionHistory = useRef<{ x: number, y: number }[]>([]); // Stores path for the tail to follow
    const lastRecordedPos = useRef({ x: 20, y: 50 }); // To track distance for history spacing

    const containerRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>();
    const lastTimeRef = useRef<number>();
    const targetSpawnTimer = useRef<number>(0);

    // Constants
    const PRESSURE_THRESHOLD = 0.6;
    const PRESSURE_DANGER = 0.8;
    const IDEAL_PRESSURE_MIN = 0.1;
    const IDEAL_PRESSURE_MAX = 0.45;

    // Adjusted for better readability
    const MIN_MOVE_DIST_TO_RECORD = 0.5; // Only record path if moved this % amount
    const TAIL_SEGMENT_SPACING = 14; // How many history points between words (increase to stretch)

    // Initial Setup
    useEffect(() => {
        if (gameState === 'playing') {
            const gameLoop = (time: number) => {
                if (!lastTimeRef.current) lastTimeRef.current = time;
                const deltaTime = time - lastTimeRef.current;
                lastTimeRef.current = time;

                updateGameLogic(deltaTime);

                if (gameState === 'playing') {
                    requestRef.current = requestAnimationFrame(gameLoop);
                }
            };
            requestRef.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [gameState, collectedWords, health, targets, pressure]);

    const startGame = () => {
        setGameState('playing');
        setCollectedWords([]);
        setScore(0);
        setHealth(100);
        setTargets([]);
        setPressure(0);
        positionHistory.current = [];
        lastRecordedPos.current = { x: 15, y: 50 };
        // Reset position to left side
        setPosition({ x: 15, y: 50 });
        lastTimeRef.current = performance.now();
    };

    const nextLevel = () => {
        const nextIdx = (currentSentenceIndex + 1) % SENTENCES.length;
        setCurrentSentenceIndex(nextIdx);
        startGame();
    };

    // Input Handling
    const handlePointerMove = (e: React.PointerEvent) => {
        if (gameState !== 'playing') return;

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;

            setPosition({ x, y });

            if (e.pointerType === 'pen' || e.pressure > 0) {
                setPressure(e.pressure);
            }
        }
    };

    const handlePointerUp = () => {
        setPressure(0);
    };

    const updateGameLogic = (deltaTime: number) => {
        // 0. Update Position History for Snake Tail (Distance Based)
        const dx = position.x - lastRecordedPos.current.x;
        const dy = position.y - lastRecordedPos.current.y;
        // Aspect ratio correction for distance calc (roughly)
        const dist = Math.sqrt(dx * dx + (dy * 0.6) * (dy * 0.6));

        // Only record history if we moved enough. 
        // This prevents the tail from bunching up when stationary.
        if (dist > MIN_MOVE_DIST_TO_RECORD) {
            positionHistory.current.unshift({ ...position });
            lastRecordedPos.current = { ...position };

            // Limit history length
            const maxHistory = (collectedWords.length + 2) * TAIL_SEGMENT_SPACING + 20;
            if (positionHistory.current.length > maxHistory) {
                positionHistory.current.length = maxHistory;
            }
        }

        // 1. Health/Pressure Mechanic
        if (pressure > PRESSURE_DANGER) {
            setHealth(h => Math.max(0, h - 0.5));
        } else if (pressure > PRESSURE_THRESHOLD) {
            setHealth(h => Math.max(0, h - 0.2));
        } else if (pressure > 0) {
            setHealth(h => Math.min(100, h + 0.05));
        }

        if (health <= 0) {
            setGameState('gameover');
            return;
        }

        // 2. Spawn Targets (Right to Left flow)
        targetSpawnTimer.current += deltaTime;
        if (targetSpawnTimer.current > 1800) {
            spawnTarget();
            targetSpawnTimer.current = 0;
        }

        // 3. Move Targets (Right to Left)
        setTargets(prevTargets => {
            return prevTargets
                .map(t => ({ ...t, x: t.x - (0.025 * deltaTime) })) // Move Left
                .filter(t => t.x > -10); // Remove if off screen (left side)
        });

        // 4. Collision Detection
        checkCollisions();
    };

    const spawnTarget = () => {
        const currentSentence = SENTENCES[currentSentenceIndex];
        const wordsNeeded = currentSentence.words;
        const nextWordNeeded = wordsNeeded[collectedWords.length];

        const isCorrectWord = Math.random() > 0.4;
        let wordText = '';
        let type = 'good';

        if (isCorrectWord && nextWordNeeded) {
            wordText = nextWordNeeded;
            type = 'target';
        } else {
            const allWords = SENTENCES.flatMap(s => s.words);
            wordText = allWords[Math.floor(Math.random() * allWords.length)];
            type = 'distractor';
        }

        if (collectedWords.length >= wordsNeeded.length) return;

        const newTarget = {
            id: Math.random(),
            x: 110, // Start off-screen right
            y: Math.random() * 80 + 10, // Random height 10-90%
            text: wordText,
            type: type
        };

        setTargets(prev => [...prev, newTarget]);
    };

    const checkCollisions = () => {
        const playerRadius = 5;
        const targetRadius = 6;

        setTargets(prev => {
            const remaining: any[] = [];

            prev.forEach(target => {
                const dx = (target.x - position.x);
                const dy = (target.y - position.y) * 0.7;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < playerRadius + targetRadius) {
                    handleCollision(target);
                } else {
                    remaining.push(target);
                }
            });
            return remaining;
        });
    };

    const handleCollision = (target: any) => {
        const currentSentence = SENTENCES[currentSentenceIndex];

        if (target.type === 'target') {
            const newCollected = [...collectedWords, target.text];
            setCollectedWords(newCollected);

            const pressureBonus = (pressure >= IDEAL_PRESSURE_MIN && pressure <= IDEAL_PRESSURE_MAX) ? 2 : 1;
            setScore(s => s + (100 * pressureBonus));

            if (newCollected.length === currentSentence.words.length) {
                setGameState('success');
            }
        } else {
            setScore(s => Math.max(0, s - 50));
        }
    };

    const getPressureColor = () => {
        if (pressure > PRESSURE_DANGER) return 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)] border-red-200';
        if (pressure > PRESSURE_THRESHOLD) return 'bg-orange-400 border-orange-200';
        if (pressure >= IDEAL_PRESSURE_MIN) return 'bg-green-400 shadow-[0_0_20px_rgba(74,222,128,0.6)] border-green-200';
        return 'bg-blue-300 border-blue-100';
    };

    const getCursorSize = () => {
        const base = 40;
        const extra = pressure * 40;
        return base + extra;
    };

    return (
        <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans select-none touch-none">

            {/* Top HUD */}
            <div className="flex justify-between items-center p-3 bg-white shadow-sm z-20">
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-slate-700">字彙飛蛇 (Word Snake)</h1>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>目標句子:</span>
                        <span className="font-bold text-blue-600 bg-blue-50 px-2 rounded">
                            {SENTENCES[currentSentenceIndex].text}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Pressure Meter */}
                    <div className="flex flex-col w-32">
                        <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden border border-gray-300 relative">
                            <div className="absolute left-[10%] w-[35%] h-full bg-green-200 z-0"></div>
                            <div
                                className={`h-full transition-all duration-75 ${pressure > PRESSURE_DANGER ? 'bg-red-600' :
                                    pressure > PRESSURE_THRESHOLD ? 'bg-orange-400' :
                                        'bg-blue-500'
                                    }`}
                                style={{ width: `${Math.min(pressure * 100, 100)}%` }}
                            ></div>
                        </div>
                        <div className="text-[10px] text-center mt-1 text-slate-400 font-mono">
                            PRESSURE: {pressure.toFixed(2)}
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">{score}</div>
                    </div>
                </div>
            </div>

            {/* Main Game Area */}
            <div
                ref={containerRef}
                className="relative flex-1 bg-gradient-to-r from-slate-50 to-slate-100 cursor-none overflow-hidden"
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {/* Background Grid Lines to enhance movement sensation */}
                <div className="absolute inset-0 opacity-5"
                    style={{
                        backgroundImage: 'linear-gradient(90deg, #cbd5e1 1px, transparent 1px)',
                        backgroundSize: '100px 100%'
                    }}>
                </div>

                {/* Warning Overlay */}
                <div
                    className="absolute inset-0 border-[12px] border-red-500 pointer-events-none transition-opacity duration-200 z-10"
                    style={{ opacity: pressure > PRESSURE_DANGER ? 0.6 : 0 }}
                ></div>

                {/* --- THE SNAKE --- */}
                {gameState === 'playing' && (
                    <>
                        {/* 1. Tail Segments (Collected Words) */}
                        {collectedWords.map((word, index) => {
                            // Calculate index in history buffer
                            const historyIndex = (index + 1) * TAIL_SEGMENT_SPACING;
                            const pos = positionHistory.current[historyIndex] || position;

                            return (
                                <div
                                    key={`tail-${index}`}
                                    className="absolute px-3 py-1 rounded-full bg-blue-500 text-white font-bold text-sm shadow-sm border-2 border-white flex items-center justify-center transition-all"
                                    style={{
                                        left: `${pos.x}%`,
                                        top: `${pos.y}%`,
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: 5 - index,
                                        // Make tail slightly smaller towards the end for visual effect
                                        // scale: Math.max(0.8, 1 - (index * 0.05)),
                                        minWidth: 'fit-content',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {word}
                                </div>
                            );
                        })}

                        {/* 2. Head (Cursor) */}
                        <div
                            className={`absolute rounded-full flex items-center justify-center transition-colors duration-75 border-4 border-white z-10 ${getPressureColor()}`}
                            style={{
                                left: `${position.x}%`,
                                top: `${position.y}%`,
                                width: `${getCursorSize()}px`,
                                height: `${getCursorSize()}px`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            {pressure > PRESSURE_THRESHOLD ? (
                                <div className="flex gap-2"><div className="w-2 h-2 bg-white rounded-full"></div><div className="w-2 h-2 bg-white rounded-full"></div></div>
                            ) : (
                                <Feather size={24} className="text-white" />
                            )}
                        </div>
                    </>
                )}

                {/* Incoming Targets */}
                {targets.map(target => (
                    <div
                        key={target.id}
                        className={`absolute px-4 py-2 rounded-xl shadow-lg font-bold text-xl transform -translate-x-1/2 -translate-y-1/2
              ${target.type === 'target'
                                ? 'bg-white text-blue-600 border-l-4 border-blue-500'
                                : 'bg-gray-200 text-gray-400 border-dashed border-2 border-gray-300'
                            }`}
                        style={{ left: `${target.x}%`, top: `${target.y}%` }}
                    >
                        {target.text}
                    </div>
                ))}

                {/* Screens */}
                {gameState === 'start' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md text-center">
                            <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Pencil className="w-10 h-10 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-slate-800">字彙飛蛇特訓</h2>
                            <p className="text-slate-600 mb-6 leading-relaxed">
                                移動你的筆來控制蛇頭。<br />
                                當你接住單字時，句子會跟在你後面。<br />
                                <span className="text-blue-600 font-bold mt-2 inline-block">試著畫出大圓弧，讓句子展開來看！</span>
                            </p>
                            <button
                                onClick={startGame}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-full flex items-center gap-2 mx-auto transition-transform active:scale-95 shadow-lg shadow-blue-200"
                            >
                                <Play size={24} fill="currentColor" /> 開始遊戲
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'gameover' && (
                    <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-30">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md text-center border-b-8 border-red-500">
                            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-2">太用力囉！</h2>
                            <p className="text-gray-600 mb-6">手部肌肉太緊繃，飛蛇飛不動了。<br />深呼吸，放鬆手腕再來一次。</p>
                            <button
                                onClick={startGame}
                                className="bg-slate-800 text-white font-bold py-3 px-8 rounded-full flex items-center gap-2 mx-auto hover:bg-slate-700"
                            >
                                <RefreshCw size={20} /> 再試一次
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'success' && (
                    <div className="absolute inset-0 bg-green-900/80 flex items-center justify-center z-30">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-lg text-center border-b-8 border-green-500">
                            <h2 className="text-sm font-bold text-green-600 uppercase tracking-widest mb-2">Mission Complete</h2>
                            <div className="flex flex-wrap justify-center gap-2 mb-6">
                                {SENTENCES[currentSentenceIndex].words.map((w, i) => (
                                    <span key={i} className="bg-green-100 text-green-800 px-3 py-1 rounded-lg text-xl font-bold border border-green-200 shadow-sm">{w}</span>
                                ))}
                            </div>
                            <p className="text-slate-500 mb-6">完美的力度控制！你的字體一定會越來越漂亮。</p>
                            <button
                                onClick={nextLevel}
                                className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-10 rounded-full flex items-center gap-2 mx-auto shadow-lg shadow-green-200"
                            >
                                <Play size={20} fill="currentColor" /> 下一句
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Debug Slider */}
            <div className="absolute bottom-4 right-4 bg-white/90 p-3 rounded-xl shadow-lg text-xs backdrop-blur-sm z-50 border border-slate-200">
                <label className="font-bold text-slate-500 mb-1 block">測試用壓力閥</label>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={pressure}
                    onChange={(e) => setPressure(parseFloat(e.target.value))}
                    className="w-48 accent-blue-500"
                />
            </div>

        </div>
    );
};
