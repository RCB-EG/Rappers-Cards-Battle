import React from 'react';
import Modal from './Modal';
import Button from '../Button';
// Fix: Import Card and CardType to display the card in the modal.
import { Card as CardType } from '../../types';
import Card from '../Card';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  // Fix: Added optional card prop to the interface.
  card?: CardType;
}

const MessageModal: React.FC<MessageModalProps> = ({ isOpen, onClose, title, message, card }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="my-6">
        {/* Fix: Conditionally render the card if it's provided. */}
        {card && (
          <div className="flex justify-center mb-4">
            <Card card={card} />
          </div>
        )}
        <p className="text-white text-lg">{message}</p>
      </div>
      <Button variant="ok" onClick={onClose}>
        OK
      </Button>
    </Modal>
  );
};

export default MessageModal;