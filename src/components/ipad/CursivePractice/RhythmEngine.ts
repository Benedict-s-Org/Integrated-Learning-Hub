
interface StrokePoint {
    x: number;
    y: number;
    time: number;
    pressure: number;
}

interface BeatSegment {
    id: number;
    startTime: number;
    endTime: number;
    points: StrokePoint[];
    judged: boolean;
    startPoint: { x: number; y: number };
}

type Judgement = 'perfect' | 'great' | 'good' | 'miss';

interface HitResult {
    judgement: Judgement;
    score: number;
    combo: number;
    timingError: number;
    pressureBonus: number;
}

export class RhythmEngine {
    // Game State
    segments: BeatSegment[] = [];
    activeSegmentIndex: number = 0;
    combo: number = 0;
    maxCombo: number = 0;
    score: number = 0;
    life: number = 100; // 0-100

    // Stats
    perfectCount: number = 0;
    greatCount: number = 0;
    goodCount: number = 0;
    missCount: number = 0;

    // Pressure Stats
    gentleStreak: number = 0;
    maxGentleStreak: number = 0;
    totalPressureSamples: number = 0;
    gentlePressureSamples: number = 0;

    // Config (Default values, can be overridden)
    config = {
        timingWindows: {
            perfect: 150, // +/- ms (generous for kids)
            great: 300,
            good: 500
        },
        pressure: {
            min: 0.10,
            max: 0.35,
            hardThreshold: 0.50
        },
        drainRate: 5,   // Life lost per miss
        healRate: 2     // Life gained per hit
    };

    /**
     * Parses raw stroke data into beat segments based on time gaps (pen lifts)
     */
    parseStrokeData(data: StrokePoint[], gapThresholdMs: number = 300): BeatSegment[] {
        if (!data || data.length === 0) return [];

        const segments: BeatSegment[] = [];
        let currentPoints: StrokePoint[] = [data[0]];
        let segmentId = 0;

        for (let i = 1; i < data.length; i++) {
            const timeDiff = data[i].time - data[i - 1].time;

            if (timeDiff > gapThresholdMs) {
                // End current segment
                if (currentPoints.length > 0) {
                    segments.push({
                        id: segmentId++,
                        startTime: currentPoints[0].time,
                        endTime: currentPoints[currentPoints.length - 1].time,
                        points: [...currentPoints],
                        judged: false,
                        startPoint: { x: currentPoints[0].x, y: currentPoints[0].y }
                    });
                }
                currentPoints = [data[i]];
            } else {
                currentPoints.push(data[i]);
            }
        }

        // Add last segment
        if (currentPoints.length > 0) {
            segments.push({
                id: segmentId++,
                startTime: currentPoints[0].time,
                endTime: currentPoints[currentPoints.length - 1].time,
                points: [...currentPoints],
                judged: false,
                startPoint: { x: currentPoints[0].x, y: currentPoints[0].y }
            });
        }

        this.segments = segments;
        return segments;
    }

