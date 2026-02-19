
import { CatMascot } from './CatMascot';

export class RhythmVisuals {

    static drawApproachCircle(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        progress: number, // 1.0 (start) to 0.0 (hit)
        color: string = '#3b82f6'
    ) {
        if (progress < 0) return;

        const baseRadius = 15; // Target size
        const currentRadius = baseRadius + (progress * 50); // Shrinks from 65 to 15

        ctx.globalAlpha = Math.min(1, 1 - progress + 0.2); // Fade in
        ctx.beginPath();
        ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    static drawPressureMeter(
        ctx: CanvasRenderingContext2D,
        width: number,
        pressure: number, // 0 to 1
        config: { min: number, max: number, hard: number }
    ) {
        const barHeight = 8;
        const y = 20;
        const padding = 40;
        const availableWidth = width - (padding * 2);
        const startX = padding;

        // Background
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.roundRect(startX, y, availableWidth, barHeight, 4);
        ctx.fill();

        // Zones
        // Green Zone (Gentle)
        const greenStart = startX + (config.min * availableWidth);
        const greenWidth = (config.max - config.min) * availableWidth;
        ctx.fillStyle = '#bbf7d0'; // Green 200
        ctx.fillRect(greenStart, y, greenWidth, barHeight);

        // Red Zone (Hard)
        const redStart = startX + (config.hard * availableWidth);
        const redWidth = availableWidth - (config.hard * availableWidth);
        ctx.fillStyle = '#fecaca'; // Red 200
        ctx.fillRect(redStart, y, redWidth, barHeight);

        // Indicator (Cat Head icon)
        const indicatorX = startX + (Math.min(pressure, 1) * availableWidth);

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(indicatorX, y + barHeight / 2, 8, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('Gentle Zone', greenStart + greenWidth / 2, y + 20);
    }

    static drawComboCounter(
        ctx: CanvasRenderingContext2D,
        combo: number,
        x: number,
        y: number,
        scale: number = 1.0
    ) {
        if (combo < 2) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#3b82f6';
        ctx.textAlign = 'right';
        ctx.fillText(`${combo}x`, 0, 0);

        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('COMBO', 0, 15);

        ctx.restore();
    }

    static drawJudgement(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        text: string,
        color: string,
        life: number // 1.0 to 0.0 fade out
    ) {
        if (life <= 0) return;

        ctx.save();
        ctx.translate(x, y - (1 - life) * 20); // Float up
        ctx.globalAlpha = life;

        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeText(text, 0, 0);
        ctx.fillText(text, 0, 0);

        ctx.restore();
    }
}
