import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Card as CardType, GameView, PackType, MarketCard, FormationLayoutId, User, CurrentUser } from './types';
import { initialState } from './data/initialState';
import { allCards, packs, fbcData, evoData, formationLayouts, objectivesData } from './data/gameData';
import { translations, TranslationKey } from './utils/translations';
import { useSettings } from './hooks/useSettings';
import { calculateQuickSellValue } from './utils/cardUtils';
import { playSound } from './utils/sound';
import { sfx, getRevealSfxKey } from './data/sounds';

// Components
import WelcomeScreen from './components/WelcomeScreen';
import IntroVideo from './components/IntroVideo';
import Particles from './components/Particles';
import Header from './components/Header';
import Navigation from './components/Navigation';
import Store from './components/views/Store';
import Collection from './components/views/Collection';
import Market from './components/views/Market';
import Battle from './components/views/Battle';
import FBC from './components/views/FBC';
import Evo from './components/views/Evo';
import Objectives from './components/views/Objectives';

// Modals
import SettingsModal from './components/modals/SettingsModal';
import HowToPlayModal from './components/modals/HowToPlayModal';
import MessageModal from './components/modals/MessageModal';
import PackAnimationModal from './components/modals/PackAnimationModal';
import CardOptionsModal from './components/modals/CardOptionsModal';
import MarketModal from './components/modals/MarketModal';
import DuplicateSellModal from './components/modals/DuplicateSellModal';
import DailyRewardModal from './components/modals/DailyRewardModal';
import LoginModal from './components/modals/LoginModal';
import SignUpModal from './components/modals/SignUpModal';

const GUEST_SAVE_KEY = 'rappersGameState_guest';

