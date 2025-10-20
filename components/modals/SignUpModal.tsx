import React, { useState } from 'react';
import Modal from './Modal';
import Button from '../Button';
import { TranslationKey } from '../../utils/translations';
import { User } from '../../types';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: (user: User) => void;
  error: string | null;
  t: (key: TranslationKey) => string;
}

const SignUpModal: React.FC<SignUpModalProps> = ({ isOpen, onClose, onSignUp, error, t }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignUp({ username, password });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('signup_title')}>
      <form onSubmit={handleSubmit}>
        <div className="my-6 space-y-4">
          <input
            type="text"
            placeholder={t('username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            className="w-full bg-darker-gray border border-gold-dark/30 text-white p-3 rounded-md text-center"
          />
          <input
            type="password"
            placeholder={t('password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            className="w-full bg-darker-gray border border-gold-dark/30 text-white p-3 rounded-md text-center"
          />
          {error && <p className="text-red-500">{error}</p>}
        </div>
        <div className="flex justify-center gap-4">
          <Button variant="keep" type="submit">{t('sign_up')}</Button>
          <Button variant="sell" type="button" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default SignUpModal;