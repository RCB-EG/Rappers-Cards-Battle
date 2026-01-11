import React from 'react';
import Modal from './Modal';
import Button from '../Button';
import { Card as CardType } from '../../types';
import Card from '../Card';
import { TranslationKey } from '../../utils/translations';
import { calculateQuickSellValue } from '../../utils/cardUtils';

interface DuplicateSellModalProps {
  card: CardType | null;
  onSell: () => void;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const DuplicateSellModal: React.FC<DuplicateSellModalProps> = ({ card, onSell, t }) => {
  if (!card) return null;

  const quickSellValue = calculateQuickSellValue(card);

  return (
    <Modal isOpen={!!card} onClose={() => {}} title={t('duplicate_card_packed_title')}>
      <div className="my-6">
        <div className="flex justify-center mb-4">
          <Card card={card} />
        </div>
        <p className="text-white text-lg">{t('duplicate_card_packed_text', { name: card.name })}</p>
      </div>
      <Button variant="sell" onClick={onSell}>
        {t('sell_card', { value: quickSellValue })}
      </Button>
    </Modal>
  );
};

export default DuplicateSellModal;