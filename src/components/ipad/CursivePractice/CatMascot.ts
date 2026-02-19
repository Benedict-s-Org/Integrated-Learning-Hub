
interface Point {
    x: number;
    y: number;
}

type CatState = 'sleeping' | 'happy' | 'worried' | 'pained';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    type: 'sparkle' | 'chiller' | 'sweat' | 'tear' | 'zzz';
    color: string;
}

export class CatMascot {
    x: number = 0;
    y: number = 0;
    targetX: number = 0;
    targetY: number = 0;
    state: CatState = 'sleeping';
    scale: number = 1.0;
    rotation: number = 0;

    // Animation
    particles: Particle[] = [];
    frame: number = 0;
    bounceY: number = 0;

    constructor() { }

    update(pressure: number, target: Point, dt: number) {
        // Smooth movement
        const ease = 0.2;
        this.x += (target.x - this.x) * ease;
        this.y += (target.y - this.y) * ease;

        // Update State based on pressure
        // < 0.10 : Sleeping (Too light)
        // 0.10 - 0.35 : Happy (Gentle)
        // 0.35 - 0.50 : Worried (Warning)
        // > 0.50 : Pained (Too hard)

        if (pressure < 0.10) {
            this.setState('sleeping');
            this.scale = 1.0;
        } else if (pressure <= 0.35) {
            this.setState('happy');
            this.scale = 1.0;
        } else if (pressure <= 0.50) {
            this.setState('worried');
            this.scale = 1.1;
        } else {
            this.setState('pained');
            this.scale = 1.5 + Math.sin(this.frame * 0.5) * 0.1; // Pulsing
        }

        // Animation updates
        this.frame += dt * 0.01;

        if (this.state === 'happy') {
            this.bounceY = Math.sin(this.frame * 10) * 5;
            if (Math.random() < 0.1) this.spawnParticle('sparkle');
        } else if (this.state === 'sleeping') {
            this.bounceY = Math.sin(this.frame * 2) * 2;
            if (Math.random() < 0.02) this.spawnParticle('zzz');
        } else if (this.state === 'worried') {
            this.bounceY = Math.sin(this.frame * 20) * 2; // Shaking
            if (Math.random() < 0.05) this.spawnParticle('sweat');
        } else if (this.state === 'pained') {
            this.bounceY = (Math.random() - 0.5) * 10; // Violent shaking
            if (Math.random() < 0.1) this.spawnParticle('tear');
        }

        this.updateParticles();
    }

    setState(newState: CatState) {
        if (this.state !== newState) {
            this.state = newState;
            // Trigger transition effects if needed
        }
    }

    spawnParticle(type: Particle['type']) {
        const p: Particle = {
            x: this.x + (Math.random() - 0.5) * 40,
            y: this.y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 1.0,
            type,
            color: '#fff'
        };

        if (type === 'sparkle') {
            p.color = '#fbbf24'; // Gold
            p.vy = -2;
        } else if (type === 'zzz') {
            p.color = '#94a3b8'; // Slate
            p.x += 20;
            p.y -= 20;
            p.vy = -0.5;
        } else if (type === 'sweat') {
            p.color = '#3b82f6'; // Blue
            p.y -= 10;
            p.vy = 2; // Fall down
        } else if (type === 'tear') {
            p.color = '#60a5fa';
            p.vx = (Math.random() - 0.5) * 5; // Clean spray
            p.vy = 3;
        }

        this.particles.push(p);
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y + this.bounceY);
        ctx.scale(this.scale, this.scale);

        // Draw Particles (Behind cat)
        this.drawParticles(ctx, false);

        // -- Draw Cat Head --
        // Main face circle
        ctx.fillStyle = this.state === 'pained' ? '#fee2e2' : '#ffffff'; // Reddish if pained
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = this.state === 'pained' ? '#dc2626' : '#bae6fd'; // Red border if pained
        ctx.stroke();

        // Ears
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-20, -15);
        ctx.lineTo(-25, -35);
        ctx.lineTo(-10, -22);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(20, -15);
        ctx.lineTo(25, -35);
        ctx.lineTo(10, -22);
        ctx.fill();
        ctx.stroke();

        // Face Features based on state
        this.drawFace(ctx);

        // Draw Particles (In front of cat)
        this.drawParticles(ctx, true);

        ctx.restore();
    }

    drawFace(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#1e293b'; // Slate 800
        ctx.strokeStyle = '#1e293b';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;

        if (this.state === 'happy') {
            // Eyes: ^ ^
            ctx.beginPath();
            ctx.moveTo(-12, -5);
            ctx.lineTo(-7, -10);
            ctx.lineTo(-2, -5);
            ctx.moveTo(2, -5);
            ctx.lineTo(7, -10);
            ctx.lineTo(12, -5);
            ctx.stroke();

            // Mouth: w
            ctx.beginPath();
            ctx.arc(-3, 5, 3, 0, Math.PI);
            ctx.arc(3, 5, 3, 0, Math.PI);
            ctx.stroke();

            // Cheeks
            ctx.fillStyle = '#fca5a5';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(-15, 5, 5, 0, Math.PI * 2);
            ctx.arc(15, 5, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;

        } else if (this.state === 'sleeping') {
            // Eyes: - -
            ctx.beginPath();
            ctx.moveTo(-12, -2);
            ctx.lineTo(-2, -2);
            ctx.moveTo(2, -2);
            ctx.lineTo(12, -2);
            ctx.stroke();

            // Mouth: -
            ctx.beginPath();
            ctx.moveTo(-2, 8);
            ctx.lineTo(2, 8);
            ctx.stroke();

        } else if (this.state === 'worried') {
            // Eyes: o o
            ctx.beginPath();
            ctx.arc(-7, -2, 2, 0, Math.PI * 2);
            ctx.arc(7, -2, 2, 0, Math.PI * 2);
            ctx.fill();

            // Mouth: ~
            ctx.beginPath();
            ctx.moveTo(-5, 8);
            ctx.bezierCurveTo(-2, 5, 2, 11, 5, 8);
            ctx.stroke();

        } else if (this.state === 'pained') {
            // Eyes: > <
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-12, -5);
            ctx.lineTo(-7, 0);
            ctx.lineTo(-12, 5);

            ctx.moveTo(12, -5);
            ctx.lineTo(7, 0);
            ctx.lineTo(12, 5);
            ctx.stroke();

            // Mouth: O
            ctx.beginPath();
            ctx.ellipse(0, 10, 5, 8, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    drawParticles(ctx: CanvasRenderingContext2D, foreground: boolean) {
        this.particles.forEach(p => {
            // zzz is foreground, others adaptable
            if (p.life <= 0) return;

            ctx.globalAlpha = p.life;
            if (p.type === 'zzz') {
                ctx.fillStyle = p.color;
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText('Z', p.x - this.x, p.y - this.y);
            } else if (p.type === 'streak' || p.type === 'sparkle') {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x - this.x, p.y - this.y, 3, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'tear' || p.type === 'sweat') {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.ellipse(p.x - this.x, p.y - this.y, 3, 5, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        });
    }
}
