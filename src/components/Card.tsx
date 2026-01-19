
import React, { useState, useEffect } from 'react';
import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  className?: string;
  origin?: string;
  isEvolving?: boolean;
  [x: string]: any; // Capture event handlers and other DOM attributes
}

const Card: React.FC<CardProps> = ({ card, className = '', origin, isEvolving = false, ...props }) => {
  const [imageError, setImageError] = useState(false);

  // Reset error state when card changes
  useEffect(() => {
    setImageError(false);
  }, [card.image]);

  const rarityBgUrls: Record<string, string> = {
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
    relative w-[150px] h-[225px] md:w-[180px] md:h-[270px]
    select-none 
    rounded-lg overflow-hidden
    drop-shadow-[0_5px_10px_rgba(0,0,0,0.7)] 
    transition-transform duration-200 ease-in-out 
    hover:-translate-y-1 hover:scale-105 hover:drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]
    rarity-${card.rarity}
    ${specialRarityClass}
    ${isEvolving ? 'is-evolving' : ''}
    ${className}
  `;
  
  // Style to prevent mobile context menu and selection
  const cardStyle: React.CSSProperties = {
    WebkitTouchCallout: 'none', // iOS Safari
    userSelect: 'none',
    WebkitUserSelect: 'none', // Safari
    MozUserSelect: 'none', // Firefox
    msUserSelect: 'none', // IE/Edge
  };

  const bgUrl = rarityBgUrls[card.rarity] || rarityBgUrls['gold'];

  return (
    <div
      className={cardContainerClasses}
      data-card-id={card.id}
      data-origin={origin}
      style={cardStyle}
      onContextMenu={(e) => e.preventDefault()}
      {...props}
    >
      {/* Base layer: ImgHippo Image Background */}
      <div className={`absolute inset-0 z-0 bg-cover bg-center`} style={{backgroundImage: `url('${bgUrl}')`}} />
      
      {/* Detail layer: Character Image */}
      {/* Only show image if no error. */}
      {!imageError && (
        <div className="absolute top-0 left-0 w-full h-full z-10 flex items-center justify-center">
            <img 
              className="w-full h-full object-cover" 
              src={card.image} 
              alt={card.name}
              onError={() => setImageError(true)}
            />
        </div>
      )}

      {/* Fallback Initials if image fails */}
      {imageError && (
         <div className="absolute inset-0 z-10 flex items-center justify-center">
            <span className="text-6xl font-header text-white/20 uppercase">{card.name.substring(0, 2)}</span>
         </div>
      )}
    </div>
  );
};

export default Card;