    /**
     * Evaluate a hit (input at a certain time/position)
     */
    judge(inputTime: number, inputPos: { x: number, y: number }, avgPressure: number): HitResult {
        const segment = this.segments[this.activeSegmentIndex];
        if (!segment || segment.judged) return this.createMissResult();

        // 1. Timing Check
        const timingError = Math.abs(inputTime - segment.startTime);

        let judgement: Judgement = 'miss';
        if (timingError <= this.config.timingWindows.perfect) judgement = 'perfect';
        else if (timingError <= this.config.timingWindows.great) judgement = 'great';
        else if (timingError <= this.config.timingWindows.good) judgement = 'good';

        // 2. Pressure Check
        // If pressing too hard, cap the judgement at 'good' or break combo
        let pressureBonus = 0;
        if (avgPressure > this.config.pressure.hardThreshold) {
            judgement = 'miss'; // Hard press breaks combo!
        } else if (avgPressure >= this.config.pressure.min && avgPressure <= this.config.pressure.max) {
            pressureBonus = 1.0; // Full bonus
            this.gentleStreak++;
            this.gentlePressureSamples++;
        } else {
            // Too light or slightly heavy
            this.gentleStreak = 0;
        }

        this.totalPressureSamples++;
        this.maxGentleStreak = Math.max(this.maxGentleStreak, this.gentleStreak);

        // 3. Update State
        if (judgement !== 'miss') {
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            this.life = Math.min(100, this.life + this.config.healRate);

            // Score Calculation: Base + Combo Bonus + Pressure Bonus
            const baseScore = judgement === 'perfect' ? 300 : judgement === 'great' ? 100 : 50;
            const pressureMultiplier = 1 + (pressureBonus * 0.3); // up to 30% bonus
            const comboMultiplier = Math.min(4, 1 + (this.combo / 10)); // Cap at 4x

            this.score += Math.round(baseScore * pressureMultiplier * comboMultiplier);

            if (judgement === 'perfect') this.perfectCount++;
            if (judgement === 'great') this.greatCount++;
            if (judgement === 'good') this.goodCount++;

            // Mark segment as done
            segment.judged = true;
            this.activeSegmentIndex++;

            return {
                judgement,
                score: this.score,
                combo: this.combo,
                timingError,
                pressureBonus
            };
        } else {
            return this.handleMiss();
        }
    }

    private handleMiss(): HitResult {
        this.combo = 0;
        this.gentleStreak = 0;
        this.life = Math.max(0, this.life - this.config.drainRate);
        this.missCount++;

        // Move to next segment if we missed the window completely
        const segment = this.segments[this.activeSegmentIndex];
        if (segment) {
            segment.judged = true;
            this.activeSegmentIndex++;
        }

        return {
            judgement: 'miss',
            score: this.score,
            combo: 0,
            timingError: 999,
            pressureBonus: 0
        };
    }

    private createMissResult(): HitResult {
        return {
            judgement: 'miss',
            score: this.score,
            combo: this.combo,
            timingError: 999,
            pressureBonus: 0
        };
    }

    /**
     * Calculate virtual coin reward based on performance
     */
    calculateCoinReward(): number {
        // Rank calculation
        const totalHits = this.perfectCount + this.greatCount + this.goodCount + this.missCount;
        if (totalHits === 0) return 0;

        const accuracy = (this.perfectCount * 100 + this.greatCount * 50 + this.goodCount * 20) / (totalHits * 100);

        let baseCoins = 0;
        if (accuracy >= 0.95) baseCoins = 5;      // S Rank
        else if (accuracy >= 0.85) baseCoins = 3; // A Rank
        else if (accuracy >= 0.70) baseCoins = 2; // B Rank
        else if (accuracy >= 0.50) baseCoins = 1; // C Rank

        // Gentle Bonus
        const gentlePercent = this.totalPressureSamples > 0
            ? this.gentlePressureSamples / this.totalPressureSamples
            : 0;

        let gentleBonus = 0;
        if (gentlePercent >= 0.80) {
            if (baseCoins >= 5) gentleBonus = 3;
            else if (baseCoins >= 3) gentleBonus = 2;
            else if (baseCoins >= 1) gentleBonus = 1;
        }

        return baseCoins + gentleBonus;
    }

    getRank(): 'S' | 'A' | 'B' | 'C' | 'F' {
        const totalHits = this.perfectCount + this.greatCount + this.goodCount + this.missCount;
        if (totalHits === 0) return 'F';

        const accuracy = (this.perfectCount * 100 + this.greatCount * 50 + this.goodCount * 20) / (totalHits * 100);

        if (accuracy >= 0.95) return 'S';
        if (accuracy >= 0.85) return 'A';
        if (accuracy >= 0.70) return 'B';
        if (accuracy >= 0.50) return 'C';
        return 'F';
    }
}
