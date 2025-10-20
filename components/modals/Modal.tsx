import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-center items-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className={`bg-modal-bg p-8 rounded-lg shadow-[0_0_15px_#FFD700,0_0_30px_#B8860B] border-2 border-gold-light w-11/12 text-center ${sizeClasses[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-header text-3xl text-gold-light mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
};

export default Modal;