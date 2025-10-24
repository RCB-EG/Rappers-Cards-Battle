import React, { useState } from 'react';
import Modal from './Modal';
import Button from '../Button';
import { TranslationKey } from '../../utils/translations';
import { User } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: Partial<User>) => void;
  error: string | null;
  t: (key: TranslationKey) => string;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin, error, t }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ email, password });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('login_title')}>
      <form onSubmit={handleSubmit}>
        <div className="my-6 space-y-4">
          <input
            type="email"
            placeholder={t('email_address')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-darker-gray border border-gold-dark/30 text-white p-3 rounded-md text-center"
          />
          <input
            type="password"
            placeholder={t('password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-darker-gray border border-gold-dark/30 text-white p-3 rounded-md text-center"
          />
           {error && <p className="text-red-500">{error}</p>}
        </div>
        <div className="flex justify-center gap-4">
            <Button variant="keep" type="submit">{t('log_in')}</Button>
            <Button variant="sell" type="button" onClick={onClose}>{t('cancel')}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default LoginModal;
