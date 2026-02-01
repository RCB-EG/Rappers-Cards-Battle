
import React, { useState } from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { Card as CardType } from '../../types';
import { TranslationKey } from '../../utils/translations';
import { calculateQuickSellValue } from '../../utils/cardUtils';
import CardInspectModal from './CardInspectModal';

interface PackResultsModalProps {
  cards: CardType[];
  onKeep: (card: CardType) => void;
  onSell: (card: CardType) => void;
  onList: (card: CardType) => void;
  storage: CardType[];
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const PackResultsModal: React.FC<PackResultsModalProps> = ({ cards, onKeep, onSell, onList, storage, t }) => {
  const [inspectCard, setInspectCard] = useState<CardType | null>(null);

  if (!cards || cards.length === 0) return null;

  return (
    <>
        <Modal isOpen={true} onClose={() => {}} title="Pack Results" size="xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 my-4 justify-items-center">
            {cards.map((card) => {
            const isDuplicate = storage.some(s => s.name === card.name && s.rarity === card.rarity);
            const sellValue = calculateQuickSellValue(card);

            return (
                <div key={card.id} className="flex flex-col items-center gap-3 animate-fadeIn w-full max-w-[200px]">
                <div className="relative group">
                    <div className="transform hover:scale-105 transition-transform duration-200">
                        <Card card={card} />
                    </div>
                    {/* Inspect Button Overlay */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setInspectCard(card); }}
                        className="absolute top-2 right-2 bg-black/70 hover:bg-gold-dark text-white rounded-full w-8 h-8 flex items-center justify-center border border-gold-light z-20 transition-colors shadow-lg"
                        title="Inspect Details"
                    >
                        <span className="text-lg font-bold">i</span>
                    </button>
                </div>
                
                <div className="flex flex-col w-full gap-2 mt-2">
                    {/* Compact Action Grid for Mobile/Desktop */}
                    <div className="grid grid-cols-2 gap-2">
                        {/* Keep / Duplicate Status */}
                        {isDuplicate ? (
                            <div className="col-span-1 flex items-center justify-center text-red-500 font-bold text-xs bg-black/40 rounded border border-red-500/50 text-center leading-tight p-1">
                                Duplicate
                            </div>
                        ) : (
                            <Button 
                                variant="keep" 
                                className="!py-2 !px-1 text-xs w-full"
                                onClick={() => onKeep(card)}
                            >
                                Keep
                            </Button>
                        )}

                        <Button 
                            variant="sell" 
                            className="!py-2 !px-1 text-xs w-full"
                            onClick={() => onSell(card)}
                        >
                            Quick Sell: {sellValue}
                        </Button>
                    </div>

                    <Button 
                        variant="default" 
                        className="!py-2 !px-2 text-xs w-full"
                        onClick={() => onList(card)}
                    >
                        {t('list_on_market')}
                    </Button>
                </div>
                </div>
            );
            })}
        </div>
        <p className="text-gray-400 text-sm mt-6 text-center">Choose an action for each card to continue.</p>
        </Modal>

        {/* Inspection Modal */}
        <CardInspectModal 
            card={inspectCard} 
            onClose={() => setInspectCard(null)} 
            t={t} 
        />
    </>
  );
};

export default PackResultsModal;
