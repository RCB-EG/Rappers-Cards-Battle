import React from 'react';
import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  className?: string;
  origin?: string;
  isEvolving?: boolean;
  [x: string]: any; // Capture event handlers and other DOM attributes
}

const Card: React.FC<CardProps> = ({ card, className = '', origin, isEvolving = false, ...props }) => {
  // These are the generic "empty" card designs for each tier.
  // The pack animation will show this first.
  const rarityBgUrls = {
    bronze: 'https://i.imghippo.com/files/TmM6820WtQ.png',
    silver: 'https://i.imghippo.com/files/zC9861peQ.png',
    gold: 'https://i.imghippo.com/files/tUt8745JBc.png',
    rotm: 'https://i.imghippo.com/files/UGRy5126YM.png',
    icon: 'https://i.imghippo.com/files/PjIu1716584980.png',
    legend: 'https://i.imghippo.com/files/jdCC2070F.png',
    event: 'https://i.imghippo.com/files/jdCC2070F.png'
  };

  const specialRarityClass = card.rarity === 'legend' ? 'is-legendary' : card.rarity === 'event' ? 'is-event' : '';

  const cardContainerClasses = `
    card-container 
    relative w-[180px] h-[270px] 
    select-none 
    drop-shadow-[0_5px_10px_rgba(0,0,0,0.7)] 
    transition-transform duration-200 ease-in-out 
    hover:-translate-y-1 hover:scale-105 hover:drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]
    rarity-${card.rarity}
    ${specialRarityClass}
    ${isEvolving ? 'is-evolving' : ''}
    ${className}
  `;

  return (
    <div
      className={cardContainerClasses}
      data-card-id={card.id}
      data-origin={origin}
      {...props}
    >
      {/* Base layer: Generic rarity background. This is the :first-child for the animation. */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: `url(${rarityBgUrls[card.rarity]})` }}
      />
      
      {/* Detail layer: The final custom card image. This is a :not(:first-child) for the animation. */}
      {/* It sits on top of the base layer, hiding it in normal view. */}
      <img 
        className="absolute inset-0 w-full h-full object-cover z-10" 
        src={card.image} 
        alt={card.name} 
      />
    </div>
  );
};

export default Card;