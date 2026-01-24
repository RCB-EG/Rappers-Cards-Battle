
import React, { useState } from 'react';
import { Card as CardType } from '../../types';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { TranslationKey } from '../../utils/translations';
import { calculateQuickSellValue } from '../../utils/cardUtils';
import { superpowerIcons } from '../../data/gameData';

interface CardOptionsModalProps {
  cardWithOptions: { card: CardType; origin: 'formation' | 'storage' } | null;
  onClose: () => void;
  onListCard: (card: CardType) => void;
  onQuickSell: (card: CardType) => void;
  onAddToFormation: (card: CardType) => void;
  onSendToStorage: (card: CardType) => void;
  isFormationFull: boolean;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

// Helper to get rarity color class
const getRarityColorClass = (rarity: CardType['rarity']) => {
    const colorMap = {
        bronze: 'text-rarity-bronze',
        silver: 'text-rarity-silver',
        gold: 'text-rarity-gold',
        rotm: 'text-rarity-rotm',
        icon: 'text-rarity-icon',
        legend: 'text-rarity-legend',
        event: 'text-rarity-event',
    };
    return colorMap[rarity] || 'text-white';
}


const CardOptionsModal: React.FC<CardOptionsModalProps> = ({ cardWithOptions, onClose, onListCard, onQuickSell, onAddToFormation, onSendToStorage, isFormationFull, t }) => {
  const [viewMode, setViewMode] = useState<'stats' | 'superpowers'>('stats');

  if (!cardWithOptions) return null;

  const { card, origin } = cardWithOptions;
  const quickSellValue = calculateQuickSellValue(card);
  
  const handleListClick = () => {
    onListCard(card);
    onClose();
  }
  
  const handleAddToFormationClick = () => {
    onAddToFormation(card);
  };

  const handleSendToStorageClick = () => {
    onSendToStorage(card);
  }

  return (
    // Make modal wider to accommodate the larger card and info
    <Modal isOpen={true} onClose={onClose} title={card.name} size="xl">
      {/* Change grid to 50/50 split on medium screens and up */}
      <div className="modal-grid grid grid-cols-1 md:grid-cols-2 gap-8 my-4">
        
        {/* Card column with scaling */}
        <div className="flex justify-center items-center py-4">
          <div className="modal-card-preview transform scale-125">
             <Card card={card} className="hover:transform-none" />
          </div>
        </div>

        {/* Info & Actions column */}
        <div className="text-left rtl:text-right flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg mb-3">
              <span className={`font-bold capitalize ${getRarityColorClass(card.rarity)}`}>{card.rarity}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-300">Value: <span className="text-gold-light font-semibold">{card.value} Coins</span></span>
            </div>
            
            {/* View Toggle */}
            <div className="flex bg-black/40 p-1 rounded-lg mb-4 border border-gray-700">
                <button 
                    onClick={() => setViewMode('stats')}
                    className={`flex-1 py-2 text-sm font-bold rounded transition-all ${viewMode === 'stats' ? 'bg-gold-light text-black shadow-gold-glow' : 'text-gray-400 hover:text-white'}`}
                >
                    Face Stats
                </button>
                <button 
                    onClick={() => setViewMode('superpowers')}
                    className={`flex-1 py-2 text-sm font-bold rounded transition-all ${viewMode === 'superpowers' ? 'bg-blue-glow text-black shadow-blue-glow' : 'text-gray-400 hover:text-white'}`}
                >
                    Superpowers
                </button>
            </div>

            {/* Content Area */}
            <div className="min-h-[160px] mb-4">
                {viewMode === 'stats' ? (
                    <div className="grid grid-cols-3 gap-3 bg-black/20 p-4 rounded-lg border border-gold-dark/20 text-center animate-fadeIn">
                        {['LYRC', 'FLOW', 'SING', 'LIVE', 'DISS', 'CHAR'].map(stat => (
                            <div key={stat} className="flex flex-col bg-black/30 rounded p-1 border border-white/5">
                                <span className="text-[10px] text-gray-400 font-bold tracking-wider mb-1">{stat}</span>
                                <span className="text-gold-light font-header text-xl">{card.stats[stat.toLowerCase() as keyof typeof card.stats]}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-black/20 p-4 rounded-lg border border-blue-glow/20 animate-fadeIn h-full">
                        {card.superpowers.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4">
                                {card.superpowers.map((power) => {
                                    const iconUrl = superpowerIcons[power] || superpowerIcons[Object.keys(superpowerIcons).find(k => k.toLowerCase() === power.toLowerCase()) || ''];
                                    return (
                                        <div key={power} className="flex flex-col items-center gap-1 p-2 bg-black/40 rounded border border-blue-glow/30">
                                            {iconUrl ? (
                                                <img src={iconUrl} alt={power} className="w-8 h-8 object-contain drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                                            ) : (
                                                <div className="w-8 h-8 bg-blue-glow/20 rounded-full flex items-center justify-center border border-blue-glow/50 text-xs text-white">?</div>
                                            )}
                                            <span className="text-[10px] text-center text-blue-200 leading-tight font-bold">{power}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center italic p-4">
                                <p>No special superpowers.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

          </div>
          
          <div className="flex flex-col items-center gap-3">
             {origin === 'storage' && (
              <Button
                variant="keep"
                className="w-full"
                onClick={handleAddToFormationClick}
                disabled={isFormationFull}
                title={isFormationFull ? "Your formation is full" : ""}
              >
                {t('add_to_formation')}
              </Button>
            )}
            {origin === 'formation' && (
                <Button
                    variant="default"
                    className="w-full"
                    onClick={handleSendToStorageClick}
                >
                    Send to Storage
                </Button>
            )}
            <Button variant="sell" className="w-full" onClick={() => onQuickSell(card)}>{t('sell_card', { value: quickSellValue })}</Button>
            <Button variant="default" className="w-full" onClick={handleListClick}>{t('list_on_market')}</Button>
          </div>

        </div>
      </div>
       <Button variant="default" onClick={onClose} className="w-full max-w-xs mt-4">{t('close')}</Button>
    </Modal>
  );
};

export default CardOptionsModal;
