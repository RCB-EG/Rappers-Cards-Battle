import React, { useState } from 'react';
import Modal from './Modal';
import Button from '../Button';
import { TranslationKey } from '../../utils/translations';
import { User } from '../../types';
import { avatars } from '../../data/gameData';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: (user: User) => void;
  error: string | null;
  t: (key: TranslationKey) => string;
}

const SignUpModal: React.FC<SignUpModalProps> = ({ isOpen, onClose, onSignUp, error, t }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAvatar) {
        setLocalError(t('error_avatar_required'));
        return;
    }
    setLocalError(null);
    onSignUp({ username, email, password, avatar: selectedAvatar });
  };
  
  const handleAvatarSelect = (avatarUrl: string) => {
      setSelectedAvatar(avatarUrl);
      if (localError) setLocalError(null);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('signup_title')} size="lg">
      <form onSubmit={handleSubmit}>
        <div className="my-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                type="email"
                placeholder={t('email_address')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-darker-gray border border-gold-dark/30 text-white p-3 rounded-md text-center"
              />
          </div>
          <input
            type="password"
            placeholder={t('password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            className="w-full bg-darker-gray border border-gold-dark/30 text-white p-3 rounded-md text-center"
          />

          <div className="pt-2">
            <h3 className="text-gold-light text-xl mb-3">{t('choose_avatar')}</h3>
            <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
              {avatars.map(avatarUrl => (
                <img
                  key={avatarUrl}
                  src={avatarUrl}
                  alt="Avatar"
                  onClick={() => handleAvatarSelect(avatarUrl)}
                  className={`w-20 h-20 rounded-full cursor-pointer transition-all duration-200 border-2 ${selectedAvatar === avatarUrl ? 'border-gold-light scale-110 shadow-glow' : 'border-transparent hover:border-gold-dark/50'}`}
                />
              ))}
            </div>
          </div>

          {(error || localError) && <p className="text-red-500 pt-2">{error || localError}</p>}
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