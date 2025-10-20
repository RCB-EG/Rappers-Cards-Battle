
import React from 'react';
import Modal from './Modal';
import Button from '../Button';

interface DailyRewardModalProps {
  isOpen: boolean;
  onClaim: (rewardType: 'coins' | 'pack' | 'card') => void;
}

const RewardOption: React.FC<{title: string, description: string, onClaim: () => void}> = ({ title, description, onClaim }) => (
    <div className="bg-black/30 p-4 rounded-lg border border-gold-dark/50 flex flex-col items-center text-center gap-3">
        <h4 className="font-header text-2xl text-gold-light">{title}</h4>
        <p className="text-gray-300 h-12">{description}</p>
        <Button variant="keep" onClick={onClaim}>Claim</Button>
    </div>
);

const DailyRewardModal: React.FC<DailyRewardModalProps> = ({ isOpen, onClaim }) => {
  return (
    <Modal isOpen={isOpen} onClose={() => {}} title="Daily Welcome Gift!" size="xl">
        <p className="text-white text-lg mb-6">It's good to see you! Choose one of the following rewards:</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RewardOption 
                title="1,000 Coins"
                description="A nice boost to your coin balance."
                onClaim={() => onClaim('coins')}
            />
            <RewardOption 
                title="Random Pack"
                description="Receive a free Builder or Special pack."
                onClaim={() => onClaim('pack')}
            />
            <RewardOption 
                title="Random Card"
                description="Get a random card valued up to 5,000 coins."
                onClaim={() => onClaim('card')}
            />
        </div>
    </Modal>
  );
};

export default DailyRewardModal;