const App: React.FC = () => {
    // App Flow State
    const [appState, setAppState] = useState<'welcome' | 'intro' | 'game'>('welcome');
    
    // Game & Auth State
    const [gameState, setGameState] = useState<GameState>(initialState);
    const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
    const [currentView, setCurrentView] = useState<GameView>('store');
    const [isDevMode, setIsDevMode] = useState(false);

    // Settings & Language
    const [settings, updateSettings] = useSettings();
    const [lang, setLang] = useState<'en' | 'ar'>('en');

    // Modal States
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [messageModal, setMessageModal] = useState<{ title: string; message: string; card?: CardType } | null>(null);
    const [packCard, setPackCard] = useState<CardType | null>(null);
    const [cardWithOptions, setCardWithOptions] = useState<{ card: CardType; origin: 'formation' | 'storage' } | null>(null);
    const [cardToList, setCardToList] = useState<CardType | null>(null);
    const [duplicateToSell, setDuplicateToSell] = useState<CardType | null>(null);
    const [isDailyRewardModalOpen, setIsDailyRewardModalOpen] = useState(false);
    
    const t = useCallback((key: TranslationKey, replacements?: Record<string, string | number>): string => {
        let translation = translations[lang][key] || translations['en'][key];
        if (replacements) {
            Object.entries(replacements).forEach(([placeholder, value]) => {
                translation = translation.replace(`{${placeholder}}`, String(value));
            });
        }
        return translation;
    }, [lang]);
    
    const playSfx = useCallback((soundKey: keyof typeof sfx) => {
        if (settings.sfxOn) {
            playSound(sfx[soundKey], settings.sfxVolume);
        }
    }, [settings.sfxOn, settings.sfxVolume]);

    // --- AUTH & DATA PERSISTENCE ---

    const getSaveKey = useCallback((user: CurrentUser) => {
        return user ? `rappersGameState_${user.username}` : GUEST_SAVE_KEY;
    }, []);
    
    const loadGameState = useCallback((user: CurrentUser) => {
        const saveKey = getSaveKey(user);
        const savedStateJSON = localStorage.getItem(saveKey);
        let savedState = savedStateJSON ? JSON.parse(savedStateJSON) : null;
        
        if (savedState) {
             // Migration for older saves
            if (Array.isArray(savedState.formation)) {
                const migratedLayout: FormationLayoutId = '4-4-2';
                const newFormation: Record<string, CardType | null> = {};
                formationLayouts[migratedLayout].allPositions.forEach(posId => { newFormation[posId] = null; });
                savedState = { ...initialState, ...savedState, formation: newFormation, formationLayout: migratedLayout, storage: [...savedState.storage, ...savedState.formation] };
            }
             setGameState({ ...initialState, ...savedState });
        } else if (user) { // New user with no save, give them initial state
            setGameState({ ...initialState, userId: user.username });
        } else { // New guest
            setGameState({ ...initialState, userId: 'guest' });
        }
    }, [getSaveKey]);
    
    // Initial Load
    useEffect(() => {
        const loggedInUserJSON = localStorage.getItem('rappersGameCurrentUser');
        const user = loggedInUserJSON ? JSON.parse(loggedInUserJSON) : null;
        setCurrentUser(user);
        loadGameState(user);
    }, [loadGameState]);

    // Save state whenever it changes
    useEffect(() => {
        const saveKey = getSaveKey(currentUser);
        localStorage.setItem(saveKey, JSON.stringify(gameState));
    }, [gameState, currentUser, getSaveKey]);

    // Other Effects
    useEffect(() => { document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
    useEffect(() => {
        const handleClick = (event: MouseEvent) => { if ((event.target as HTMLElement).closest('button')) playSfx('buttonClick'); };
        window.addEventListener('click', handleClick);
        return () => { window.removeEventListener('click', handleClick); };
    }, [playSfx]);
    useEffect(() => {
        const bgMusic = document.getElementById('bg-music') as HTMLAudioElement;
        const introMusic = document.getElementById('intro-music') as HTMLAudioElement;
        if (bgMusic && introMusic) {
            const isGameActive = appState === 'game';
            bgMusic.volume = settings.musicVolume / 100;
            introMusic.volume = settings.musicVolume / 100;
            if (settings.musicOn && isGameActive) { bgMusic.play().catch(e => console.error("BG music autoplay failed", e)); } else { bgMusic.pause(); }
        }
    }, [settings.musicOn, settings.musicVolume, appState]);


    const handleSignUp = (user: User) => {
        const accountsJSON = localStorage.getItem('rappersGameAccounts');
        const accounts = accountsJSON ? JSON.parse(accountsJSON) : [];
        if (accounts.some((acc: User) => acc.username === user.username)) {
            setAuthError('Username already taken.');
            return;
        }
        accounts.push(user);
        localStorage.setItem('rappersGameAccounts', JSON.stringify(accounts));
        
        // The current guest progress becomes the new user's progress
        localStorage.setItem(`rappersGameState_${user.username}`, JSON.stringify(gameState));
        localStorage.removeItem(GUEST_SAVE_KEY); // Clean up old guest save
        
        setCurrentUser(user);
        localStorage.setItem('rappersGameCurrentUser', JSON.stringify(user));
        
        setGameState(prev => ({...prev, userId: user.username}));
        
        setIsSignUpModalOpen(false);
        setAuthError(null);
    };

    const handleLogin = (user: User) => {
        const accountsJSON = localStorage.getItem('rappersGameAccounts');
        const accounts = accountsJSON ? JSON.parse(accountsJSON) : [];
        const foundUser = accounts.find((acc: User) => acc.username === user.username && acc.password === user.password);
        if (foundUser) {
            // Save current guest state before switching
            localStorage.setItem(GUEST_SAVE_KEY, JSON.stringify(gameState));
            
            setCurrentUser(foundUser);
            localStorage.setItem('rappersGameCurrentUser', JSON.stringify(foundUser));
            loadGameState(foundUser);
            
            setIsLoginModalOpen(false);
            setAuthError(null);
        } else {
            setAuthError('Invalid username or password.');
        }
    };
    
    const handleLogout = () => {
        // Save the current user's state before logging out
        const saveKey = getSaveKey(currentUser);
        localStorage.setItem(saveKey, JSON.stringify(gameState));

        setCurrentUser(null);
        localStorage.removeItem('rappersGameCurrentUser');
        loadGameState(null); // Load guest state
    };


    const updateGameState = (updates: Partial<GameState>) => { setGameState(prevState => ({ ...prevState, ...updates })); };
    
    // Rest of the App... (Pack opening, market, FBC, etc. unchanged)
    
    const handleToggleDevMode = () => { setIsDevMode(prev => !prev); };
    const trackEvolutionTask = useCallback((taskId: string, amount: number) => { /* ... */ }, []);
    const trackObjectiveProgress = useCallback((task: string, amount: number) => { /* ... */ }, []);
    const handleOpenPack = useCallback((packType: PackType, isReward = false) => { /* ... */ }, [gameState, isDevMode, settings.animationsOn, trackEvolutionTask, playSfx, trackObjectiveProgress]);
    const handlePackAnimationEnd = (card: CardType) => { /* ... */ };
    const handleBuyCard = (card: MarketCard) => { /* ... */ };
    const handleListCard = (card: CardType, price: number) => { /* ... */ };
    const handleQuickSell = (card: CardType) => { /* ... */ };
    const handleFbcSubmit = (challengeId: string, submittedCards: CardType[]) => { /* ... */ };
    const handleStartEvo = (evoId: string, cardId: string) => { /* ... */ };
    const handleClaimEvo = () => { /* ... */ };
    const handleClaimObjectiveReward = (objectiveId: string) => { /* ... */ };
    const handleQuickSellDuplicate = () => { /* ... */ };
    const handleClaimDailyReward = (rewardType: 'coins' | 'pack' | 'card') => { /* ... */ };

    const claimableObjectivesCount = useMemo(() => { /* ... */ return 0; }, [gameState.objectiveProgress]);
    const claimableEvoCount = useMemo(() => { /* ... */ return 0; }, [gameState.activeEvolution]);
    const fbcNotificationCount = useMemo(() => 0, []);

    const renderView = () => {
        switch (currentView) {
            case 'store': return <Store onOpenPack={(packType) => handleOpenPack(packType, false)} gameState={gameState} isDevMode={isDevMode} t={t} />;
            case 'collection': return <Collection gameState={gameState} setGameState={updateGameState} setCardForOptions={setCardWithOptions} t={t} />;
            case 'market': return <Market market={gameState.market} onBuyCard={handleBuyCard} currentUserId={gameState.userId} t={t} />;
            case 'battle': return <Battle t={t} />;
            case 'fbc': return <FBC gameState={gameState} onFbcSubmit={handleFbcSubmit} t={t} playSfx={playSfx} />;
            case 'evo': return <Evo gameState={gameState} onStartEvo={handleStartEvo} onClaimEvo={handleClaimEvo} t={t} playSfx={playSfx} />;
            case 'objectives': return <Objectives gameState={gameState} onClaimReward={handleClaimObjectiveReward} t={t} />;
            default: return null;
        }
    };

    return (
        <div className={`App font-main bg-dark-gray min-h-screen text-white ${lang === 'ar' ? 'font-ar' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            
            {appState === 'welcome' && <WelcomeScreen onStart={() => setAppState('intro')} onHowToPlay={() => setIsHowToPlayOpen(true)} />}
            {appState === 'intro' && <IntroVideo onSkip={() => setAppState('game')} />}
            
            {appState === 'game' && (
                <>
                    <Particles />
                    <Header 
                        gameState={gameState} 
                        currentUser={currentUser}
                        onToggleDevMode={handleToggleDevMode} 
                        isDevMode={isDevMode} 
                        onOpenSettings={() => setIsSettingsOpen(true)} 
                        onOpenLogin={() => { setIsLoginModalOpen(true); setAuthError(null); }}
                        onOpenSignUp={() => { setIsSignUpModalOpen(true); setAuthError(null); }}
                        onLogout={handleLogout}
                        lang={lang} 
                        setLang={setLang} 
                        t={t} 
                    />
                    <main className="container mx-auto px-4 pb-8">
                        <Navigation 
                            currentView={currentView} 
                            setCurrentView={setCurrentView} 
                            t={t}
                            notificationCounts={{ objectives: claimableObjectivesCount, evo: claimableEvoCount, fbc: fbcNotificationCount }}
                        />
                        {renderView()}
                    </main>
                </>
            )}

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} updateSettings={updateSettings} t={t} />
            <HowToPlayModal isOpen={isHowToPlayOpen} onClose={() => setIsHowToPlayOpen(false)} t={t} />
            
            <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLogin} error={authError} t={t} />
            <SignUpModal isOpen={isSignUpModalOpen} onClose={() => setIsSignUpModalOpen(false)} onSignUp={handleSignUp} error={authError} t={t} />

            {messageModal && <MessageModal isOpen={!!messageModal} onClose={() => setMessageModal(null)} title={messageModal.title} message={messageModal.message} card={messageModal.card} />}
            {packCard && settings.animationsOn && <PackAnimationModal card={packCard} onAnimationEnd={handlePackAnimationEnd} playSfx={playSfx} />}
            
            <CardOptionsModal cardWithOptions={cardWithOptions} onClose={() => setCardWithOptions(null)} onListCard={(card) => { setCardToList(card); setCardWithOptions(null); }} onQuickSell={handleQuickSell} t={t} />
            <MarketModal cardToList={cardToList} onClose={() => setCardToList(null)} onList={handleListCard} t={t} />
            <DuplicateSellModal card={duplicateToSell} onSell={handleQuickSellDuplicate} t={t} />
            <DailyRewardModal isOpen={isDailyRewardModalOpen} onClaim={handleClaimDailyReward} />
        </div>
    );
};

export default App;