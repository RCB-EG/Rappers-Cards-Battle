
import React from 'react';
import Modal from './Modal';
import Button from '../Button';

interface AdminMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
}

const AdminMessageModal: React.FC<AdminMessageModalProps> = ({ isOpen, onClose, message }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={() => {}} title="SYSTEM ALERT" size="md">
            <div className="flex flex-col items-center gap-6 my-4 animate-fadeIn">
                <div className="w-20 h-20 bg-red-600/20 rounded-full border-2 border-red-500 flex items-center justify-center shadow-[0_0_20px_#ef4444]">
                    <span className="text-4xl">📢</span>
                </div>
                
                <div className="bg-black/40 p-6 rounded-xl border border-gray-700 w-full text-center">
                    <p className="text-lg text-white font-medium leading-relaxed">{message}</p>
                </div>

                <Button variant="cta" onClick={onClose} className="w-full shadow-lg">
                    Acknowledged
                </Button>
            </div>
        </Modal>
    );
};

export default AdminMessageModal;
