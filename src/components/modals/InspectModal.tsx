
import React, { useMemo } from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { GameState, Card as CardType } from '../../types';
import { formationLayouts } from '../../data/gameData';

interface InspectModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetUser: GameState;
    username: string;
}

const InspectModal: React.FC<InspectModalProps> = ({ isOpen, onClose, targetUser, username }) => {
    if (!isOpen || !targetUser) return null;

    const currentLayout = formationLayouts[targetUser.formationLayout || '4-4-2'];
    const formationCardCount = Object.values(targetUser.formation).filter(Boolean).length;
    
    const formationRating = useMemo(() => {
        if (formationCardCount === 0) return '-';
        let totalOvr = 0;
        for (const posId of Object.keys(targetUser.formation)) {
            const card = targetUser.formation[posId];
            if (card) {
                totalOvr += card.ovr;
            }
        }
        return Math.round(totalOvr / formationCardCount);
    }, [targetUser.formation, formationCardCount]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Inspect: ${username}`} size="xl">
            <div className="flex flex-col items-center">
                <div className="flex justify-between w-full px-8 mb-4">
                    <div className="text-left">
                        <p className="text-gray-400 text-sm">Rank</p>
                        <p className="text-white text-xl font-header">{targetUser.rank}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-gray-400 text-sm">Squad Rating</p>
                        <p className="text-gold-light text-xl font-header">{formationRating}</p>
                    </div>
                </div>

                <div className="formation-pitch scale-[0.8] origin-top mb-[-60px]">
                    {['attackers', 'midfielders', 'defenders', 'goalkeeper'].map(rowKey => (
                        <div key={rowKey} className="formation-row">
                            {currentLayout.positions[rowKey as keyof typeof currentLayout.positions].map(pos => (
                                <div 
                                    key={pos.id}
                                    className="position-slot border-opacity-50"
                                >
                                    {targetUser.formation[pos.id] ? (
                                        <Card card={targetUser.formation[pos.id]!} className="!w-[90px] !h-[135px]" />
                                    ) : (
                                        <span className="opacity-30">{pos.label}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                
                <div className="mt-4">
                    <Button variant="default" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

export default InspectModal;
