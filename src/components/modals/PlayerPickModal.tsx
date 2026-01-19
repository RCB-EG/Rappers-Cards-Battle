
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { Card as CardType, PlayerPickConfig } from '../../types';
import { allCards } from '../../data/gameData';
import { TranslationKey } from '../../utils/translations';
import { sfx } from '../../data/sounds';

interface PlayerPickModalProps {
    config: PlayerPickConfig;
    onComplete: (selectedCards: CardType[]) => void;
    storage: CardType[];
    formation: Record<string, CardType | null>;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
    playSfx: (key: keyof typeof sfx) => void;
}

const PlayerPickModal: React.FC<PlayerPickModalProps> = ({ config, onComplete, storage, formation, t, playSfx }) => {
    const [candidates, setCandidates] = useState<CardType[]>([]);
    const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [isGenerating, setIsGenerating] = useState(true);

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
    }, [config]);

    // Sequential Reveal Effect
    useEffect(() => {
        if (!isGenerating && candidates.length > 0) {
            candidates.forEach((_, index) => {
                setTimeout(() => {
                    playSfx('packBuildup'); // Slight sound for each reveal
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

    return (
        <Modal isOpen={true} onClose={() => {}} title={t(config.nameKey as TranslationKey)} size="xl">
            <div className="flex flex-col items-center">
                <p className="text-gray-300 mb-6 text-lg">
                    {t('pick_select_instruction', { count: config.pickCount })}
                </p>

                <div className="flex flex-wrap justify-center gap-4 mb-8">
                    {candidates.map((card, index) => {
                        const isRevealed = revealedIndices.includes(index);
                        const isSelected = selectedIndices.includes(index);
                        
                        // Check duplication
                        const isDuplicate = 
                            storage.some(c => c.name === card.name) || 
                            Object.values(formation).some(c => c?.name === card.name);

                        return (
                            <div 
                                key={card.id} 
                                onClick={() => handleSelect(index)}
                                className={`
                                    relative w-[180px] h-[270px] cursor-pointer transition-all duration-300
                                    ${!isRevealed ? 'opacity-100 scale-95' : 'opacity-100 scale-100'}
                                    ${isSelected ? 'transform -translate-y-4 drop-shadow-[0_0_15px_#00c7e2]' : 'hover:scale-105'}
                                `}
                                style={{ transitionDelay: `${index * 100}ms` }}
                            >
                                {/* Unrevealed State (The custom player pick design) */}
                                <div 
                                    className={`absolute inset-0 bg-cover bg-center rounded-lg transition-opacity duration-700 z-20 pointer-events-none ${isRevealed ? 'opacity-0' : 'opacity-100'}`}
                                    style={{ backgroundImage: 'url("https://i.imghippo.com/files/cGUh9927EWc.png")' }}
                                />
                                
                                {/* Revealed State (The actual Card) */}
                                <div className={`absolute inset-0 z-10 transition-opacity duration-700 ${isRevealed ? 'opacity-100' : 'opacity-0'}`}>
                                    <Card card={card} />
                                    
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
        </Modal>
    );
};

export default PlayerPickModal;
