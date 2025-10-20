
import React from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { Deal } from '../../types';
import { TranslationKey } from '../../utils/translations';

interface DealModalProps {
  deal: Deal | null;
  isLoading: boolean;
  onAccept: () => void;
  onReject: () => void;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const DealModal: React.FC<DealModalProps> = ({ deal, isLoading, onAccept, onReject, t }) => {
  const isOpen = isLoading || !!deal;
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onReject} title={t('deal_title')}>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-48 text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gold-light"></div>
          <p className="mt-4 text-lg">{t('deal_loading')}</p>
        </div>
      ) : (
        deal && (
          <div className="text-white">
            <div className="flex justify-center my-4">
              <Card card={deal.offeredCard} />
            </div>
            <p className="text-lg italic bg-black/20 p-4 rounded-md border border-gold-dark/20">"{deal.message}"</p>
            <div className="flex justify-center gap-4 mt-6">
              <Button variant="keep" onClick={onAccept}>{t('deal_accept')}</Button>
              <Button variant="sell" onClick={onReject}>{t('deal_reject')}</Button>
            </div>
          </div>
        )
      )}
    </Modal>
  );
};

export default DealModal;
