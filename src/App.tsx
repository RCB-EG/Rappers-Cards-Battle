
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Card as CardType, GameView, PackType, MarketCard, FormationLayoutId, User, CurrentUser, Objective } from './types';
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
const CURRENT_VERSION = 1.2;
const MARKET_STORAGE_KEY = 'rappersGlobalMarket';
const EARNINGS_STORAGE_KEY = 'rappersPendingEarnings';

// --- STATE UPDATE HELPER FUNCTIONS ---

const applyObjectiveProgress = (
    currentProgress: GameState['objectiveProgress'], 
    task: string, 
    amount: number, 
    mode: 'increment' | 'set' = 'increment'
): GameState['objectiveProgress'] => {
    const updatedProgress = JSON.parse(JSON.stringify(currentProgress));

    objectivesData.forEach(obj => {
        if (updatedProgress[obj.id]?.claimed) return;

        obj.tasks.forEach(taskInfo => {
            if (taskInfo.id === task) {
                if (!updatedProgress[obj.id]) {
                    updatedProgress[obj.id] = { tasks: {}, claimed: false };
                }
                const current = updatedProgress[obj.id].tasks[task] || 0;
                const newValue = mode === 'increment' ? current + amount : amount;
                if (current !== newValue) {
                     updatedProgress[obj.id].tasks[task] = newValue;
                }
            }
        });
    });
    return updatedProgress;
};

const applyEvolutionTask = (
    activeEvolution: GameState['activeEvolution'], 
    taskId: string, 
    amount: number
): GameState['activeEvolution'] => {
    if (!activeEvolution) return null;
    const evoDef = evoData.find(e => e.id === activeEvolution.evoId);
    if (!evoDef || !evoDef.tasks.some(t => t.id === taskId)) return activeEvolution;

    const newTasks = { ...activeEvolution.tasks };
    newTasks[taskId] = (newTasks[taskId] || 0) + amount;

    return { ...activeEvolution, tasks: newTasks };
};

