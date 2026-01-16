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

  const getEmptyCardUrl = (rarity: string) => {
      let rarityLabel = rarity.charAt(0).toUpperCase() + rarity.slice(1);
      if (rarity === 'rotm') rarityLabel = 'ROTM';
      if (rarity === 'event') rarityLabel = 'Evo'; 
      // Using GitHub Game Assets folder
      return `https://raw.githubusercontent.com/RCB-EG/Rappers-Cards-Battle/main/Game%20Assets/${rarityLabel}%20Card%20Empty.png`;
  };

  // Fallback CSS Gradients for Rarity Backgrounds if images fail entirely
  const rarityBgClasses: Record<string, string> = {
    bronze: 'bg-gradient-to-br from-orange-900 to-amber-700 border-2 border-orange-900',
    silver: 'bg-gradient-to-br from-gray-400 to-gray-200 border-2 border-gray-400',
    gold: 'bg-gradient-to-br from-yellow-600 to-yellow-300 border-2 border-yellow-600',
    rotm: 'bg-gradient-to-br from-purple-800 to-pink-500 border-2 border-pink-500',
    icon: 'bg-gradient-to-br from-blue-800 to-cyan-400 border-2 border-cyan-400',
    legend: 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 border-2 border-purple-400',
    event: 'bg-gradient-to-br from-teal-800 to-emerald-400 border-2 border-emerald-400'
  };

  const specialRarityClass = card.rarity === 'legend' ? 'is-legendary' : card.rarity === 'event' ? 'is-event' : '';

  const cardContainerClasses = `
    card-container 
    relative w-[180px] h-[270px] 
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

  const bgClass = rarityBgClasses[card.rarity] || 'bg-gray-800';

  return (
    <div
      className={cardContainerClasses}
      data-card-id={card.id}
      data-origin={origin}
      style={cardStyle}
      onContextMenu={(e) => e.preventDefault()}
      {...props}
    >
      {/* Base layer: GitHub Image Background (preferred) or Gradient (fallback) */}
      <div className={`absolute inset-0 z-0 bg-cover bg-center`} style={{backgroundImage: `url('${getEmptyCardUrl(card.rarity)}')`}} >
         {/* Fallback gradient if image fails to load/is transparent - this sits behind the bg image */}
         <div className={`absolute inset-0 -z-10 ${bgClass}`} />
      </div>
      
      {/* Decorative Pattern overlay (Only visible if image background fails or has transparency) */}
      <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] z-0 pointer-events-none" />

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
            <div className="flex flex-col items-center">
                <span className="text-6xl font-header text-white/20 uppercase">{card.name.substring(0, 2)}</span>
                <span className="text-sm font-main text-white/40">{card.name}</span>
            </div>
         </div>
      )}
    </div>
  );
};

export default Card;