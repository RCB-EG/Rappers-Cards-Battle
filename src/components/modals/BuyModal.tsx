
import React, { useState } from 'react';
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
  onAction: (card: MarketCard, action: 'buy' | 'bid' | 'cancel', bidAmount?: number) => void;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
  userCoins?: number;
  isOwner?: boolean;
}

const BuyModal: React.FC<BuyModalProps> = ({ cardToBuy, onClose, onAction, t, userCoins = 0, isOwner = false }) => {
  const [bidAmount, setBidAmount] = useState(0);
  const [activeTab, setActiveTab] = useState<'bid' | 'buy'>('bid');

  // Initialize bid amount when card opens
  React.useEffect(() => {
      if (cardToBuy) {
          const currentBid = cardToBuy.bidPrice || 0;
          const startPrice = cardToBuy.startingPrice || 0;
          const hasBids = !!cardToBuy.highestBidderId;

          let nextMinBid = 0;
          
          if (hasBids) {
              const minIncrement = Math.max(50, Math.floor(currentBid * 0.05));
              nextMinBid = currentBid + minIncrement;
          } else {
              nextMinBid = startPrice;
          }

          setBidAmount(nextMinBid);
          
          if (hasBids) setActiveTab('bid');
      }
  }, [cardToBuy]);

  if (!cardToBuy) return null;

  // Safe accessors for legacy data
  const currentBid = cardToBuy.bidPrice || 0;
  const startPrice = cardToBuy.startingPrice || 0;
  const hasBids = !!cardToBuy.highestBidderId;
  
  // Fallback to legacy 'price' field if buyNowPrice is missing
  const buyNowPrice = cardToBuy.buyNowPrice || cardToBuy.price || 0;

  // Calculate minimum allowed bid based on whether there are existing bids
  let minBid = 0;
  if (hasBids) {
      minBid = Math.max(50, Math.floor(currentBid * 0.05)) + currentBid;
  } else {
      minBid = startPrice;
  }

  const canAffordBuyNow = userCoins >= buyNowPrice;
  const canAffordBid = userCoins >= bidAmount;
  const isValidBid = bidAmount >= minBid;

  return (
    <Modal isOpen={!!cardToBuy} onClose={onClose} title={isOwner ? "Manage Listing" : t('modal_buy_card_title')} size="xl">
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
                </div>

                <div>
                    {isOwner ? (
                        <div className="flex flex-col gap-4">
                            <p className="text-white text-center">
                                {hasBids ? (
                                    <>Current Bid: <span className="text-gold-light font-bold">{currentBid}</span></>
                                ) : (
                                    <>Starting Price: <span className="text-gold-light font-bold">{startPrice}</span></>
                                )}
                                {hasBids ? <span className="block text-xs text-green-400">(Active Bidder)</span> : <span className="block text-xs text-gray-500">(No Bids)</span>}
                            </p>
                            <Button 
                                variant="sell" 
                                onClick={() => onAction(cardToBuy, 'cancel')} 
                                disabled={!!cardToBuy.highestBidderId} // Cannot cancel if someone bid
                                className={!!cardToBuy.highestBidderId ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                {!!cardToBuy.highestBidderId ? "Cannot Cancel (Bid Active)" : "Remove Listing"}
                            </Button>
                        </div>
                    ) : (
                        <div className="bg-darker-gray/80 p-4 rounded-xl border border-gray-700">
                            <div className="flex mb-4 bg-black/40 p-1 rounded-lg">
                                <button 
                                    onClick={() => setActiveTab('bid')} 
                                    className={`flex-1 py-2 rounded-md font-header tracking-wide transition-all ${activeTab === 'bid' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Place Bid
                                </button>
                                <button 
                                    onClick={() => setActiveTab('buy')} 
                                    className={`flex-1 py-2 rounded-md font-header tracking-wide transition-all ${activeTab === 'buy' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Buy Now
                                </button>
                            </div>

                            {activeTab === 'bid' ? (
                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between text-sm text-gray-300">
                                        <span>{hasBids ? "Current Bid:" : "Start Price:"}</span>
                                        <span className="text-white font-bold">{hasBids ? currentBid : startPrice}</span>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="number" 
                                            value={bidAmount}
                                            onChange={(e) => setBidAmount(parseInt(e.target.value) || 0)}
                                            className="bg-black border border-gold-dark/50 rounded p-2 text-white w-full text-center"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 text-center">Min Bid: {minBid}</p>
                                    <Button 
                                        variant="default" 
                                        onClick={() => onAction(cardToBuy, 'bid', bidAmount)}
                                        disabled={!canAffordBid || !isValidBid}
                                        className="w-full !bg-blue-600 !border-blue-400"
                                    >
                                        Place Bid
                                    </Button>
                                    {!canAffordBid && <p className="text-red-500 text-xs text-center">Insufficient Coins</p>}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="text-center py-2">
                                        <p className="text-gray-300 text-sm">Buy Immediately</p>
                                        <p className="text-3xl text-gold-light font-header">{buyNowPrice.toLocaleString()}</p>
                                    </div>
                                    <Button 
                                        variant="keep" 
                                        onClick={() => onAction(cardToBuy, 'buy')}
                                        disabled={!canAffordBuyNow}
                                        className="w-full"
                                    >
                                        Buy Now
                                    </Button>
                                    {!canAffordBuyNow && <p className="text-red-500 text-xs text-center">Insufficient Coins</p>}
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="flex justify-center mt-4">
                        <button onClick={onClose} className="text-gray-400 underline hover:text-white text-sm">{t('cancel')}</button>
                    </div>
                </div>
            </div>
        </div>
    </Modal>
  );
};

export default BuyModal;
