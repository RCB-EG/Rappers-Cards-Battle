
import React from 'react';
import { GameState, Card, CurrentUser, BlitzRank } from '../types';
import Button from './Button';
import { TranslationKey } from '../utils/translations';
import { rankSystem, blitzRankSystem } from '../data/gameData';

interface HeaderProps {
    gameState: GameState;
    currentUser: CurrentUser;
    onToggleDevMode: () => void;
    isDevMode: boolean;
    onOpenSettings: () => void;
    onOpenHowToPlay: () => void;
    onOpenLogin: () => void;
    onOpenSignUp: () => void;
    onLogout: () => void;
    lang: 'en' | 'ar';
    setLang: (lang: 'en' | 'ar') => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const Header: React.FC<HeaderProps> = ({ gameState, currentUser, onToggleDevMode, isDevMode, onOpenSettings, onOpenHowToPlay, onOpenLogin, onOpenSignUp, onLogout, lang, setLang, t }) => {
    const formationValue = Object.values(gameState.formation).reduce((sum: number, card) => sum + ((card as Card)?.value || 0), 0);
    const displayName = currentUser ? currentUser.username : t('user_guest');
    const avatarSrc = currentUser?.avatar || `https://api.dicebear.com/8.x/bottts/svg?seed=guest&backgroundColor=b6e3f4,c0aede,d1d4f9`;

    // Rank System Stats
    const currentRankConfig = rankSystem[gameState.rank];
    const winsNeeded = currentRankConfig.winsToPromote;
    const winsCurrent = gameState.rankWins;
    const progressPercent = Math.min(100, (winsCurrent / winsNeeded) * 100);

    const rankColors: Record<string, string> = {
        'Bronze': 'text-amber-600 border-amber-600',
        'Silver': 'text-gray-300 border-gray-300',
        'Gold': 'text-yellow-400 border-yellow-400',
        'Legend': 'text-purple-400 border-purple-400',
    };

    // Blitz (Street) Rank Stats
    const currentBlitzRank = (gameState.blitzRank || 5) as BlitzRank;
    const blitzConfig = blitzRankSystem[currentBlitzRank];
    const blitzWins = gameState.blitzWins || 0;
    const blitzNeeded = blitzConfig.winsToPromote;
    const blitzProgress = Math.min(100, (blitzWins / blitzNeeded) * 100);

    return (
        <header>
            <div className="header-controls absolute top-4 left-4 right-4 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <Button onClick={onOpenSettings} className="px-4 py-2 text-sm">{t('settings')}</Button>
                    <Button onClick={onOpenHowToPlay} className="px-4 py-2 text-sm">{t('how_to_play')}</Button>
                    {!currentUser && (
                        <>
                            <Button onClick={onOpenLogin} className="px-4 py-2 text-sm">{t('log_in')}</Button>
                            <Button onClick={onOpenSignUp} className="px-4 py-2 text-sm">{t('sign_up')}</Button>
                        </>
                    )}
                    {currentUser && (
                       <Button onClick={onLogout} className="px-4 py-2 text-sm">{t('logout')}</Button>
                    )}
                     <Button onClick={onToggleDevMode} className="px-4 py-2 text-sm">{isDevMode ? "Dev Mode (ON)" : t('dev_mode')}</Button>
                </div>
                <div className="lang-switcher flex">
                    <button onClick={() => setLang('ar')} className={`px-3 py-1 bg-dark-gray border border-gold-dark/30 text-gray-400 transition-colors duration-200 rounded-r-md ${lang === 'ar' ? 'bg-gold-light text-black' : ''}`}>AR</button>
                    <button onClick={() => setLang('en')} className={`px-3 py-1 bg-dark-gray border border-gold-dark/30 text-gray-400 transition-colors duration-200 rounded-l-md ${lang === 'en' ? 'bg-gold-light text-black' : ''}`}>EN</button>
                </div>
            </div>

            <div className="header-content flex flex-col items-center pt-24 md:pt-16">
                 <img 
                    src="https://i.imghippo.com/files/osQP7559xUw.png" 
                    alt="Rappers Battle"
                    className="header-title-img max-w-full w-[400px] h-auto drop-shadow-[0_0_10px_#FFD700] drop-shadow-[0_0_20px_#B8860B]"
                />
            
                <div className="top-stats flex justify-center w-full mt-4 mb-5 flex-wrap gap-4 px-2">
                    {/* PvE Rank */}
                    <div className={`stat-box bg-[rgba(10,10,10,0.7)] rounded-lg px-5 py-2 min-w-[140px] border shadow-glow flex flex-col items-center justify-center text-lg text-white relative overflow-hidden ${rankColors[gameState.rank]}`}>
                        <div className="flex items-center gap-2 z-10">
                            <span className="font-header uppercase text-xl">{gameState.rank}</span>
                            <span className="text-[10px] bg-black/50 px-2 py-0.5 rounded-full">{winsCurrent}/{winsNeeded} Wins</span>
                        </div>
                        <div className="w-full h-1 bg-gray-700 mt-1 rounded-full z-10">
                            <div className="h-full bg-current transition-all duration-500 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 z-10">XP: {gameState.xp}</span>
                    </div>

                    {/* Street Rank (Blitz) */}
                    <div className="stat-box bg-[rgba(10,10,10,0.7)] rounded-lg px-5 py-2 min-w-[140px] border border-red-500 shadow-[0_0_10px_#ef4444] flex flex-col items-center justify-center text-lg text-white relative overflow-hidden">
                        <div className="flex items-center gap-2 z-10 text-red-400">
                            <span className="font-header uppercase text-xl">Street {currentBlitzRank}</span>
                            <span className="text-[10px] bg-black/50 px-2 py-0.5 rounded-full text-white">{blitzWins}/{blitzNeeded}</span>
                        </div>
                        <div className="w-full h-1 bg-gray-700 mt-1 rounded-full z-10">
                            <div className="h-full bg-red-500 transition-all duration-500 rounded-full" style={{ width: `${blitzProgress}%` }}></div>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 z-10">Blitz Mode</span>
                    </div>

                    <div className="stat-box bg-[rgba(10,10,10,0.7)] rounded-lg px-5 py-2 min-w-[140px] border border-gold-dark/30 shadow-glow flex items-center justify-center text-lg text-white gap-2">
                        <span>{t('stat_coins')}:</span> <span className="text-gold-light">{gameState.coins}</span>
                    </div>
                    <div className="stat-box bg-[rgba(10,10,10,0.7)] rounded-lg px-5 py-2 min-w-[140px] border border-blue-glow/30 shadow-blue-glow flex items-center justify-center text-lg text-white gap-2">
                        <span>BP:</span> <span className="text-blue-glow font-bold">{gameState.battlePoints || 0}</span>
                    </div>
                    <div className="stat-box bg-[rgba(10,10,10,0.7)] rounded-lg px-5 py-2 min-w-[140px] border border-gold-dark/30 shadow-glow flex items-center justify-center text-lg text-white gap-2">
                        <span>{t('stat_value')}:</span> <span className="text-gold-light">{formationValue}</span>
                    </div>
                    <div className="stat-box bg-[rgba(10,10,10,0.7)] rounded-lg px-5 py-2 min-w-[140px] border border-gold-dark/30 shadow-glow flex items-center justify-center text-lg text-white gap-3">
                         <img src={avatarSrc} alt="User Avatar" className="w-8 h-8 rounded-full border-2 border-gold-dark/50 bg-gray-700" />
                         <span className="text-gold-light">{displayName}</span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
