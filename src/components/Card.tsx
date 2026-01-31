
import React, { useState, useEffect } from 'react';
import { Card as CardType } from '../types';
import { rarityBgUrls } from '../utils/assets';

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

  // Reset states when card changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [card.image, card.id]);

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

  // Default scale logic: New cards (non-legacy) get 1.05X width by default
  const defaultScaleX = card.legacy ? 1 : 1.05;
  const scaleX = card.customScaleX ?? defaultScaleX;
  const scaleY = card.customScaleY ?? 1;

  const transformStyle = card.customScale 
    ? `scale(${card.customScale})` 
    : `scale(${scaleX}, ${scaleY})`;

  const isLoading = !imageLoaded && !imageError;

  return (
    <div
      className={cardContainerClasses}
      data-card-id={card.id}
      data-origin={origin}
      style={cardStyle}
      onContextMenu={(e) => e.preventDefault()}
      {...props}
    >
      {/* Base layer: Card Background (Frame). Always visible to provide structure. */}
      <div className={`absolute inset-0 z-0 bg-cover bg-center`} style={{backgroundImage: `url('${bgUrl}')`}} />
      
      {/* Loading State - Spinner */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
            <div className="w-8 h-8 border-4 border-gold-light/50 border-t-gold-light rounded-full animate-spin"></div>
        </div>
      )}

      {/* Detail layer: Character Image */}
      {!imageError && (
        <img 
          className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-500 ease-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ transform: transformStyle }}
          src={card.image} 
          alt={card.name}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => { 
              // console.warn(`Failed to load image for ${card.name}`);
              setImageError(true); 
              setImageLoaded(true); 
          }}
        />
      )}

      {/* Fallback if image fails - Show silhouette/question mark instead of initials box */}
      {imageError && (
         <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
            {/* We keep the background frame visible, just overlay a subtle indicator */}
            <div className="bg-black/50 p-2 rounded-full backdrop-blur-sm border border-white/10">
                <span className="text-2xl opacity-70">👤</span>
            </div>
            <span className="text-[10px] text-white/70 mt-2 px-2 text-center font-bold bg-black/40 rounded">{card.name}</span>
         </div>
      )}
    </div>
  );
};

export default Card;
