
import React, { useMemo } from 'react';
import { Rank } from '../types';

interface ParticlesProps {
    rank: Rank;
}

const Particles: React.FC<ParticlesProps> = ({ rank }) => {
    
    // Configuration for different rank tiers
    const tierConfig = useMemo(() => {
        switch (rank) {
            case 'Legend':
                return {
                    count: 40,
                    colors: ['#ff00ff', '#00ffff', '#ffffff'], // Cyberpunk/Glitch
                    bgOverlay: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-black/60 to-black',
                    particleClass: 'animate-fire-rise shadow-[0_0_10px_#ff00ff]',
                    glitchEffect: true
                };
            case 'Gold':
                return {
                    count: 35,
                    colors: ['#FFD700', '#FFA500', '#FFFFE0'], // Gold/Orange/LightYellow
                    bgOverlay: 'bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-yellow-900/30 via-black/50 to-transparent',
                    particleClass: 'animate-fire-rise shadow-[0_0_8px_#FFD700]',
                    pulseEffect: true
                };
            case 'Silver':
                return {
                    count: 25,
                    colors: ['#E0E0E0', '#B0C4DE', '#FFFFFF'], // Silver/LightBlue/White
                    bgOverlay: 'bg-[linear-gradient(to_top,_rgba(30,41,59,0.4),_transparent)]',
                    particleClass: 'animate-spark-float shadow-[0_0_5px_#E0E0E0]',
                    pulseEffect: false
                };
            case 'Bronze':
            default:
                return {
                    count: 15,
                    colors: ['#CD7F32', '#8B4513', '#A0522D'], // Bronze/SaddleBrown/Sienna
                    bgOverlay: 'bg-black/40',
                    particleClass: 'animate-fire-rise opacity-60',
                    pulseEffect: false
                };
        }
    }, [rank]);

    return (
        <>
            {/* Rank-based Atmospheric Overlay */}
            <div className={`fixed inset-0 pointer-events-none z-[-2] transition-all duration-1000 ${tierConfig.bgOverlay}`}>
                {tierConfig.pulseEffect && (
                    <div className="absolute inset-0 bg-gold-light/5 animate-glow-pulse mix-blend-overlay"></div>
                )}
                {tierConfig.glitchEffect && (
                    <div className="absolute inset-0 bg-[url('https://i.imghippo.com/files/Exm8210UFo.png')] bg-cover bg-center opacity-30 animate-glitch-bg mix-blend-color-dodge"></div>
                )}
            </div>

            {/* Particle System */}
            <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
                {Array.from({ length: tierConfig.count }).map((_, i) => {
                    const size = Math.random() * (rank === 'Legend' ? 8 : 5) + 2;
                    const color = tierConfig.colors[Math.floor(Math.random() * tierConfig.colors.length)];
                    const left = Math.random() * 100;
                    const delay = Math.random() * 5;
                    const duration = Math.random() * 5 + 3; // Faster movement for fire

                    const style: React.CSSProperties = {
                        width: `${size}px`,
                        height: `${size}px`,
                        left: `${left}vw`,
                        backgroundColor: color,
                        animationDelay: `${delay}s`,
                        animationDuration: `${duration}s`,
                        boxShadow: rank === 'Legend' || rank === 'Gold' ? `0 0 ${size * 2}px ${color}` : 'none'
                    };

                    return (
                        <div
                            key={i}
                            className={`absolute rounded-full ${tierConfig.particleClass}`}
                            style={style}
                        />
                    );
                })}
            </div>
        </>
    );
};

export default Particles;
