import React from 'react';
import Modal from './Modal';
import Button from '../Button';
import { TranslationKey } from '../../utils/translations';
import { Settings } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  t: (key: TranslationKey) => string;
}

const ToggleSwitch: React.FC<{ 
    checked: boolean; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
    id: string;
}> = ({ checked, onChange, id }) => (
    <label htmlFor={id} className="relative inline-block w-14 h-8 cursor-pointer">
        <input id={id} type="checkbox" className="opacity-0 w-0 h-0 peer" checked={checked} onChange={onChange} />
        <span className="absolute inset-0 bg-gray-600 rounded-full transition-colors duration-300 before:absolute before:content-[''] before:h-6 before:w-6 before:left-1 before:bottom-1 before:bg-white before:rounded-full before:transition-transform before:duration-300 peer-checked:bg-gold-light peer-checked:before:translate-x-6"></span>
    </label>
);

const VolumeSlider: React.FC<{
    value: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    id: string;
}> = ({ value, onChange, id }) => (
    <input
        type="range"
        id={id}
        min="0"
        max="100"
        value={value}
        onChange={onChange}
        className="w-32 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-gold-light"
    />
);

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, updateSettings, t }) => {

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('settings_title')}>
      <div className="space-y-4 text-white">
        <div className="flex justify-between items-center p-4 border-b border-gold-dark/30">
          <label htmlFor="musicOn" className="text-xl">{t('music')}</label>
          <div className="flex items-center gap-4">
            <VolumeSlider 
              id="musicVolume"
              value={settings.musicVolume} 
              onChange={(e) => updateSettings({ musicVolume: parseInt(e.target.value, 10)})}
            />
            <ToggleSwitch 
              id="musicOn" 
              checked={settings.musicOn} 
              onChange={(e) => updateSettings({ musicOn: e.target.checked })}
            />
          </div>
        </div>
        <div className="flex justify-between items-center p-4 border-b border-gold-dark/30">
          <label htmlFor="sfxOn" className="text-xl">{t('sfx')}</label>
          <div className="flex items-center gap-4">
            <VolumeSlider 
              id="sfxVolume"
              value={settings.sfxVolume} 
              onChange={(e) => updateSettings({ sfxVolume: parseInt(e.target.value, 10)})}
            />
            <ToggleSwitch 
              id="sfxOn" 
              checked={settings.sfxOn} 
              onChange={(e) => updateSettings({ sfxOn: e.target.checked })}
            />
          </div>
        </div>
        <div className="flex justify-between items-center p-4">
          <label htmlFor="animationsOn" className="text-xl">{t('pack_animations')}</label>
          <ToggleSwitch 
            id="animationsOn" 
            checked={settings.animationsOn} 
            onChange={(e) => updateSettings({ animationsOn: e.target.checked })}
          />
        </div>
        <div className="mt-6">
            <Button variant="ok" onClick={onClose}>{t('close')}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;