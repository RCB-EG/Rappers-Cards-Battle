import React from 'react';
import { Card as CardType } from '../../types';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { TranslationKey } from '../../utils/translations';
import { calculateQuickSellValue } from '../../utils/cardUtils';

interface CardOptionsModalProps {
  cardWithOptions: { card: CardType; origin: 'formation' | 'storage' } | null;
  onClose: () => void;
  onListCard: (card: CardType) => void;
  onQuickSell: (card: CardType) => void;
  onAddToFormation: (card: CardType) => void;
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


const CardOptionsModal: React.FC<CardOptionsModalProps> = ({ cardWithOptions, onClose, onListCard, onQuickSell, onAddToFormation, isFormationFull, t }) => {
  if (!cardWithOptions) return null;

  const { card, origin } = cardWithOptions;
  const quickSellValue = calculateQuickSellValue(card);
  
  const handleListClick = () => {
    onListCard(card);
  }
  
  const handleAddToFormationClick = () => {
    onAddToFormation(card);
  };

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
            
            {/* Display Superpowers */}
            {card.superpowers.length > 0 && (
              <div className="my-4">
                <h4 className="font-header text-xl text-gold-light mb-2">Superpowers</h4>
                <div className="flex flex-wrap gap-2">
                  {card.superpowers.map((power) => (
                    <span key={power} className="bg-blue-glow/20 text-blue-glow border border-blue-glow/50 rounded-full px-3 py-1 text-sm font-main">
                      {power}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Fallback message if no superpowers */}
            {card.superpowers.length === 0 && (
                 <p className="text-gray-400 italic my-4 p-3 bg-black/20 rounded-md border border-gold-dark/20">This card has no special superpowers. All stats are shown on the card design.</p>
            )}

          </div>
          
          <div className="flex flex-col items-center gap-3 mt-4">
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
