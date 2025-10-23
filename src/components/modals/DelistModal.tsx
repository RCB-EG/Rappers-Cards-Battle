import React from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { MarketCard } from '../../types';
import { TranslationKey } from '../../utils/translations';

interface DelistModalProps {
  cardToDelist: MarketCard | null;
  onClose: () => void;
  onConfirm: (card: MarketCard) => void;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const DelistModal: React.FC<DelistModalProps> = ({ cardToDelist, onClose, onConfirm, t }) => {
  if (!cardToDelist) return null;

  return (
    <Modal isOpen={!!cardToDelist} onClose={onClose} title="Delist Card">
        <div className="flex justify-center my-4">
            <Card card={cardToDelist} />
        </div>
        <p className="text-white text-lg my-4">
            Are you sure you want to remove this card from the market? It will be returned to your storage.
        </p>
        <div className="flex justify-center gap-4 mt-6">
            <Button variant="sell" onClick={() => onConfirm(cardToDelist)}>Delist</Button>
            <Button variant="keep" onClick={onClose}>{t('cancel')}</Button>
        </div>
    </Modal>
  );
};

export default DelistModal;
