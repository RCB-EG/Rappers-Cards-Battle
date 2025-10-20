import React from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { MarketCard } from '../../types';
import { TranslationKey } from '../../utils/translations';

// Helper to get rarity color class
const getRarityColorClass = (rarity: MarketCard['rarity']) => {
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

interface BuyModalProps {
  cardToBuy: MarketCard | null;
  onClose: () => void;
  onBuy: (card: MarketCard) => void;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const BuyModal: React.FC<BuyModalProps> = ({ cardToBuy, onClose, onBuy, t }) => {
  if (!cardToBuy) return null;

  return (
    <Modal isOpen={!!cardToBuy} onClose={onClose} title={t('modal_buy_card_title')} size="xl">
        <div className="modal-grid grid grid-cols-1 md:grid-cols-2 gap-8 my-4">
            <div className="flex justify-center items-center py-4">
                 <div className="modal-card-preview transform scale-125">
                    <Card card={cardToBuy} className="hover:transform-none"/>
                 </div>
            </div>

            <div className="text-left rtl:text-right flex flex-col justify-between">
                <div>
                    <h3 className="font-header text-3xl text-white mb-2">{cardToBuy.name}</h3>
                    <div className="flex items-center gap-2 text-lg mb-3">
                        <span className={`font-bold capitalize ${getRarityColorClass(cardToBuy.rarity)}`}>{cardToBuy.rarity}</span>
                    </div>
                    
                    {/* Display Superpowers */}
                    {cardToBuy.superpowers.length > 0 && (
                      <div className="my-4">
                        <h4 className="font-header text-xl text-gold-light mb-2">Superpowers</h4>
                        <div className="flex flex-wrap gap-2">
                          {cardToBuy.superpowers.map((power) => (
                            <span key={power} className="bg-blue-glow/20 text-blue-glow border border-blue-glow/50 rounded-full px-3 py-1 text-sm font-main">
                              {power}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                <div>
                    <p className="text-white text-lg my-4 text-center">
                        {t('buy')} for <span className="text-gold-light font-bold text-xl">{cardToBuy.price} {t('coins')}</span>?
                    </p>

                    <div className="flex justify-center gap-4 mt-6">
                        <Button variant="keep" onClick={() => onBuy(cardToBuy)}>{t('buy')}</Button>
                        <Button variant="sell" onClick={onClose}>{t('cancel')}</Button>
                    </div>
                </div>
            </div>
        </div>
    </Modal>
  );
};

export default BuyModal;