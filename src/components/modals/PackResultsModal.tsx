
import React from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { Card as CardType } from '../../types';
import { TranslationKey } from '../../utils/translations';
import { calculateQuickSellValue } from '../../utils/cardUtils';

interface PackResultsModalProps {
  cards: CardType[];
  onKeep: (card: CardType) => void;
  onSell: (card: CardType) => void;
  onList: (card: CardType) => void;
  storage: CardType[];
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const PackResultsModal: React.FC<PackResultsModalProps> = ({ cards, onKeep, onSell, onList, storage, t }) => {
  if (!cards || cards.length === 0) return null;

  return (
    <Modal isOpen={true} onClose={() => {}} title="Pack Results" size="xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4 justify-items-center">
        {cards.map((card) => {
          const isDuplicate = storage.some(s => s.name === card.name);
          const sellValue = calculateQuickSellValue(card);

          return (
            <div key={card.id} className="flex flex-col items-center gap-3 animate-fadeIn">
              <div className="transform hover:scale-105 transition-transform duration-200">
                <Card card={card} />
              </div>
              
              <div className="flex flex-col w-full gap-2 mt-2">
                {/* Duplicate Warning */}
                {isDuplicate ? (
                    <div className="text-red-500 font-bold text-sm bg-black/40 px-2 py-1 rounded border border-red-500/50">
                        Duplicate Item
                    </div>
                ) : (
                    <Button 
                        variant="keep" 
                        className="py-1 px-3 text-sm w-full"
                        onClick={() => onKeep(card)}
                    >
                        Keep
                    </Button>
                )}

                <Button 
                    variant="sell" 
                    className="py-1 px-3 text-sm w-full"
                    onClick={() => onSell(card)}
                >
                    {t('sell_card', { value: sellValue })}
                </Button>

                <Button 
                    variant="default" 
                    className="py-1 px-3 text-sm w-full"
                    onClick={() => onList(card)}
                >
                    {t('list_on_market')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-gray-400 text-sm mt-4">Choose an action for each card to continue.</p>
    </Modal>
  );
};

export default PackResultsModal;
