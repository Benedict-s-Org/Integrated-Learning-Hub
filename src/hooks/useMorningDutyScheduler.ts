import { useState, useRef, useEffect } from 'react';

export interface TimesConfig {
    alarm1: string;
    alarm2: string;
    alarm3: string;
    deadline: string;
}

export interface MorningDutySettings {
    enabled: boolean;
    alarm_url: string | null;
    times: TimesConfig;
    messages: any;
    weekdays: number[];
}

export interface UseMorningDutySchedulerProps {
    activeClass: string;
    settings: MorningDutySettings | null;
    isAdmin: boolean;
    onTrigger: (timeKey: 'alarm1' | 'alarm2' | 'alarm3' | 'deadline') => void;
}

export function useMorningDutyScheduler({ activeClass, settings, isAdmin, onTrigger }: UseMorningDutySchedulerProps) {
    const isTestClass = activeClass.toLowerCase() === 'test';
    
    const [isTestMode, setIsTestModeState] = useState(false);
    const [simulatedTime, setSimulatedTime] = useState<Date | null>(null);
    // lastTriggeredStage: just for display in the banner, does NOT pause the clock
    const [lastTriggeredStage, setLastTriggeredStage] = useState<string | null>(null);

    const isTestModeRef = useRef(false);
    const settingsRef = useRef(settings);
    const onTriggerRef = useRef(onTrigger);
    const triggeredTimes = useRef<Record<string, boolean>>({});

    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { onTriggerRef.current = onTrigger; }, [onTrigger]);

    const setIsTestMode = (val: boolean) => {
        setIsTestModeState(val);
        isTestModeRef.current = val;
    };

    const startTestMode = () => {
        if (!isAdmin || !isTestClass) {
            console.warn('[TestMode] blocked: isAdmin=', isAdmin, 'isTestClass=', isTestClass);
            return;
        }
        console.log('[TestMode] STARTING. settings:', settingsRef.current);
        const d = new Date();
        d.setHours(8, 4, 0, 0);
        setSimulatedTime(d);
        setIsTestMode(true);
        setLastTriggeredStage(null);
        triggeredTimes.current = {};
    };

    const exitTestMode = () => {
        setIsTestMode(false);
        setSimulatedTime(null);
        setLastTriggeredStage(null);
        triggeredTimes.current = {};
    };

    const jumpToNextTrigger = () => {
        if (!settingsRef.current?.times || !simulatedTime) {
            console.warn('[TestMode] jumpToNextTrigger: no settings or simulatedTime');
            return;
        }
        const times = settingsRef.current.times;
        const triggers = ([times.alarm1, times.alarm2, times.alarm3, times.deadline] as string[]).filter(Boolean).sort();
        
        const hours = String(simulatedTime.getHours()).padStart(2, '0');
        const minutes = String(simulatedTime.getMinutes()).padStart(2, '0');
        const currentHHMM = `${hours}:${minutes}`;

        const nextTime = triggers.find(t => t > currentHHMM);
        if (nextTime) {
            const [h, m] = nextTime.split(':').map(Number);
            const nextDate = new Date(simulatedTime);
            nextDate.setHours(h, m, 0, 0);
            setSimulatedTime(nextDate);
        } else {
            alert('No more triggers for today! Configured times: ' + JSON.stringify(triggers));
        }
    };

    const checkTriggers = (timeToCheck: Date) => {
        const sets = settingsRef.current;
        if (!sets || !sets.enabled) return;
        
        if (!isTestModeRef.current) {
            const currentDay = timeToCheck.getDay() || 7;
            if (!sets.weekdays || !sets.weekdays.includes(currentDay)) return;
        }

        const hours = String(timeToCheck.getHours()).padStart(2, '0');
        const minutes = String(timeToCheck.getMinutes()).padStart(2, '0');
        const hhmm = `${hours}:${minutes}`;
        const yyyymmdd = `${timeToCheck.getFullYear()}-${String(timeToCheck.getMonth()+1).padStart(2,'0')}-${String(timeToCheck.getDate()).padStart(2,'0')}`;

        const triggers: ('alarm1' | 'alarm2' | 'alarm3' | 'deadline')[] = ['alarm1', 'alarm2', 'alarm3', 'deadline'];
        
        for (const t of triggers) {
            const targetTime = sets.times?.[t];
            if (!targetTime) continue;
            
            if (hhmm === targetTime) {
                const key = isTestModeRef.current ? `test-${yyyymmdd}-${t}` : `prod-${yyyymmdd}-${t}`;
                
                if (!triggeredTimes.current[key]) {
                    triggeredTimes.current[key] = true;
                    console.log('[TestMode] Firing trigger:', t, 'at', hhmm);
                    onTriggerRef.current?.(t);
                    if (isTestModeRef.current) {
                        setLastTriggeredStage(`Triggered: ${t} at ${hhmm}`);
                    }
                }
            }
        }
    };

    // Ticker: advances simulated time at 12x speed in test mode
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (isTestModeRef.current) {
                setSimulatedTime(prev => {
                    if (!prev) return prev;
                    return new Date(prev.getTime() + 12000); // 1 real sec = 12 sim sec
                });
            } else {
                checkTriggers(new Date());
            }
        }, 1000);
        return () => clearInterval(intervalId);
    }, []);

    // Check triggers whenever simulated time changes
    useEffect(() => {
        if (isTestMode && simulatedTime) {
            checkTriggers(simulatedTime);
        }
    }, [simulatedTime, isTestMode]);

    const formattedSimTime = simulatedTime ? 
        `${String(simulatedTime.getHours()).padStart(2, '0')}:${String(simulatedTime.getMinutes()).padStart(2, '0')}:${String(simulatedTime.getSeconds()).padStart(2, '0')}` 
        : null;

    return {
        isTestClass,
        testState: {
            isTestMode,
            simulatedTime,
            formattedSimTime,
            lastTriggeredStage,
            startTestMode,
            jumpToNextTrigger,
            exitTestMode
        }
    };
}
