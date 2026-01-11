import React, { useState, useEffect, useMemo } from 'react';
import { Card as CardType } from '../../types';
import Card from '../Card';
import { sfx, getRevealSfxKey } from '../../data/sounds';

interface PackAnimationModalProps {
  card: CardType | null;
  onAnimationEnd: (card: CardType) => void;
  playSfx: (soundKey: keyof typeof sfx) => void;
}

const getAnimationDetails = (rarity: CardType['rarity']) => {
    switch (rarity) {
        case 'silver':
            return { tier: 2, revealDelay: 1800, totalDuration: 3500 };
        case 'gold':
            return { tier: 3, revealDelay: 2500, totalDuration: 4500 };
        case 'rotm':
        case 'icon':
        case 'legend':
        case 'event':
            return { tier: 4, revealDelay: 3000, totalDuration: 5500 };
        case 'bronze':
        default:
            return { tier: 1, revealDelay: 1200, totalDuration: 2500 };
    }
};

const PackAnimationModal: React.FC<PackAnimationModalProps> = ({ card, onAnimationEnd, playSfx }) => {
    const [isRevealing, setIsRevealing] = useState(false);

    const animationDetails = useMemo(() => card ? getAnimationDetails(card.rarity) : null, [card]);

    useEffect(() => {
        if (card && animationDetails) {
            const { revealDelay, totalDuration } = animationDetails;

            const revealTimer = setTimeout(() => {
                setIsRevealing(true);
                const revealSoundKey = getRevealSfxKey(card.rarity);
                playSfx(revealSoundKey);
            }, revealDelay - 500);

            const endTimer = setTimeout(() => {
                onAnimationEnd(card);
            }, totalDuration);

            return () => {
                clearTimeout(revealTimer);
                clearTimeout(endTimer);
                setIsRevealing(false);
            };
        }
    }, [card, animationDetails, onAnimationEnd, playSfx]);

    if (!card || !animationDetails) return null;

    const { tier } = animationDetails;

    const rarityGlowColors: Record<CardType['rarity'], string> = {
        bronze: '#cd7f32',
        silver: '#c0c0c0',
        gold: '#ffd700',
        rotm: '#e364a7',
        icon: '#00c7e2',
        legend: '#f2f2f2',
        event: '#33ffdd'
    };
    const rarityColor = rarityGlowColors[card.rarity] || '#FFD700';
    
    // The `reveal` class, reveal-delay, and animation-* classes are all handled by the CSS in index.html
    const containerClasses = `fixed inset-0 bg-black z-[200] flex justify-center items-center overflow-hidden tier-${tier}`;
    
    const cardContainerClasses = `
        relative
        [transform-style:preserve-3d]
        ${isRevealing ? 'reveal' : ''}
    `;

    return (
        <div id="pack-animation-modal" className={containerClasses} style={{ '--rarity-glow-color': rarityColor, '--reveal-delay': `${animationDetails.revealDelay}ms` } as React.CSSProperties}>
            <div className="animation-vignette"></div>
            <div className="animation-flare"></div>
            
            <div id="animation-card-container" className={cardContainerClasses}>
                <Card card={card} origin="animation" />
            </div>
        </div>
    );
};

export default PackAnimationModal;