
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { Card as CardType, PlayerPickConfig } from '../../types';
import { TranslationKey } from '../../utils/translations';
import { sfx } from '../../data/sounds';
import CardInspectModal from './CardInspectModal';

interface PlayerPickModalProps {
    config: PlayerPickConfig;
    onComplete: (selectedCards: CardType[]) => void;
    storage: CardType[];
    formation: Record<string, CardType | null>;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
    playSfx: (key: keyof typeof sfx) => void;
    allCards: CardType[];
}

const rarityColors: Record<string, string> = {
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    rotm: '#e364a7',
    icon: '#00c7e2',
    legend: '#ffffff',
    event: '#33ffdd'
};

const PlayerPickModal: React.FC<PlayerPickModalProps> = ({ config, onComplete, storage, formation, t, playSfx, allCards }) => {
    const [candidates, setCandidates] = useState<CardType[]>([]);
    const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [isGenerating, setIsGenerating] = useState(true);
    const [inspectCard, setInspectCard] = useState<CardType | null>(null);

    // Initial Random Generation with Weighting
    useEffect(() => {
        // Filter eligible cards
        const available = allCards.filter(c => {
            if (config.rarityGuarantee && c.rarity !== config.rarityGuarantee) return false;
            return c.ovr >= config.minOvr && c.isPackable !== false;
        });

        // Aggressive Weighting function to fix high-rated skew
        const getPickWeight = (card: CardType) => {
            let weight = 0;

            // Base Weight by OVR
            if (card.ovr <= 80) weight = 500;       // Extremely Common (78-80)
            else if (card.ovr <= 82) weight = 200;  // Common (81-82)
            else if (card.ovr <= 84) weight = 60;   // Uncommon (83-84)
            else if (card.ovr <= 86) weight = 15;   // Rare (85-86)
            else if (card.ovr <= 88) weight = 4;    // Very Rare (87-88)
            else weight = 1;                        // Ultra Rare (89+)

            // Rarity Penalties (Drastically reduce chance of non-standard cards in generic picks)
            // Unless the config explicitly asks for them via rarityGuarantee
            if (!config.rarityGuarantee) {
                if (card.rarity === 'rotm') weight *= 0.1;
                if (card.rarity === 'icon') weight *= 0.05;
                if (card.rarity === 'legend') weight *= 0.01;
                if (card.rarity === 'event') weight *= 0.15;
            }

            return Math.max(0.1, weight);
        };

        const selectWeightedCard = (pool: CardType[]): CardType => {
            const totalWeight = pool.reduce((sum, c) => sum + getPickWeight(c), 0);
            let random = Math.random() * totalWeight;
            for (const card of pool) {
                random -= getPickWeight(card);
                if (random < 0) return card;
            }
            return pool[0];
        };

        const picks: CardType[] = [];
        const usedTemplateIds = new Set<string>();

        // Fallback if pool is too small
        const pool = available.length >= config.totalOptions ? available : allCards;

        for (let i = 0; i < config.totalOptions; i++) {
            let attempts = 0;
            let candidate: CardType | null = null;
            
            // Try to find a unique card template (not same player twice in one pick)
            while ((!candidate || usedTemplateIds.has(candidate.id)) && attempts < 50) {
                candidate = selectWeightedCard(pool);
                attempts++;
            }
            
            // If failed to find unique, just pick any
            if (!candidate) candidate = pool[Math.floor(Math.random() * pool.length)];

            // Generate unique instance ID for this specific pick session
            const instanceCard = { ...candidate, id: `${candidate.id}-${Date.now()}-${i}` };
            picks.push(instanceCard);
            usedTemplateIds.add(candidate.id);
        }

        setCandidates(picks);
        setIsGenerating(false);
        
    }, [config, allCards]);

    // Sequential Reveal Effect
    useEffect(() => {
        if (!isGenerating && candidates.length > 0) {
            candidates.forEach((card, index) => {
                setTimeout(() => {
                    const soundKey = 
                        (card.rarity === 'rotm' || card.rarity === 'icon' || card.rarity === 'legend') 
                        ? 'revealIcon' 
                        : card.rarity === 'gold' 
                        ? 'revealGold' 
                        : 'packBuildup';
                        
                    playSfx(soundKey);
                    setRevealedIndices(prev => [...prev, index]);
                }, 500 + (index * 800)); // Staggered reveal
            });
        }
    }, [isGenerating, candidates, playSfx]);

    const handleSelect = (index: number) => {
        if (!revealedIndices.includes(index)) return;

        if (selectedIndices.includes(index)) {
            setSelectedIndices(prev => prev.filter(i => i !== index));
        } else {
            if (selectedIndices.length < config.pickCount) {
                setSelectedIndices(prev => [...prev, index]);
            } else if (config.pickCount === 1) {
                // If only 1 pick allowed, switch selection instantly
                setSelectedIndices([index]);
            }
        }
    };

    const handleConfirm = () => {
        if (selectedIndices.length === config.pickCount) {
            const selectedCards = selectedIndices.map(i => candidates[i]);
            onComplete(selectedCards);
        }
    };

    const pickTitle = config.name || t(config.nameKey as TranslationKey);

    return (
        <>
            <Modal isOpen={true} onClose={() => {}} title={pickTitle} size="xl">
                {isGenerating ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="w-12 h-12 border-4 border-gold-light/30 border-t-gold-light rounded-full animate-spin mb-4"></div>
                        <p className="text-gold-light">Scouting players...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <p className="text-gray-300 mb-6 text-lg">
                            {t('pick_select_instruction', { count: config.pickCount })}
                        </p>

                        <div className="flex flex-wrap justify-center gap-6 mb-8">
                            {candidates.map((card, index) => {
                                const isRevealed = revealedIndices.includes(index);
                                const isSelected = selectedIndices.includes(index);
                                const rarityColor = rarityColors[card.rarity] || '#ffffff';
                                
                                // Check duplication
                                const isDuplicate = 
                                    storage.some(c => c.name === card.name && c.rarity === card.rarity) || 
                                    (Object.values(formation) as (CardType | null)[]).some(c => c?.name === card.name && c?.rarity === card.rarity);

                                // Use Drop Shadow filter instead of Box Shadow for shape-conforming glow
                                const glowStyle = isRevealed ? {
                                    filter: isSelected 
                                        ? `drop-shadow(0 0 8px #00c7e2) drop-shadow(0 0 16px #00c7e2)` 
                                        : `drop-shadow(0 0 6px ${rarityColor}) drop-shadow(0 0 12px ${rarityColor}66)`,
                                    transitionDelay: `${index * 100}ms`,
                                    // Apply transform directly via style to ensure it works with the filter transition
                                    transform: isSelected ? 'translateY(-1rem) scale(1.05)' : 'none'
                                } : {
                                    transitionDelay: `${index * 100}ms`
                                };

                                return (
                                    <div 
                                        key={card.id} 
                                        onClick={() => handleSelect(index)}
                                        className={`
                                            relative w-[180px] h-[270px] cursor-pointer transition-all duration-500 rounded-lg group
                                            ${!isRevealed ? 'opacity-100 scale-95' : 'opacity-100 scale-100 pick-reveal-pop'}
                                            ${!isSelected ? 'hover:scale-105 hover:z-10' : 'z-20'}
                                        `}
                                        style={glowStyle}
                                    >
                                        {/* Unrevealed State: Use img tag to allow filter: drop-shadow to respect alpha channel */}
                                        <img 
                                            src="https://i.imghippo.com/files/cGUh9927EWc.png"
                                            alt="Pick Cover"
                                            className={`absolute inset-0 w-full h-full object-cover rounded-lg transition-opacity duration-300 z-20 pointer-events-none ${isRevealed ? 'opacity-0' : 'opacity-100'}`}
                                        />
                                        
                                        {/* Revealed State (The actual Card) */}
                                        <div className={`absolute inset-0 z-10 transition-opacity duration-300 ${isRevealed ? 'opacity-100' : 'opacity-0'}`}>
                                            <Card card={card} />
                                            
                                            {/* Inspect Button Overlay - Only visible when revealed */}
                                            {isRevealed && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setInspectCard(card); }}
                                                    className="absolute top-2 right-2 bg-black/70 hover:bg-gold-dark text-white rounded-full w-8 h-8 flex items-center justify-center border border-gold-light z-50 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                                                    title="Inspect Details"
                                                >
                                                    <span className="text-lg font-bold">i</span>
                                                </button>
                                            )}

                                            {/* Flash Effect on Reveal - Tinted with rarity color */}
                                            {isRevealed && (
                                                <div 
                                                    className="absolute inset-0 flash-overlay z-40 rounded-lg pointer-events-none mix-blend-overlay" 
                                                    style={{ 
                                                        animationDuration: '0.8s',
                                                        backgroundColor: rarityColor 
                                                    }} 
                                                />
                                            )}
                                            {/* Additional White Flash for brightness */}
                                            {isRevealed && (
                                                <div 
                                                    className="absolute inset-0 flash-overlay z-40 rounded-lg pointer-events-none" 
                                                    style={{ animationDuration: '0.4s' }} 
                                                />
                                            )}

                                            {/* Duplicate Overlay */}
                                            {isDuplicate && (
                                                <div className="absolute top-2 inset-x-2 bg-red-600/90 text-white text-xs font-bold text-center py-1 rounded shadow-md border border-red-400 z-30">
                                                    DUPLICATE
                                                </div>
                                            )}
                                        </div>

                                        {/* Selection Indicator */}
                                        {isSelected && (
                                            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-glow text-black text-xs font-bold px-2 py-1 rounded-full animate-bounce z-30 shadow-lg border border-white">
                                                SELECTED
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <Button 
                            variant="keep" 
                            onClick={handleConfirm} 
                            disabled={selectedIndices.length !== config.pickCount}
                            className="w-full max-w-xs"
                        >
                            {t('confirm_pick')}
                        </Button>
                    </div>
                )}
            </Modal>

            {/* Inspection Modal */}
            <CardInspectModal 
                card={inspectCard} 
                onClose={() => setInspectCard(null)} 
                t={t} 
            />
        </>
    );
};

export default PlayerPickModal;
