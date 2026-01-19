
import React from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { MarketCard } from '../../types';
import { TranslationKey } from '../../utils/translations';
import { superpowerIcons } from '../../data/gameData';

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
  userCoins?: number;
  isOwner?: boolean;
}

const BuyModal: React.FC<BuyModalProps> = ({ cardToBuy, onClose, onBuy, t, userCoins = 0, isOwner = false }) => {
  if (!cardToBuy) return null;

  const canAfford = userCoins >= cardToBuy.price;

  return (
    <Modal isOpen={!!cardToBuy} onClose={onClose} title={isOwner ? "Cancel Listing" : t('modal_buy_card_title')} size="xl">
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
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-300">OVR: <span className="text-white font-bold">{cardToBuy.ovr}</span></span>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 my-4 bg-black/20 p-3 rounded-lg border border-gold-dark/20 text-center">
                        <div className="flex flex-col"><span className="text-xs text-gray-400">LYRC</span><span className="text-gold-light font-bold">{cardToBuy.stats.lyrc}</span></div>
                        <div className="flex flex-col"><span className="text-xs text-gray-400">FLOW</span><span className="text-gold-light font-bold">{cardToBuy.stats.flow}</span></div>
                        <div className="flex flex-col"><span className="text-xs text-gray-400">SING</span><span className="text-gold-light font-bold">{cardToBuy.stats.sing}</span></div>
                        <div className="flex flex-col"><span className="text-xs text-gray-400">LIVE</span><span className="text-gold-light font-bold">{cardToBuy.stats.live}</span></div>
                        <div className="flex flex-col"><span className="text-xs text-gray-400">DISS</span><span className="text-gold-light font-bold">{cardToBuy.stats.diss}</span></div>
                        <div className="flex flex-col"><span className="text-xs text-gray-400">CHAR</span><span className="text-gold-light font-bold">{cardToBuy.stats.char}</span></div>
                    </div>

                    {/* Display Superpowers */}
                    {cardToBuy.superpowers.length > 0 && (
                      <div className="my-4">
                        <h4 className="font-header text-xl text-gold-light mb-2">Superpowers</h4>
                        <div className="flex flex-wrap gap-4">
                          {cardToBuy.superpowers.map((power) => {
                             const iconUrl = superpowerIcons[power] || superpowerIcons[Object.keys(superpowerIcons).find(k => k.toLowerCase() === power.toLowerCase()) || ''];
                             return (
                                <div key={power} className="flex flex-col items-center gap-1 w-20">
                                    {iconUrl ? (
                                        <img src={iconUrl} alt={power} className="w-12 h-12 object-contain drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                                    ) : (
                                        <div className="w-12 h-12 bg-blue-glow/20 rounded-full flex items-center justify-center border border-blue-glow/50 text-xs text-white">?</div>
                                    )}
                                    <span className="text-[10px] text-center text-blue-glow leading-tight font-main">{power}</span>
                                </div>
                             );
                          })}
                        </div>
                      </div>
                    )}
                </div>

                <div>
                    {isOwner ? (
                        <p className="text-white text-lg my-4 text-center">
                            Remove <span className="text-gold-light font-bold">{cardToBuy.name}</span> from the market?
                        </p>
                    ) : (
                        <p className="text-white text-lg my-4 text-center">
                            {t('buy')} for <span className="text-gold-light font-bold text-xl">{cardToBuy.price} {t('coins')}</span>?
                        </p>
                    )}
                    
                    {!isOwner && !canAfford && (
                        <p className="text-red-500 text-center font-bold mb-2">Insufficient Funds</p>
                    )}

                    <div className="flex justify-center gap-4 mt-2">
                        <Button 
                            variant={isOwner ? "sell" : "keep"} 
                            onClick={() => onBuy(cardToBuy)} 
                            disabled={!isOwner && !canAfford}
                            className={!isOwner && !canAfford ? 'opacity-50 cursor-not-allowed filter grayscale' : ''}
                        >
                            {isOwner ? "Confirm Cancel" : t('buy')}
                        </Button>
                        <Button variant="default" onClick={onClose}>{t('cancel')}</Button>
                    </div>
                </div>
            </div>
        </div>
    </Modal>
  );
};

export default BuyModal;
