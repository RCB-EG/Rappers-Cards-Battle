
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
    const logoUrl = "https://i.imghippo.com/files/osQP7559xUw.png";

    // Rank System Stats
    const currentRankConfig = rankSystem[gameState.rank];
    const winsNeeded = currentRankConfig.winsToPromote;
    const winsCurrent = gameState.rankWins;
    const progressPercent = Math.min(100, (winsCurrent / winsNeeded) * 100);

    const rankColors: Record<string, string> = {
        'Bronze': 'text-amber-600 border-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.3)]',
        'Silver': 'text-gray-300 border-gray-300 shadow-[0_0_15px_rgba(209,213,219,0.3)]',
        'Gold': 'text-yellow-400 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]',
        'Legend': 'text-purple-400 border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.3)]',
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
                {/* Enhanced Logo Container with Shine */}
                <div className="relative group cursor-pointer perspective-[1000px]">
                    <div className="absolute inset-0 bg-gold-light/10 blur-3xl rounded-full opacity-30 group-hover:opacity-60 transition-opacity duration-500 animate-pulse"></div>
                    <div className="relative inline-block">
                        <img 
                            src={logoUrl} 
                            alt="Rappers Battle"
                            className="relative z-10 header-title-img max-w-full w-[400px] h-auto drop-shadow-[0_0_15px_rgba(255,215,0,0.6)] group-hover:drop-shadow-[0_0_25px_rgba(255,215,0,0.9)] transition-all duration-300"
                        />
                        {/* Masked Shine Effect - Static container holds mask, inner div moves */}
                        <div 
                            className="absolute inset-0 z-20 pointer-events-none"
                            style={{ 
                                maskImage: `url(${logoUrl})`, 
                                WebkitMaskImage: `url(${logoUrl})`,
                                maskSize: '100% 100%',
                                WebkitMaskSize: '100% 100%',
                                maskRepeat: 'no-repeat',
                                WebkitMaskRepeat: 'no-repeat',
                                maskPosition: 'center',
                                WebkitMaskPosition: 'center'
                            }}
                        >
                            <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shine-sweep" />
                        </div>
                    </div>
                </div>
            
                <div className="top-stats flex justify-center w-full mt-6 mb-5 flex-wrap gap-4 px-2">
                    {/* PvE Rank */}
                    <div className={`stat-box bg-[rgba(15,15,15,0.8)] rounded-xl px-5 py-3 min-w-[150px] border flex flex-col items-center justify-center text-lg text-white relative overflow-hidden group cursor-default ${rankColors[gameState.rank]}`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="flex items-center gap-2 z-10">
                            <span className="font-header uppercase text-2xl drop-shadow-md">{gameState.rank}</span>
                            <span className="text-[10px] bg-black/60 px-2 py-0.5 rounded-full border border-white/10">{winsCurrent}/{winsNeeded}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-800 mt-2 rounded-full z-10 overflow-hidden border border-white/5">
                            <div className="h-full bg-current transition-all duration-500 rounded-full shadow-[0_0_10px_currentColor]" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1 z-10 font-bold tracking-wider">XP: {gameState.xp}</span>
                    </div>

                    {/* Street Rank (Blitz) */}
                    <div className="stat-box bg-[rgba(15,15,15,0.8)] rounded-xl px-5 py-3 min-w-[150px] border border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.3)] flex flex-col items-center justify-center text-lg text-white relative overflow-hidden group cursor-default">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="flex items-center gap-2 z-10 text-red-400">
                            <span className="font-header uppercase text-2xl drop-shadow-md">Street {currentBlitzRank}</span>
                            <span className="text-[10px] bg-black/60 px-2 py-0.5 rounded-full text-white border border-red-500/30">{blitzWins}/{blitzNeeded}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-800 mt-2 rounded-full z-10 overflow-hidden border border-white/5">
                            <div className="h-full bg-red-500 transition-all duration-500 rounded-full shadow-[0_0_10px_#ef4444]" style={{ width: `${blitzProgress}%` }}></div>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1 z-10 font-bold tracking-wider">Blitz Mode</span>
                    </div>

                    {/* Coins */}
                    <div className="stat-box bg-[rgba(15,15,15,0.8)] rounded-xl px-5 py-3 min-w-[150px] border border-gold-dark/40 shadow-[0_0_15px_rgba(184,134,11,0.2)] flex items-center justify-center text-lg text-white gap-3 group cursor-default">
                        <div className="absolute inset-0 bg-gradient-to-br from-gold-light/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <span className="text-2xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">💰</span>
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-gold-light font-header text-2xl drop-shadow-sm">{gameState.coins.toLocaleString()}</span>
                            <span className="text-[10px] text-gray-400 font-bold tracking-wider">{t('stat_coins')}</span>
                        </div>
                    </div>

                    {/* Battle Points */}
                    <div className="stat-box bg-[rgba(15,15,15,0.8)] rounded-xl px-5 py-3 min-w-[150px] border border-blue-glow/40 shadow-[0_0_15px_rgba(0,199,226,0.2)] flex items-center justify-center text-lg text-white gap-3 group cursor-default">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-glow/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <span className="text-2xl text-blue-glow font-header filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">BP</span>
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-blue-200 font-header text-2xl drop-shadow-sm">{(gameState.battlePoints || 0).toLocaleString()}</span>
                            <span className="text-[10px] text-gray-400 font-bold tracking-wider">Points</span>
                        </div>
                    </div>

                    {/* Squad Value */}
                    <div className="stat-box bg-[rgba(15,15,15,0.8)] rounded-xl px-5 py-3 min-w-[150px] border border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.2)] flex items-center justify-center text-lg text-white gap-3 group cursor-default">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <span className="text-2xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">📈</span>
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-green-400 font-header text-2xl drop-shadow-sm">{formationValue.toLocaleString()}</span>
                            <span className="text-[10px] text-gray-400 font-bold tracking-wider">{t('stat_value')}</span>
                        </div>
                    </div>

                    {/* User Profile */}
                    <div className="stat-box bg-[rgba(15,15,15,0.8)] rounded-xl px-5 py-3 min-w-[150px] border border-gray-600/40 shadow-[0_0_15px_rgba(100,100,100,0.2)] flex items-center justify-center text-lg text-white gap-3 group cursor-pointer hover:border-white/50">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                         <img src={avatarSrc} alt="User Avatar" className="w-10 h-10 rounded-full border-2 border-gold-dark/50 bg-gray-700 shadow-md group-hover:scale-110 transition-transform duration-300" />
                         <span className="text-white font-bold text-lg drop-shadow-sm">{displayName}</span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
