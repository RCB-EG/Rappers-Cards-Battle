
import React from 'react';
import Modal from './Modal';
import Button from '../Button';
import { BattleInvite } from '../../types';

interface BattleInviteModalProps {
    invite: BattleInvite | null;
    onAccept: () => void;
    onReject: () => void;
}

const BattleInviteModal: React.FC<BattleInviteModalProps> = ({ invite, onAccept, onReject }) => {
    if (!invite) return null;

    return (
        <Modal isOpen={!!invite} onClose={onReject} title="Battle Challenge!">
            <div className="flex flex-col items-center gap-6 my-4">
                <div className="text-center">
                    <p className="text-gray-300 text-lg mb-2">You have been challenged by</p>
                    <h3 className="font-header text-4xl text-gold-light">{invite.fromName}</h3>
                </div>
                
                <div className="w-24 h-24 rounded-full bg-red-600/20 border-4 border-red-500 flex items-center justify-center animate-pulse">
                    <span className="text-5xl">⚔️</span>
                </div>

                <div className="flex gap-4 w-full justify-center">
                    <Button variant="cta" onClick={onAccept} className="w-32">Accept</Button>
                    <Button variant="sell" onClick={onReject} className="w-32">Decline</Button>
                </div>
            </div>
        </Modal>
    );
};

export default BattleInviteModal;
