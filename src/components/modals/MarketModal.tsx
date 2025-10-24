import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { Card as CardType } from '../../types';

interface MarketModalProps {
  cardToList: CardType | null;
  onClose: () => void;
  onList: (card: CardType, price: number) => Promise<void>;
}

const MarketModal: React.FC<MarketModalProps> = ({ cardToList, onClose, onList }) => {
  const [price, setPrice] = useState(100);
  const [isListing, setIsListing] = useState(false);

  useEffect(() => {
    if (cardToList) {
      setPrice(cardToList.value); // Default price to card value
      setIsListing(false); // Reset listing state when new card is selected
    }
  }, [cardToList]);

  if (!cardToList) return null;

  const handleListClick = async () => {
    if (price > 0 && !isListing) {
      setIsListing(true);
      try {
        await onList(cardToList, price);
      } catch (error) {
        console.error("Failed to list card:", error);
        // Optionally show an error to the user here
      } finally {
        // The onClose in onList will remove the modal, but this is a safeguard
        setIsListing(false);
      }
    }
  };

  return (
    <Modal isOpen={!!cardToList} onClose={onClose} title={"List on Market"}>
      <div className="flex justify-center my-4">
        <Card card={cardToList} />
      </div>
      <div className="flex flex-col items-center gap-4 my-4">
        <label htmlFor="market-price" className="text-white">{"Set your price:"}</label>
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
        <Button variant="keep" onClick={handleListClick} disabled={isListing}>
          {isListing ? 'Listing...' : "List Card"}
        </Button>
        <Button variant="sell" onClick={onClose} disabled={isListing}>
          {"Cancel"}
        </Button>
      </div>
    </Modal>
  );
};

export default MarketModal;
