
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card as CardType } from '../../types';
import Card from '../Card';
import Button from '../Button';
import { sfx, getRevealSfxKey } from '../../data/sounds';
import { useRarity } from '../../contexts/RarityContext';

interface PackAnimationModalProps {
  card: CardType | null;
  onAnimationEnd: (card: CardType) => void;
  playSfx: (soundKey: keyof typeof sfx) => void;
}

// Particle System Class
class Particle {
    x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
    constructor(w: number, h: number, colors: string[]) {
      this.x = w / 2;
      this.y = h / 2;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 20 + 5;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = 1.0;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.size = Math.random() * 6 + 2;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.94; // friction
      this.vy *= 0.94;
      this.life -= 0.01;
    }
    draw(ctx: CanvasRenderingContext2D) {
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
}

const PackAnimationModal: React.FC<PackAnimationModalProps> = ({ card, onAnimationEnd, playSfx }) => {
    const [isRevealing, setIsRevealing] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number | null>(null);
    const hasPlayedBuildup = useRef(false);
    
    const { getRarityDef } = useRarity();

    // Use dynamic rarity definition for animation config
    const animationDetails = useMemo(() => {
        if (!card) return null;
        const def = getRarityDef(card.rarity);
        const tier = def.animationTier || 1;
        
        switch (tier) {
            case 5: // Ultimate
                return { tier: 5, revealDelay: 4500, totalDuration: 7500 };
            case 4: // Legendary
                return { tier: 4, revealDelay: 2000, totalDuration: 4000 };
            case 3: // Epic
                return { tier: 3, revealDelay: 1600, totalDuration: 3500 };
            case 2: // Rare
                return { tier: 2, revealDelay: 1100, totalDuration: 2500 };
            default: // Basic
                return { tier: 1, revealDelay: 800, totalDuration: 2000 };
        }
    }, [card, getRarityDef]);

    useEffect(() => {
        // Trigger buildup immediately on mount
        if (!hasPlayedBuildup.current) {
            playSfx('packBuildup');
            hasPlayedBuildup.current = true;
        }

        if (card && animationDetails) {
            const { revealDelay, totalDuration } = animationDetails;

            const revealTimer = setTimeout(() => {
                setIsRevealing(true);
                const revealSoundKey = getRevealSfxKey(card.rarity);
                playSfx(revealSoundKey);
            }, revealDelay);

            const endTimer = setTimeout(() => {
                onAnimationEnd(card);
            }, totalDuration);

            return () => {
                clearTimeout(revealTimer);
                clearTimeout(endTimer);
                setIsRevealing(false);
                if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            };
        }
    }, [card, animationDetails, onAnimationEnd, playSfx]);

    // Particle Effect Logic
    useEffect(() => {
        if (isRevealing && card && animationDetails && animationDetails.tier >= 3) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            const particles: Particle[] = [];
            let colors = ['#FFD700', '#FFA500', '#FFFFFF']; // Gold default
            if (card.rarity === 'legend') colors = ['#FF00FF', '#00FFFF', '#FFFFFF']; // Cyberpunk
            if (card.rarity === 'event') colors = ['#00FFCC', '#FFFFFF', '#0099FF'];
            if (card.rarity === 'icon') colors = ['#00C7E2', '#FFFFFF'];
            
            // Tier 5 gets custom rainbow colors or specific logic
            if (animationDetails.tier === 5) {
                 colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
            }

            // Spawn explosion
            for (let i = 0; i < (animationDetails.tier === 5 ? 300 : 150); i++) {
                particles.push(new Particle(canvas.width, canvas.height, colors));
            }

            const render = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < particles.length; i++) {
                    particles[i].update();
                    particles[i].draw(ctx);
                }
                if (particles.some(p => p.life > 0)) {
                    animFrameRef.current = requestAnimationFrame(render);
                }
            };
            render();
        }
    }, [isRevealing, card, animationDetails]);

    const handleSkip = () => {
        if (card) {
            onAnimationEnd(card);
        }
    };

    if (!card || !animationDetails) return null;

    const { tier } = animationDetails;
    const rarityDef = getRarityDef(card.rarity);
    const rarityColor = rarityDef.color || '#FFD700';
    
    // Tier 5 uses specific styles in index.html, tier-5 class
    const containerClasses = `fixed inset-0 bg-black z-[200] flex justify-center items-center overflow-hidden tier-${tier} ${isRevealing && tier >= 4 ? 'shake-screen' : ''}`;
    
    const cardContainerClasses = `
        relative
        [transform-style:preserve-3d]
        ${isRevealing ? 'reveal' : ''}
    `;

    return (
        <div id="pack-animation-modal" className={containerClasses} style={{ '--rarity-glow-color': rarityColor, '--reveal-delay': '0s' } as React.CSSProperties}>
            {isRevealing && tier >= 4 && <div className="flash-overlay"></div>}
            
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-50" />
            
            <div className="animation-vignette"></div>
            
            {/* God Rays for High Tiers */}
            {tier >= 3 && <div className={`god-rays ${isRevealing ? 'opacity-100' : 'opacity-0'}`}></div>}
            
            <div className="animation-flare"></div>
            
            <div id="animation-card-container" className={cardContainerClasses}>
                <Card card={card} origin="animation" />
            </div>

            <div className="absolute bottom-8 right-8 z-[210]">
                <Button variant="default" onClick={handleSkip} className="opacity-80 hover:opacity-100 !py-2 !px-4 text-sm bg-black/50 border-gray-600">
                    Skip
                </Button>
            </div>
        </div>
    );
};

export default PackAnimationModal;