// --- GLOBAL MARKET HELPERS ---
const getGlobalMarket = (): MarketCard[] => {
    try {
        const data = localStorage.getItem(MARKET_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

const setGlobalMarket = (market: MarketCard[]) => {
    localStorage.setItem(MARKET_STORAGE_KEY, JSON.stringify(market));
};

const addEarnings = (userId: string, amount: number) => {
    try {
        const data = localStorage.getItem(EARNINGS_STORAGE_KEY);
        const earnings = data ? JSON.parse(data) : {};
        earnings[userId] = (earnings[userId] || 0) + amount;
        localStorage.setItem(EARNINGS_STORAGE_KEY, JSON.stringify(earnings));
    } catch (e) {
        console.error("Failed to save earnings", e);
    }
};

const claimEarnings = (userId: string): number => {
    try {
        const data = localStorage.getItem(EARNINGS_STORAGE_KEY);
        const earnings = data ? JSON.parse(data) : {};
        const amount = earnings[userId] || 0;
        if (amount > 0) {
            earnings[userId] = 0;
            localStorage.setItem(EARNINGS_STORAGE_KEY, JSON.stringify(earnings));
        }
        return amount;
    } catch {
        return 0;
    }
};

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
        
        // Always sync market from global storage on load
        const globalMarket = getGlobalMarket();

        if (savedState) {
            // --- DATA MIGRATIONS ---
            
            // Fix 1: Migrate formation structure if needed (old array vs new object)
            if (Array.isArray(savedState.formation)) {
                const migratedLayout: FormationLayoutId = '4-4-2';
                const newFormation: Record<string, CardType | null> = {};
                formationLayouts[migratedLayout].allPositions.forEach(posId => { newFormation[posId] = null; });
                savedState = { ...initialState, ...savedState, formation: newFormation, formationLayout: migratedLayout, storage: [...savedState.storage, ...savedState.formation] };
            }

            // Fix 2: Migrate objectives structure if needed
            if (!savedState.objectiveProgress) savedState.objectiveProgress = {};
            const firstObjectiveProgressValue = Object.values(savedState.objectiveProgress || {})[0] as any;
            if (firstObjectiveProgressValue && firstObjectiveProgressValue.tasks === undefined) {
                const migratedProgress: GameState['objectiveProgress'] = {};
                // Fix: Correctly type the old objectives for migration to prevent type errors.
                const oldObjectives: ({ id: string; type: 'daily' | 'weekly'; descriptionKey: string; task: string; target: number; reward: Objective['reward']; })[] = [
                    { id: 'd1', type: 'daily', descriptionKey: 'obj_open_free_pack_task', task: 'open_free_packs', target: 1, reward: { type: 'coins', amount: 250 } },
                    { id: 'd2', type: 'daily', descriptionKey: 'obj_list_card_task', task: 'list_market_cards', target: 1, reward: { type: 'coins', amount: 500 } },
                    { id: 'w1', type: 'weekly', descriptionKey: 'obj_open_builder_packs_task', task: 'open_builder_packs', target: 5, reward: { type: 'pack', packType: 'builder' } },
                    { id: 'w2', type: 'weekly', descriptionKey: 'obj_complete_fbc_task', task: 'complete_fbcs', target: 1, reward: { type: 'coins', amount: 2000 } },
                ];
                oldObjectives.forEach(obj => {
                    const oldProg = savedState.objectiveProgress[obj.id];
                    if (oldProg) {
                        migratedProgress[obj.id] = {
                            tasks: { [obj.task]: oldProg.progress || 0 },
                            claimed: oldProg.claimed || false
                        };
                    }
                });
                savedState.objectiveProgress = migratedProgress;
            }

            // Fix 3: Version 1.2 Migration - Wipe Market and Fix Broken Images
            if (!savedState.version || savedState.version < 1.2) {
                // Wipe Market completely to remove bot cards and broken listings
                savedState.market = []; // This will be overwritten by globalMarket anyway

                // Helper to update card data from the latest source of truth (allCards)
                const updateCardData = (oldCard: CardType): CardType | null => {
                    const template = allCards.find(c => c.id === oldCard.id);
                    // If the card exists in our database, replace it with the fresh data (new image, corrected stats)
                    if (template) {
                        return { ...template };
                    }
                    // If card ID no longer exists, remove it
                    return null; 
                };

                // Update Storage
                savedState.storage = savedState.storage
                    .map(updateCardData)
                    .filter((c: CardType | null): c is CardType => c !== null);

                // Update Formation
                const newFormation: Record<string, CardType | null> = {};
                for (const pos in savedState.formation) {
                    const card = savedState.formation[pos];
                    if (card) {
                        const updated = updateCardData(card);
                        newFormation[pos] = updated; 
                    } else {
                        newFormation[pos] = null;
                    }
                }
                savedState.formation = newFormation;

                // Update Version
                savedState.version = CURRENT_VERSION;
            }
            
            // Force market to be the global market
            setGameState({ ...initialState, ...savedState, market: globalMarket });
        } else if (user) { // New user with no save, give them initial state
            setGameState({ ...initialState, userId: user.username, market: globalMarket });
        } else { // New guest
            setGameState({ ...initialState, userId: 'guest', market: globalMarket });
        }
    }, [getSaveKey]);
    
    // Initial Load
    useEffect(() => {
        const loggedInUserJSON = localStorage.getItem('rappersGameCurrentUser');
        const user = loggedInUserJSON ? JSON.parse(loggedInUserJSON) : null;
        setCurrentUser(user);
        loadGameState(user);
    }, [loadGameState]);

    // --- MARKET SYNC & EARNINGS CHECK ---
    useEffect(() => {
        const interval = setInterval(() => {
            // Sync Market
            const globalMarket = getGlobalMarket();
            // Only update if different length to avoid constant re-renders, simpler check
            setGameState(prev => {
                if (JSON.stringify(prev.market) !== JSON.stringify(globalMarket)) {
                    return { ...prev, market: globalMarket };
                }
                return prev;
            });

            // Check Earnings
            if (currentUser || gameState.userId !== 'guest') {
                const userId = currentUser ? currentUser.username : gameState.userId;
                const earned = claimEarnings(userId);
                if (earned > 0) {
                    playSfx('rewardClaimed');
                    setGameState(prev => ({ ...prev, coins: prev.coins + earned }));
                    setMessageModal({
                        title: 'Market Sale!',
                        message: `Your items sold on the market! You earned ${earned} coins.`
                    });
                }
            }
        }, 3000); // Check every 3 seconds

        return () => clearInterval(interval);
    }, [currentUser, gameState.userId, playSfx]);


    // Ensure objectives are initialized if missing in loaded state
    useEffect(() => {
        setGameState(prev => {
            const newProgress = { ...prev.objectiveProgress };
            let changed = false;
            objectivesData.forEach(obj => {
                if (!newProgress[obj.id]) {
                    newProgress[obj.id] = { tasks: {}, claimed: false };
                    changed = true;
                }
            });
            return changed ? { ...prev, objectiveProgress: newProgress } : prev;
        });
    }, [appState]); // Run when appState changes to game or on load

    // Save state whenever it changes
    useEffect(() => {
        const saveKey = getSaveKey(currentUser);
        // Don't save 'market' into user state deeply, or if we do, we overwrite it on load anyway.
        // We'll save it for now as part of state, but loadGameState ignores user's market data in favor of global.
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
        if (accounts.some((acc: User) => acc.email === user.email)) {
            setAuthError(t('email_taken'));
            return;
        }
        
        // Create the new account
        accounts.push(user);
        localStorage.setItem('rappersGameAccounts', JSON.stringify(accounts));
        
        // Migrate current guest state to the new user ID
        // Note: gameState.market comes from global, but formation/storage/coins are local
        const newState = { ...gameState, userId: user.username };
        localStorage.setItem(`rappersGameState_${user.username}`, JSON.stringify(newState));
        
        // Clear old guest save to keep things clean, or keep it as backup?
        // Let's keep it to avoid issues if they log out immediately.
        // localStorage.removeItem(GUEST_SAVE_KEY); 
        
        setCurrentUser(user);
        localStorage.setItem('rappersGameCurrentUser', JSON.stringify(user));
        
        setGameState(newState);
        
        setIsSignUpModalOpen(false);
        setAuthError(null);
    };

    const handleLogin = (user: User) => {
        const accountsJSON = localStorage.getItem('rappersGameAccounts');
        const accounts = accountsJSON ? JSON.parse(accountsJSON) : [];
        const foundUser = accounts.find((acc: User) => acc.username === user.username && acc.password === user.password);
        if (foundUser) {
            // Save current guest state before switching if needed
            if (!currentUser) {
                 localStorage.setItem(GUEST_SAVE_KEY, JSON.stringify(gameState));
            }
            
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
    
    const handleToggleDevMode = () => { setIsDevMode(prev => !prev); };

    // Effect for state-based evolution tasks
    useEffect(() => {
        const { activeEvolution } = gameState;
        if (!activeEvolution) return;
    
        const evoDef = evoData.find(e => e.id === activeEvolution.evoId);
        if (!evoDef || evoDef.id !== 'tommy_gun_upgrade') return;
        
        setGameState(prev => {
            if (!prev.activeEvolution || prev.activeEvolution.evoId !== 'tommy_gun_upgrade') return prev;
    
            let newActiveEvo = { ...prev.activeEvolution };
            let changed = false;
            
            // Fix: Add explicit type to `some` callback to prevent type inference issues.
            const evolvingCardInFormation = Object.values(prev.formation).some((c: CardType | null) => c?.id === prev.activeEvolution!.cardId);
    
            const task1Id = 'tommy_gun_in_formation';
            if (evolvingCardInFormation && (newActiveEvo.tasks[task1Id] || 0) < 1) {
                newActiveEvo = applyEvolutionTask(newActiveEvo, task1Id, 1)!;
                changed = true;
            }
    
            const task2Id = 'formation_rating_82';
            if (evolvingCardInFormation && (newActiveEvo.tasks[task2Id] || 0) < 1) {
                // Fix: Use a type guard with `filter` to ensure correct type for `formationCards`.
                const formationCards = Object.values(prev.formation).filter((c): c is CardType => !!c);
                if (formationCards.length > 0) {
                    const totalOvr = formationCards.reduce((sum, card) => sum + card.ovr, 0);
                    const formationRating = Math.round(totalOvr / formationCards.length);
                    if (formationRating >= 82) {
                        newActiveEvo = applyEvolutionTask(newActiveEvo, task2Id, 1)!;
                        changed = true;
                    }
                }
            }
            
            return changed ? { ...prev, activeEvolution: newActiveEvo } : prev;
        });
    }, [gameState.formation, gameState.activeEvolution]);

    // Effect for state-based objectives (e.g., formation composition)
    useEffect(() => {
        setGameState(prev => {
            // Fix: Use a type guard with `filter` to ensure correct type for `c`.
            const goldCardsInFormation = Object.values(prev.formation).filter((c): c is CardType => !!c && (c as CardType).rarity === 'gold').length;
            const requiredGoldCards = 11;
            
            const objective = objectivesData.find(o => o.tasks.some(t => t.id === 'formation_11_gold'));
            if (!objective) return prev;
            
            const currentProgress = prev.objectiveProgress[objective.id]?.tasks['formation_11_gold'] || 0;
            const newProgressValue = goldCardsInFormation >= requiredGoldCards ? 1 : 0;
            
            if (currentProgress === newProgressValue) {
                return prev;
            }
    
            return {
                ...prev,
                objectiveProgress: applyObjectiveProgress(prev.objectiveProgress, 'formation_11_gold', newProgressValue, 'set')
            };
        });
    }, [gameState.formation]);
    
    const handleOpenPack = useCallback((packType: PackType, isReward = false, bypassLimit = false) => {
        playSfx('packBuildup');
        const pack = packs[packType];
        
        let foundCard: CardType | null = null;
        let attempts = 0;
        
        while (!foundCard && attempts < 20) {
            const random = Math.random() * 100;
            let cumulative = 0;
            let chosenRarity: keyof typeof pack.rarityChances | undefined;
            for (const rarity in pack.rarityChances) {
                cumulative += pack.rarityChances[rarity as keyof typeof pack.rarityChances]!;
                if (random < cumulative) {
                    chosenRarity = rarity as keyof typeof pack.rarityChances;
                    break;
                }
            }
            if (!chosenRarity) {
                const rarities = Object.keys(pack.rarityChances) as (keyof typeof pack.rarityChances)[];
                chosenRarity = rarities[rarities.length - 1];
            }
    
            const possibleCards = allCards.filter(c => c.rarity === chosenRarity && c.isPackable !== false);
            if (possibleCards.length > 0) {
                foundCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
            }
            attempts++;
        }
    
        if (!foundCard) {
            const bronzeCards = allCards.filter(c => c.rarity === 'bronze' && c.isPackable !== false);
            foundCard = bronzeCards.length > 0 ? bronzeCards[Math.floor(Math.random() * bronzeCards.length)] : allCards[0];
        }

        const newCard = foundCard as CardType;

        setGameState(prev => {
            if (!isReward && pack.cost > prev.coins && !isDevMode) {
                setMessageModal({ title: 'Not Enough Coins', message: `You need ${pack.cost} coins to open this pack.` });
                return prev;
            }
            
            let stateUpdates: Partial<GameState> = {};
            
            if (packType === 'free' && !bypassLimit) {
                const twelveHours = 12 * 60 * 60 * 1000;
                const now = Date.now();
                let { freePacksOpenedToday, lastFreePackResetTime } = prev;
                if (lastFreePackResetTime && (now - lastFreePackResetTime > twelveHours)) {
                    freePacksOpenedToday = 0;
                    lastFreePackResetTime = now;
                } else if (!lastFreePackResetTime) {
                    lastFreePackResetTime = now;
                }
                if (freePacksOpenedToday >= 3 && !isDevMode) {
                    setMessageModal({ title: 'Limit Reached', message: 'You have opened all your free packs for now. Come back later!' });
                    return prev;
                }
                stateUpdates.freePacksOpenedToday = freePacksOpenedToday + 1;
                stateUpdates.lastFreePackResetTime = lastFreePackResetTime;
                stateUpdates.objectiveProgress = applyObjectiveProgress(prev.objectiveProgress, 'open_free_packs', 1);

            } else if (!isReward) {
                stateUpdates.coins = prev.coins - pack.cost;
                let currentObjectiveProgress = prev.objectiveProgress;
                let currentActiveEvolution = prev.activeEvolution;

                if (packType === 'builder') {
                    currentObjectiveProgress = applyObjectiveProgress(currentObjectiveProgress, 'open_builder_packs', 1);
                }
                if (packType === 'special') {
                    currentActiveEvolution = applyEvolutionTask(currentActiveEvolution, 'open_special_packs', 1);
                }

                stateUpdates.objectiveProgress = currentObjectiveProgress;
                stateUpdates.activeEvolution = currentActiveEvolution;
            }

            if (settings.animationsOn) {
                setPackCard(newCard);
            } else {
                const isDuplicate = prev.storage.some(card => card.name === newCard.name);
                if (isDuplicate) {
                    setDuplicateToSell(newCard);
                } else {
                    stateUpdates.storage = [...prev.storage, newCard];
                    setMessageModal({ title: 'New Card!', message: `You packed ${newCard.name}!`, card: newCard });
                }
            }
            return { ...prev, ...stateUpdates };
        });
    }, [isDevMode, settings.animationsOn, playSfx]);


    const handlePackAnimationEnd = (card: CardType) => {
        setPackCard(null);
        setGameState(prev => {
            const isDuplicate = prev.storage.some(c => c.name === card.name);
            if (isDuplicate) {
                setDuplicateToSell(card);
                return prev;
            } else {
                setMessageModal({ title: `You got ${card.name}!`, message: `A new ${card.rarity} card has been added to your storage.`, card });
                return { ...prev, storage: [...prev.storage, card] };
            }
        });
    };
    
    const handleQuickSellDuplicate = () => {
        if (duplicateToSell) {
          const quickSellValue = calculateQuickSellValue(duplicateToSell);
          updateGameState({ coins: gameState.coins + quickSellValue });
          setMessageModal({ title: 'Card Sold', message: `You received ${quickSellValue} coins for the duplicate ${duplicateToSell.name}.` });
          setDuplicateToSell(null);
        }
    };
    
    const handleBuyCard = (card: MarketCard) => {
        // Refresh Global Market Data to avoid buying sold cards
        const globalMarket = getGlobalMarket();
        const freshCard = globalMarket.find(c => c.id === card.id);

        if (!freshCard) {
            setMessageModal({ title: 'Card Sold', message: 'Sorry, this card has already been bought by another player.' });
            // Sync local market
            setGameState(prev => ({ ...prev, market: globalMarket }));
            return;
        }

        if (gameState.coins >= freshCard.price) {
            // Remove from global market
            const newGlobalMarket = globalMarket.filter(c => c.id !== freshCard.id);
            setGlobalMarket(newGlobalMarket);

            // Add earnings to seller
            addEarnings(freshCard.sellerId, freshCard.price);

            // Update Buyer State
            updateGameState({
                coins: gameState.coins - freshCard.price,
                storage: [...gameState.storage, freshCard],
                market: newGlobalMarket,
            });
            playSfx('purchase');
            setMessageModal({ title: 'Purchase Successful', message: `You bought ${freshCard.name} for ${freshCard.price} coins.`, card: freshCard });
        } else {
            setMessageModal({ title: 'Not Enough Coins', message: `You need ${freshCard.price} coins to buy this card.` });
        }
    };

    const handleListCard = (card: CardType, price: number) => {
        // IMPORTANT: Use a unique ID for the market listing to avoid collision if they have multiples
        // But for now, we use card ID.
        
        // Add to Global Market
        const newMarketCard: MarketCard = { ...card, price, sellerId: gameState.userId };
        const globalMarket = getGlobalMarket();
        const newGlobalMarket = [...globalMarket, newMarketCard];
        setGlobalMarket(newGlobalMarket);
    
        setGameState(prev => {
            const { formation, storage } = prev;
            const formationPos = Object.keys(formation).find(pos => formation[pos]?.id === card.id);
    
            let newFormation = { ...formation };
            let newStorage = [...storage];
    
            if (formationPos) {
                newFormation[formationPos] = null;
            } else {
                // Fix: Add explicit type to `filter` callback to prevent type inference issues.
                newStorage = storage.filter((c: CardType) => c.id !== card.id);
            }
    
            return {
                ...prev,
                formation: newFormation,
                storage: newStorage,
                market: newGlobalMarket, // Update local view of market immediately
                objectiveProgress: applyObjectiveProgress(prev.objectiveProgress, 'list_market_cards', 1),
                activeEvolution: applyEvolutionTask(prev.activeEvolution, 'list_cards_market', 1)
            };
        });
        
        setCardToList(null);
        setMessageModal({ title: 'Card Listed', message: `${card.name} has been listed on the market for ${price} coins.` });
    };
    
    const handleQuickSell = (cardToSell: CardType) => {
        const quickSellValue = calculateQuickSellValue(cardToSell);
        
        setGameState(prev => {
            const { formation, storage } = prev;
            const formationPos = Object.keys(formation).find(pos => formation[pos]?.id === cardToSell.id);
            
            let newFormation = { ...formation };
            let newStorage = [...storage];
            let newActiveEvolution = prev.activeEvolution;

            if (formationPos) {
                newFormation[formationPos] = null;
            } else {
                // Fix: Add explicit type to `filter` callback to prevent type inference issues.
                newStorage = storage.filter((c: CardType) => c.id !== cardToSell.id);
            }
            
            if (cardToSell.rarity === 'gold') {
                newActiveEvolution = applyEvolutionTask(prev.activeEvolution, 'quicksell_gold_card', 1);
            }

            return {
                ...prev,
                formation: newFormation,
                storage: newStorage,
                coins: prev.coins + quickSellValue,
                activeEvolution: newActiveEvolution
            };
        });
        
        setCardWithOptions(null);
        setMessageModal({ title: 'Card Sold', message: `You quick sold ${cardToSell.name} for ${quickSellValue} coins.` });
    };
    

    const handleFbcSubmit = (challengeId: string, submittedCards: CardType[]) => {
        const challenge = fbcData.find(c => c.id === challengeId);
        if (!challenge) return;

        setGameState(prev => {
            let newFormation = { ...prev.formation };
            let newStorage = [...prev.storage];
            const submittedIds = new Set(submittedCards.map(c => c.id));

            for (const pos in newFormation) {
                if (newFormation[pos] && submittedIds.has(newFormation[pos]!.id)) {
                    newFormation[pos] = null;
                }
            }
            // Fix: Add explicit type to `filter` callback to prevent type inference issues.
            newStorage = newStorage.filter((c: CardType) => !submittedIds.has(c.id));

            if (challenge.reward.type === 'card' && challenge.reward.cardId) {
                const rewardCard = allCards.find(c => c.id === challenge.reward.cardId);
                if (rewardCard) {
                    newStorage.push(rewardCard);
                    setMessageModal({
                        title: 'Challenge Complete!',
                        message: `You earned ${rewardCard.name}!`,
                        card: rewardCard
                    });
                }
            }
            
            return {
                ...prev,
                formation: newFormation,
                storage: newStorage,
                completedFbcIds: [...prev.completedFbcIds, challengeId],
                objectiveProgress: applyObjectiveProgress(prev.objectiveProgress, 'complete_fbcs', 1)
            };
        });

        if (challenge.reward.type === 'pack' && challenge.reward.details) {
            handleOpenPack(challenge.reward.details, true, challenge.reward.bypassLimit);
        }
        
        playSfx('rewardClaimed');
    };

    const handleStartEvo = (evoId: string, cardId: string) => {
        if (gameState.activeEvolution) {
            setMessageModal({ title: 'Evolution in Progress', message: 'You must complete your active evolution first.' });
            return;
        }
        const evoDef = evoData.find(e => e.id === evoId);
        if (!evoDef) return;
        const initialTasks: Record<string, number> = {};
        evoDef.tasks.forEach(task => { initialTasks[task.id] = 0; });
        updateGameState({
            activeEvolution: { evoId, cardId, tasks: initialTasks }
        });
    };

    const handleClaimEvo = () => {
        playSfx('rewardClaimed');
        
        setGameState(prev => {
            if (!prev.activeEvolution) return prev;
            const evoDef = evoData.find(e => e.id === prev.activeEvolution!.evoId);
            const resultCard = allCards.find(c => c.id === evoDef?.resultCardId);
            if (!evoDef || !resultCard) return prev;

            const originalCardId = prev.activeEvolution!.cardId;
            let newFormation = { ...prev.formation };
            // Fix: Add explicit type to `filter` callback to prevent type inference issues.
            let newStorage = prev.storage.filter((c: CardType) => c.id !== originalCardId);
            const formationPos = Object.keys(prev.formation).find(pos => prev.formation[pos]?.id === originalCardId);
            
            if (formationPos) {
                newFormation[formationPos] = resultCard;
            } else {
                newStorage.push(resultCard);
            }

            setMessageModal({
                title: 'Evolution Complete!',
                message: `Your card evolved into ${resultCard.name}!`,
                card: resultCard,
            });

            return {
                ...prev,
                activeEvolution: null,
                completedEvoIds: [...(prev.completedEvoIds || []), evoDef.id],
                formation: newFormation,
                storage: newStorage,
                objectiveProgress: applyObjectiveProgress(prev.objectiveProgress, 'complete_evos', 1)
            };
        });
    };

    const handleClaimObjectiveReward = (objectiveId: string) => {
        const objective = objectivesData.find(o => o.id === objectiveId);
        if (!objective) return;
        const progress = gameState.objectiveProgress[objectiveId];
        const allTasksComplete = objective.tasks.every(task => (progress?.tasks?.[task.id] || 0) >= task.target);
        if (!progress || progress.claimed || !allTasksComplete) return;
    
        playSfx('rewardClaimed');
        setGameState(prev => {
            let newCoins = prev.coins;
            let newStorage = [...prev.storage];
            let rewardCard: CardType | undefined;
            let rewardMessage = '';

            const newProgress = { ...prev.objectiveProgress, [objectiveId]: { ...progress, claimed: true } };

            switch (objective.reward.type) {
                case 'coins':
                    newCoins += objective.reward.amount!;
                    rewardMessage = `You received ${objective.reward.amount} coins.`;
                    break;
                case 'card':
                    const cardTemplate = allCards.find(c => c.id === objective.reward.cardId);
                    if (cardTemplate) {
                        newStorage.push(cardTemplate);
                        rewardCard = cardTemplate;
                        rewardMessage = `You earned ${cardTemplate.name}!`;
                    }
                    break;
            }
            
            if (rewardMessage) {
                 setMessageModal({ title: 'Reward Claimed!', message: rewardMessage, card: rewardCard });
            }

            return { ...prev, coins: newCoins, storage: newStorage, objectiveProgress: newProgress };
        });

        if (objective.reward.type === 'pack' && objective.reward.packType) {
            handleOpenPack(objective.reward.packType, true);
        }
    };
    
    const handleClaimDailyReward = (rewardType: 'coins' | 'pack' | 'card') => {
        let title = 'Reward Claimed!';
        let message = '';
        let card: CardType | undefined = undefined;
        
        if (rewardType === 'pack') {
            const packType = Math.random() > 0.8 ? 'special' : 'builder';
            handleOpenPack(packType, true);
            setGameState(prev => ({...prev, lastRewardClaimTime: Date.now()}));
            setIsDailyRewardModalOpen(false);
            return;
        }

        setGameState(prev => {
            let newCoins = prev.coins;
            let newStorage = [...prev.storage];
            switch(rewardType) {
                case 'coins':
                    newCoins += 1000;
                    message = 'You received 1,000 coins!';
                    break;
                case 'card':
                    const possibleCards = allCards.filter(c => c.value <= 5000 && c.rarity !== 'bronze');
                    const randomCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
                    if (randomCard) {
                        newStorage.push(randomCard);
                        card = randomCard;
                        message = `You received ${randomCard.name}!`;
                    }
                    break;
            }
            if (message) {
                setMessageModal({ title, message, card });
            }
            return { ...prev, coins: newCoins, storage: newStorage, lastRewardClaimTime: Date.now() };
        });
        
        setIsDailyRewardModalOpen(false);
    };
    
    const handleAddToFormation = useCallback((card: CardType) => {
        const { formation, formationLayout, storage } = gameState;
        const layout = formationLayouts[formationLayout];
        const emptyPositionId = layout.allPositions.find(posId => !formation[posId]);

        if (emptyPositionId) {
            const newFormation = { ...formation, [emptyPositionId]: card };
            // Fix: Add explicit type to `filter` callback to prevent type inference issues.
            const newStorage = storage.filter((c: CardType) => c.id !== card.id);
            updateGameState({ formation: newFormation, storage: newStorage });
            playSfx('success');
            setCardWithOptions(null);
        } else {
            setMessageModal({ title: 'Formation Full', message: 'Your formation is full. Remove a player to add a new one.' });
        }
    }, [gameState, playSfx]);
    
    const claimableObjectivesCount = useMemo(() => {
        return objectivesData.reduce((count, obj) => {
            const progress = gameState.objectiveProgress[obj.id];
            if (progress && !progress.claimed) {
                const allTasksComplete = obj.tasks.every(task => (progress.tasks?.[task.id] || 0) >= task.target);
                if (allTasksComplete) {
                    return count + 1;
                }
            }
            return count;
        }, 0);
    }, [gameState.objectiveProgress]);

    const claimableEvoCount = useMemo(() => {
        if (!gameState.activeEvolution) return 0;
        const evoDef = evoData.find(e => e.id === gameState.activeEvolution!.evoId);
        if (!evoDef) return 0;
        const allTasksComplete = evoDef.tasks.every(task => (gameState.activeEvolution!.tasks[task.id] || 0) >= task.target);
        return allTasksComplete ? 1 : 0;
    }, [gameState.activeEvolution]);
    
    const fbcNotificationCount = useMemo(() => 0, []);

    const formationCardCount = useMemo(() => Object.values(gameState.formation).filter(Boolean).length, [gameState.formation]);
    const isFormationFull = formationCardCount >= 11;

    const renderView = () => {
        switch (currentView) {
            case 'store': return <Store onOpenPack={(packType) => handleOpenPack(packType, false)} gameState={gameState} isDevMode={isDevMode} t={t} />;
            case 'collection': return <Collection gameState={gameState} setGameState={updateGameState} setCardForOptions={setCardWithOptions} t={t} />;
            case 'market': return <Market market={gameState.market} onBuyCard={handleBuyCard} currentUserId={gameState.userId} t={t} userCoins={gameState.coins} />;
            case 'battle': return <Battle t={t} />;
            case 'fbc': return <FBC gameState={gameState} onFbcSubmit={handleFbcSubmit} t={t} playSfx={playSfx} />;
            case 'evo': return <Evo gameState={gameState} onStartEvo={handleStartEvo} onClaimEvo={handleClaimEvo} t={t} playSfx={playSfx} />;
            case 'objectives': return <Objectives gameState={gameState} onClaimReward={handleClaimObjectiveReward} t={t} />;
            default: return null;
        }
    };

    return (
        <div className={`App font-main bg-dark-gray min-h-screen text-white ${lang === 'ar' ? 'font-ar' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            
            {appState === 'welcome' && <WelcomeScreen onStart={() => setAppState('intro')} />}
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
                        onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
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
            
            <CardOptionsModal 
                cardWithOptions={cardWithOptions} 
                onClose={() => setCardWithOptions(null)} 
                onListCard={(card) => { setCardToList(card); setCardWithOptions(null); }} 
                onQuickSell={handleQuickSell}
                onAddToFormation={handleAddToFormation}
                isFormationFull={isFormationFull}
                t={t} 
            />
            <MarketModal cardToList={cardToList} onClose={() => setCardToList(null)} onList={handleListCard} t={t} />
            <DuplicateSellModal card={duplicateToSell} onSell={handleQuickSellDuplicate} t={t} />
            <DailyRewardModal isOpen={isDailyRewardModalOpen} onClaim={handleClaimDailyReward} />
        </div>
    );
};

export default App;
