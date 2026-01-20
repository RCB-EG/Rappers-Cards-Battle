
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { Card as CardType } from '../../types';
import { TranslationKey } from '../../utils/translations';

interface MarketModalProps {
  cardToList: CardType | null;
  onClose: () => void;
  onList: (card: CardType, startPrice: number, buyNowPrice: number, durationHours: number) => void;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const MarketModal: React.FC<MarketModalProps> = ({ cardToList, onClose, onList, t }) => {
  const [startPrice, setStartPrice] = useState(100);
  const [buyNowPrice, setBuyNowPrice] = useState(200);
  const [duration, setDuration] = useState(24);

  useEffect(() => {
    if (cardToList) {
      setStartPrice(Math.round(cardToList.value * 0.9)); 
      setBuyNowPrice(Math.round(cardToList.value * 1.5));
    } else {
      setStartPrice(100);
      setBuyNowPrice(200);
    }
  }, [cardToList]);

  if (!cardToList) return null;

  const handleListClick = () => {
    if (startPrice > 0 && buyNowPrice >= startPrice) {
      onList(cardToList, startPrice, buyNowPrice, duration);
    }
  };

  return (
    <Modal isOpen={!!cardToList} onClose={onClose} title={t('modal_list_market_title')}>
      <div className="flex justify-center my-4">
        <Card card={cardToList} />
      </div>
      
      <div className="flex flex-col gap-4 my-4 w-full max-w-xs mx-auto">
        
        {/* Start Price */}
        <div className="flex flex-col gap-1 text-left">
            <label htmlFor="start-price" className="text-gray-300 text-sm">Starting Bid</label>
            <input
            type="number"
            id="start-price"
            value={startPrice}
            onChange={(e) => setStartPrice(parseInt(e.target.value, 10) || 0)}
            className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md w-full text-center focus:border-gold-light outline-none"
            min="10"
            />
        </div>

        {/* Buy Now */}
        <div className="flex flex-col gap-1 text-left">
            <label htmlFor="buy-now-price" className="text-gray-300 text-sm">Buy Now Price</label>
            <input
            type="number"
            id="buy-now-price"
            value={buyNowPrice}
            onChange={(e) => setBuyNowPrice(parseInt(e.target.value, 10) || 0)}
            className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md w-full text-center focus:border-gold-light outline-none"
            min={startPrice}
            />
        </div>

        {/* Duration */}
        <div className="flex flex-col gap-1 text-left">
            <label className="text-gray-300 text-sm">Duration</label>
            <div className="flex justify-between bg-darker-gray rounded-md border border-gold-dark/30 p-1">
                {[1, 3, 6, 12, 24].map(h => (
                    <button
                        key={h}
                        onClick={() => setDuration(h)}
                        className={`flex-1 py-1 rounded text-sm transition-all ${duration === h ? 'bg-gold-light text-black font-bold' : 'text-gray-400 hover:text-white'}`}
                    >
                        {h}h
                    </button>
                ))}
            </div>
        </div>

        {startPrice > buyNowPrice && (
            <p className="text-red-500 text-xs text-center">Starting bid cannot be higher than Buy Now price.</p>
        )}

      </div>

      <div className="flex justify-center gap-4 mt-6">
        <Button variant="keep" onClick={handleListClick} disabled={startPrice > buyNowPrice}>{t('list')}</Button>
        <Button variant="sell" onClick={onClose}>{t('cancel')}</Button>
      </div>
    </Modal>
  );
};

export default MarketModal;
