
import React from 'react';
import { BattleCard } from '../../types';
import Card from '../Card';

interface BattleCardRenderProps {
    card: BattleCard;
    isInteractable: boolean;
    isSelected?: boolean;
    onClick?: () => void;
    shakeIntensity: number;
    onRef: (el: HTMLDivElement | null) => void;
    smallScale?: boolean;
}

const BattleCardRender: React.FC<BattleCardRenderProps> = ({ card, isInteractable, isSelected, onClick, shakeIntensity, onRef, smallScale = false }) => {
    const isDead = card.currentHp <= 0;
    const isDefending = card.mode === 'defense';
    const isPoisoned = card.activeEffects.some(e => e.type === 'poison');
    const isStunned = card.activeEffects.some(e => e.type === 'stun');
    const isSilenced = card.activeEffects.some(e => e.type === 'silence');
    const isTaunting = card.activeEffects.some(e => e.type === 'taunt');
    const isUntargetable = card.activeEffects.some(e => e.type === 'untargetable');
    const isBuffed = card.activeEffects.some(e => e.type === 'buff');

    const hpPercent = (card.currentHp / card.maxHp) * 100;
    const hpColor = hpPercent > 50 ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : hpPercent > 20 ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : 'bg-red-600 shadow-[0_0_10px_#dc2626]';

    const shakeClass = 
        shakeIntensity >= 3 ? 'animate-shake-extreme' : 
        shakeIntensity === 2 ? 'animate-shake-heavy' : 
        shakeIntensity === 1 ? 'animate-shake-mild' : '';

    const sizeClass = smallScale 
        ? "w-[80px] h-[120px] md:w-[100px] md:h-[150px]" 
        : "w-[80px] h-[120px] md:w-[120px] md:h-[180px]";

    return (
        <div 
            ref={onRef}
            onClick={() => !isDead && isInteractable && onClick && onClick()}
            className={`
                relative transition-all duration-300
                ${isDead ? 'opacity-0 scale-75 pointer-events-none grayscale blur-sm' : 'opacity-100'}
                ${!isDead && !isInteractable ? 'opacity-70 filter grayscale-[0.6]' : ''}
                ${isInteractable ? 'cursor-pointer hover:scale-105 hover:brightness-110 hover:z-20' : ''}
                ${isSelected ? 'ring-4 ring-gold-light scale-110 z-10 shadow-[0_0_20px_#FFD700]' : ''}
                ${sizeClass}
                ${shakeClass}
            `}
        >
            <div className={`w-full h-full relative transition-transform duration-500 rounded-lg overflow-hidden ${isDefending ? 'rotate-90 scale-90' : ''}`}>
                <Card card={card} className="!w-full !h-full" />
                
                {/* Hit Flash Overlay */}
                {shakeIntensity > 0 && (
                    <div className="absolute inset-0 bg-white/50 mix-blend-overlay animate-flash-hit pointer-events-none z-30" />
                )}

                {isDefending && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none bg-blue-900/30">
                        <div className="bg-black/60 p-2 rounded-full border-2 border-blue-400 shadow-[0_0_25px_#60a5fa] animate-pulse">
                            <span className="text-3xl filter drop-shadow-[0_0_5px_blue]">🛡️</span>
                        </div>
                    </div>
                )}
                {isStunned && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/50 backdrop-blur-[2px] animate-pulse">
                        <span className="text-5xl filter drop-shadow-[0_0_10px_yellow]">💫</span>
                    </div>
                )}
                {isUntargetable && (
                    <div className="absolute inset-0 bg-blue-400/20 border-2 border-blue-400/50 z-20 pointer-events-none animate-ghost-float backdrop-opacity-50" />
                )}
                {isBuffed && !isDead && (
                    <div className="absolute bottom-0 inset-x-0 h-2/3 bg-gradient-to-t from-yellow-500/30 to-transparent z-10 animate-pulse pointer-events-none" />
                )}
            </div>
            
            {/* Status Icons */}
            <div className="absolute -top-4 left-0 right-0 flex justify-center gap-1 z-40 pointer-events-none perspective-[500px]">
                {isPoisoned && <span className="bg-green-900 text-green-200 text-xs px-1.5 py-0.5 rounded border border-green-500 animate-bounce shadow-lg">☠️</span>}
                {isSilenced && <span className="bg-gray-800 text-gray-200 text-xs px-1.5 py-0.5 rounded border border-gray-500 shadow-lg">🤐</span>}
                {isTaunting && <span className="bg-red-900 text-red-200 text-xs px-1.5 py-0.5 rounded border border-red-500 animate-pulse shadow-lg">💢</span>}
                {isBuffed && <span className="bg-yellow-900 text-yellow-200 text-xs px-1.5 py-0.5 rounded border border-yellow-500 shadow-lg">💪</span>}
            </div>

            {/* Health & Stats */}
            <div className="absolute -bottom-8 left-0 right-0 z-30 flex flex-col items-center pointer-events-none">
                <div className="w-full h-4 bg-gray-900 rounded-full border border-gray-600 overflow-hidden relative mb-1 shadow-md">
                    <div className={`h-full ${hpColor} transition-all duration-300 relative`} style={{ width: `${hpPercent}%` }}>
                        <div className="absolute inset-0 bg-white/20 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    </div>
                    <span className="absolute inset-0 text-[9px] font-bold flex items-center justify-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] tracking-wider">
                        {Math.ceil(card.currentHp)}/{card.maxHp}
                    </span>
                </div>
                <div className={`px-3 py-0.5 rounded-full border flex items-center gap-1 shadow-lg ${isBuffed ? 'bg-green-900/90 border-green-500' : 'bg-black/80 border-gray-600'}`}>
                    <span className="text-[9px] text-gray-400 uppercase tracking-widest">ATK</span>
                    <span className={`text-sm font-bold ${isBuffed ? 'text-green-400' : 'text-white'}`}>{card.atk}</span>
                </div>
            </div>
        </div>
    );
};

export default BattleCardRender;
