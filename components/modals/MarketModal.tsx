
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { Card as CardType } from '../../types';
import { TranslationKey } from '../../utils/translations';

interface MarketModalProps {
  cardToList: CardType | null;
  onClose: () => void;
  onList: (card: CardType, price: number) => void;
  t: (key: TranslationKey) => string;
}

const MarketModal: React.FC<MarketModalProps> = ({ cardToList, onClose, onList, t }) => {
  const [price, setPrice] = useState(100);

  useEffect(() => {
    if (cardToList) {
      setPrice(cardToList.value); // Default price to card value
    }
  }, [cardToList]);

  if (!cardToList) return null;

  const handleListClick = () => {
    if (price > 0) {
      onList(cardToList, price);
    }
  };

  return (
    <Modal isOpen={!!cardToList} onClose={onClose} title={t('modal_list_market_title')}>
      <div className="flex justify-center my-4">
        <Card card={cardToList} />
      </div>
      <div className="flex flex-col items-center gap-4 my-4">
        <label htmlFor="market-price" className="text-white">{t('set_price')}</label>
        <input
          type="number"
          id="market-price"
          value={price}
          onChange={(e) => setPrice(parseInt(e.target.value, 10) || 0)}
          className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md w-32 text-center"
          min="10"
        />
      </div>
      <div className="flex justify-center gap-4 mt-6">
        <Button variant="keep" onClick={handleListClick}>{t('list')}</Button>
        <Button variant="sell" onClick={onClose}>{t('cancel')}</Button>
      </div>
    </Modal>
  );
};

export default MarketModal;
