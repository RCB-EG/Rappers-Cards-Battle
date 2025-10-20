
import React from 'react';
// Fix: Import Card type for casting.
import { GameState, Card } from '../types';
import Button from './Button';
import { TranslationKey } from '../utils/translations';

interface HeaderProps {
    gameState: GameState;
    onToggleDevMode: () => void;
    isDevMode: boolean;
    onOpenSettings: () => void;
    lang: 'en' | 'ar';
    setLang: (lang: 'en' | 'ar') => void;
    t: (key: TranslationKey) => string;
}

const Header: React.FC<HeaderProps> = ({ gameState, onToggleDevMode, isDevMode, onOpenSettings, lang, setLang, t }) => {
    // Fix: Explicitly cast `card` as Card to resolve 'unknown' type error.
    const formationValue = Object.values(gameState.formation).reduce((sum: number, card) => sum + ((card as Card)?.value || 0), 0);

    return (
        <header>
            <div className="header-controls absolute top-4 left-4 right-4 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <Button onClick={onOpenSettings} className="px-4 py-2 text-sm">Settings</Button>
                    <Button onClick={onToggleDevMode} className="px-4 py-2 text-sm">{isDevMode ? "Dev Mode (ON)" : t('dev_mode')}</Button>
                </div>
                <div className="lang-switcher flex">
                    <button onClick={() => setLang('ar')} className={`px-3 py-1 bg-dark-gray border border-gold-dark/30 text-gray-400 transition-colors duration-200 rounded-r-md ${lang === 'ar' ? 'bg-gold-light text-black' : ''}`}>AR</button>
                    <button onClick={() => setLang('en')} className={`px-3 py-1 bg-dark-gray border border-gold-dark/30 text-gray-400 transition-colors duration-200 rounded-l-md ${lang === 'en' ? 'bg-gold-light text-black' : ''}`}>EN</button>
                </div>
            </div>

            <div className="header-content flex flex-col items-center pt-16">
                 <img 
                    src="https://i.imghippo.com/files/osQP7559xUw.png" 
                    alt="Rappers Battle"
                    className="header-title-img max-w-full w-[400px] h-auto drop-shadow-[0_0_10px_#FFD700] drop-shadow-[0_0_20px_#B8860B]"
                />
            
                <div className="top-stats flex justify-center w-full mt-4 mb-5 flex-wrap gap-4">
                    <div className="stat-box bg-[rgba(10,10,10,0.7)] rounded-lg px-5 py-2 min-w-[160px] border border-gold-dark/30 shadow-glow flex items-center justify-center text-lg text-white gap-2">
                        <span>{t('stat_coins')}:</span> <span className="text-gold-light">{gameState.coins}</span>
                    </div>
                    <div className="stat-box bg-[rgba(10,10,10,0.7)] rounded-lg px-5 py-2 min-w-[160px] border border-gold-dark/30 shadow-glow flex items-center justify-center text-lg text-white gap-2">
                        <span>{t('stat_value')}:</span> <span className="text-gold-light">{formationValue}</span>
                    </div>
                    <div className="stat-box bg-[rgba(10,10,10,0.7)] rounded-lg px-5 py-2 min-w-[160px] border border-gold-dark/30 shadow-glow flex items-center justify-center text-lg text-white gap-2">
                         <span>{t('stat_user')}:</span> <span className="text-gold-light">{gameState.userId}</span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
