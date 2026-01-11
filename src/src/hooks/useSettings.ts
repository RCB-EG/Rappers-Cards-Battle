import { useState, useEffect, useCallback } from 'react';
import { Settings } from '../types';

const defaultSettings: Settings = {
  musicOn: true,
  musicVolume: 50,
  sfxOn: true,
  sfxVolume: 100,
  animationsOn: true,
};

export const useSettings = (): [Settings, (newSettings: Partial<Settings>) => void] => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const savedSettings = localStorage.getItem('rappersGameSettings');
      // Merge saved settings with defaults to ensure all keys are present
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) {
      console.error("Failed to parse settings from localStorage", error);
      return defaultSettings;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('rappersGameSettings', JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  }, [settings]);
  
  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
      setSettings(prevSettings => ({...prevSettings, ...newSettings}));
  }, []);

  return [settings, updateSettings];
};