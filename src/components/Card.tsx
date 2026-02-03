
import React, { useState, useEffect } from 'react';
import { Card as CardType } from '../types';
import { useRarity } from '../contexts/RarityContext';

interface CardProps {
  card: CardType;
  className?: string;
  origin?: string;
  isEvolving?: boolean;
  [x: string]: any; // Capture event handlers and other DOM attributes
}

const Card: React.FC<CardProps> = ({ card, className = '', origin, isEvolving = false, ...props }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { getRarityDef } = useRarity();

  // Reset states when card changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [card.image, card.id]);

  const rarityDef = getRarityDef(card.rarity);
  const isDefaultRarity = ['bronze', 'silver', 'gold', 'rotm', 'icon', 'legend', 'event'].includes(card.rarity);

  const specialRarityClass = card.rarity === 'legend' ? 'is-legendary' : card.rarity === 'event' ? 'is-event' : '';
  const dynamicClass = !isDefaultRarity ? 'rarity-dynamic' : `rarity-${card.rarity}`;

  const cardContainerClasses = `
    card-container 
    relative w-[150px] h-[225px] md:w-[180px] md:h-[270px]
    select-none 
    rounded-lg overflow-hidden
    drop-shadow-[0_5px_10px_rgba(0,0,0,0.7)] 
    transition-transform duration-200 ease-in-out 
    hover:-translate-y-1 hover:scale-105 hover:drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]
    ${dynamicClass}
    ${specialRarityClass}
    ${isEvolving ? 'is-evolving' : ''}
    ${className}
  `;
  
  // Style to prevent mobile context menu and selection + Dynamic Rarity Color
  const cardStyle: React.CSSProperties = {
    WebkitTouchCallout: 'none', // iOS Safari
    userSelect: 'none',
    WebkitUserSelect: 'none', // Safari
    MozUserSelect: 'none', // Firefox
    msUserSelect: 'none', // IE/Edge
    // @ts-ignore - Custom CSS variable
    '--glow-color': rarityDef.color
  };

  const bgUrl = rarityDef.baseImage;

  // Default scale logic: New cards (non-legacy) get 1.05X width by default
  const defaultScaleX = card.legacy ? 1 : 1.05;
  const scaleX = card.customScaleX ?? defaultScaleX;
  const scaleY = card.customScaleY ?? 1;

  const transformStyle = card.customScale 
    ? `scale(${card.customScale})` 
    : `scale(${scaleX}, ${scaleY})`;

  const imgStyle: React.CSSProperties = {
      transform: transformStyle
  };

  return (
    <div
      className={cardContainerClasses}
      data-card-id={card.id}
      data-origin={origin}
      style={cardStyle}
      onContextMenu={(e) => e.preventDefault()}
      {...props}
    >
      {/* Base layer: Card Background (Frame). Hidden if image loaded and not animating to prevent clipping/double-borders. */}
      {(!imageLoaded || origin === 'animation') && (
         <div className={`absolute inset-0 z-0 bg-cover bg-center`} style={{backgroundImage: `url('${bgUrl}')`}} />
      )}
      
      {/* Detail layer: Character Image */}
      {!imageError && (
        <img 
          className="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-200"
          style={imgStyle}
          src={card.image} 
          alt={card.name}
          onLoad={() => setImageLoaded(true)}
          onError={() => { setImageError(true); setImageLoaded(true); }}
        />
      )}

      {/* Fallback Initials if image fails */}
      {imageError && (
         <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900">
            <span className="text-6xl font-header text-white/20 uppercase">{card.name.substring(0, 2)}</span>
         </div>
      )}
    </div>
  );
};

export default Card;
