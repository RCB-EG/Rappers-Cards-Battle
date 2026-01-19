
import React, { useState, useEffect, useCallback } from 'react';
import { 
    GameState, 
    Card as GameCard, 
    PackType,
    PackData, 
    MarketCard, 
    User, 
    GameView, 
    ObjectiveProgress, 
    PlayerPickConfig,
    Rank
} from './types';
import { initialState } from './data/initialState';
import { packs, allCards, objectivesData, evoData, fbcData, playerPickConfigs, rankSystem } from './data/gameData';
import { sfx } from './data/sounds';
import { translations, TranslationKey } from './utils/translations';
import { playSound, updateMainMusic } from './utils/sound';
import { preloadCriticalAssets } from './utils/assets';
import { useSettings } from './hooks/useSettings';
import { auth, db } from './firebaseConfig';
import { 
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    User as FirebaseUser 
} from 'firebase/auth';
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    onSnapshot, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    limit, 
    deleteDoc,
    runTransaction
} from 'firebase/firestore';

import Header from './components/Header';
import Navigation from './components/Navigation';
import WelcomeScreen from './components/WelcomeScreen';
import IntroVideo from './components/IntroVideo';
import Particles from './components/Particles';
import Store from './components/views/Store';
import Collection from './components/views/Collection';
import Market from './components/views/Market';
import Battle from './components/views/Battle';
import FBC from './components/views/FBC';
import Evo from './components/views/Evo';
import Objectives from './components/views/Objectives';
import LoginModal from './components/modals/LoginModal';
import SignUpModal from './components/modals/SignUpModal';
import SettingsModal from './components/modals/SettingsModal';
import HowToPlayModal from './components/modals/HowToPlayModal';
import MessageModal from './components/modals/MessageModal';
import CardOptionsModal from './components/modals/CardOptionsModal';
import PackAnimationModal from './components/modals/PackAnimationModal';
import MarketModal from './components/modals/MarketModal';
import DuplicateSellModal from './components/modals/DuplicateSellModal';
import PackResultsModal from './components/modals/PackResultsModal';
import PlayerPickModal from './components/modals/PlayerPickModal';
import RankUpModal from './components/modals/RankUpModal';
import RewardModal, { RewardData } from './components/modals/RewardModal';
import { calculateQuickSellValue } from './utils/cardUtils';

const App: React.FC = () => {
    // Game State
    const [gameState, setGameState] = useState<GameState>(initialState);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [view, setView] = useState<GameView>('store');
    const [settings, updateSettings] = useSettings();
    const [isDevMode, setIsDevMode] = useState(false);
    const [lang, setLang] = useState<'en' | 'ar'>('en');

    // UI State
    const [isLoadingAssets, setIsLoadingAssets] = useState(true);
    const [showWelcome, setShowWelcome] = useState(true);
    const [showIntro, setShowIntro] = useState(false);
    const [modals, setModals] = useState({
        login: false,
        signup: false,
        settings: false,
        howToPlay: false,
        dailyReward: false
    });
    
    // Detailed Modal State
    const [messageModal, setMessageModal] = useState<{title: string, message: string, card?: GameCard} | null>(null);
    const [cardOptions, setCardOptions] = useState<{card: GameCard, origin: 'formation' | 'storage'} | null>(null);
    const [cardToList, setCardToList] = useState<GameCard | null>(null);
    const [packCard, setPackCard] = useState<GameCard | null>(null); 
    const [pendingPackCards, setPendingPackCards] = useState<GameCard[]>([]); 
    const [duplicateCard, setDuplicateCard] = useState<GameCard | null>(null);
    const [rankUpModalData, setRankUpModalData] = useState<{ newRank: Rank, rewards: { coins: number, packs: PackType[], picks: string[] } } | null>(null);
    const [rewardModal, setRewardModal] = useState<{ isOpen: boolean, reward: RewardData | null, title?: string }>({ isOpen: false, reward: null });

    // --- Asset Preloading ---
    useEffect(() => {
        const loadAssets = async () => {
            // await preloadCriticalAssets(); // Disabled as per user request for "bit by bit" loading
            setIsLoadingAssets(false);
        };
        loadAssets();
    }, []);

    // --- Translation Helper ---
    const t = useCallback((key: TranslationKey, replacements?: Record<string, string | number>) => {
        let text = translations[lang][key] || key;
        if (replacements) {
            Object.entries(replacements).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }
        return text;
    }, [lang]);

    const playSfx = useCallback((key: keyof typeof sfx) => {
        if (settings.sfxOn) {
            playSound(sfx[key], settings.sfxVolume);
        }
    }, [settings.sfxOn, settings.sfxVolume]);

    // Music Manager
    useEffect(() => {
        if (!isLoadingAssets && !showWelcome && !showIntro) {
            updateMainMusic(settings.musicVolume, settings.musicOn);
        } else {
            const mainBg = document.getElementById('bg-music') as HTMLAudioElement;
            if (mainBg) mainBg.pause();
        }
    }, [settings.musicVolume, settings.musicOn, showWelcome, showIntro, isLoadingAssets]);

    // --- FIREBASE SYNC LOGIC ---

    // 1. Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setFirebaseUser(user);
            if (user) {
                // Fetch user data once on login
                try {
                    const userRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(userRef);
                    
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        setCurrentUser(userData.userProfile as User);
                        // Merge remote data with initial state to handle any new fields in updates
                        // Important: Preserve local market state if any, though usually market loads separately
                        setGameState(prev => ({ 
                            ...initialState, 
                            ...userData, 
                            userId: user.uid, 
                            market: prev.market 
                        }));
                    } else {
                        // Create new user profile
                        const newProfile: User = { username: user.email?.split('@')[0] || 'User', email: user.email || '' };
                        setCurrentUser(newProfile);
                        const newState = { ...initialState, userId: user.uid, userProfile: newProfile };
                        // Filter out 'market' before saving just in case
                        const { market, ...stateToSave } = newState;
                        await setDoc(userRef, stateToSave);
                        setGameState(prev => ({ ...newState, market: prev.market }));
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            } else {
                // Guest Mode
                setCurrentUser(null);
                const savedGuest = localStorage.getItem('guestGameState');
                if (savedGuest) {
                    try {
                        const parsed = JSON.parse(savedGuest);
                        setGameState(prev => ({ ...initialState, ...parsed, market: prev.market }));
                    } catch {
                        setGameState(initialState);
                    }
                } else {
                    setGameState(initialState);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // 2. Data Saver
    // This function saves the state to Firestore or LocalStorage
    const saveGameData = useCallback(async (stateToSave: Partial<GameState>) => {
        if (!auth.currentUser) {
            // Guest: Save to LocalStorage (merging with existing)
            try {
                const current = JSON.parse(localStorage.getItem('guestGameState') || '{}');
                const merged = { ...current, ...stateToSave };
                localStorage.setItem('guestGameState', JSON.stringify(merged));
            } catch (e) { console.error("LS Error", e); }
            return;
        }

        // Online: Save to Firestore
        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            // Sanitize: Remove 'market' (it's global), remove undefineds
            const { market, ...cleanState } = stateToSave as GameState; 
            const sanitized = JSON.parse(JSON.stringify(cleanState)); // Simple way to strip undefined
            
            await updateDoc(userRef, sanitized);
        } catch (error) {
            console.error("Error saving game data:", error);
        }
    }, []);

    // 3. State Update Wrapper
    // Updates local React state immediately (Optimistic UI) and triggers background save
    const updateGameState = useCallback((updates: Partial<GameState>) => {
        setGameState(prev => {
            const newState = { ...prev, ...updates };
            // Fire and forget save. Passing 'updates' is usually enough if we trust merge,
            // but passing 'newState' (without market) ensures consistency.
            // However, to reduce bandwidth, we can just save the updated fields if we are careful.
            // For robustness "from scratch", let's save the critical parts of newState.
            
            // We defer the save slightly to let the render cycle finish? No need.
            saveGameData(updates); 
            
            return newState;
        });
    }, [saveGameData]);

    // 4. Market Listener (Global Data)
    useEffect(() => {
        const q = query(collection(db, 'market'), orderBy('createdAt', 'desc'), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const marketData: MarketCard[] = [];
            snapshot.forEach((doc) => {
                marketData.push({ ...doc.data() as MarketCard, marketId: doc.id });
            });
            // Update ONLY the market field locally, do NOT trigger a user save
            setGameState(prev => ({ ...prev, market: marketData }));
        }, (error) => {
            console.error("Market sync error:", error);
        });
        return () => unsubscribe();
    }, []);


    // --- Game Logic ---

    const handleStartGame = () => {
        setShowWelcome(false);
        setShowIntro(true);
        playSfx('buttonClick');
    };

    const handleFinishIntro = () => {
        setShowIntro(false);
    };

    // Helper: Apply Objective Progress
    const applyObjectiveProgress = useCallback((
        currentProgress: Record<string, ObjectiveProgress>, 
        taskId: string, 
        increment: number
    ): Record<string, ObjectiveProgress> => {
        const newProgress = { ...currentProgress };
        objectivesData.forEach(obj => {
            const task = obj.tasks.find(t => t.id === taskId);
            if (task) {
                if (!newProgress[obj.id]) {
                    newProgress[obj.id] = { tasks: {}, claimed: false };
                }
                const currentTaskValue = newProgress[obj.id].tasks[taskId] || 0;
                newProgress[obj.id].tasks[taskId] = Math.min(task.target, currentTaskValue + increment);
            }
        });
        return newProgress;
    }, []);

    // Helper: Apply Evo Progress
    const applyEvolutionTask = useCallback((
        activeEvo: GameState['activeEvolution'],
        taskId: string,
        increment: number
    ): GameState['activeEvolution'] => {
        if (!activeEvo) return null;
        
        const evoDef = evoData.find(e => e.id === activeEvo.evoId);
        if (!evoDef) return activeEvo;

        const task = evoDef.tasks.find(t => t.id === taskId);
        if (task) {
            const currentVal = activeEvo.tasks[taskId] || 0;
            const newVal = Math.min(task.target, currentVal + increment);
             return {
                ...activeEvo,
                tasks: {
                    ...activeEvo.tasks,
                    [taskId]: newVal
                }
            };
        }
        return activeEvo;
    }, []);

    // --- Objectives: Track Formation Changes ---
    useEffect(() => {
        const goldCount = Object.values(gameState.formation).filter((c: GameCard | null) => c && c.rarity === 'gold').length;
        const objId = 'milestone_a_step_ahead';
        const taskId = 'formation_11_gold';
        
        const currentProgress = gameState.objectiveProgress[objId]?.tasks[taskId] || 0;
        
        if (goldCount >= 11 && currentProgress < 1) {
             const newObjectiveProgress = applyObjectiveProgress(gameState.objectiveProgress, taskId, 1);
             updateGameState({ objectiveProgress: newObjectiveProgress });
        }
    }, [gameState.formation, gameState.objectiveProgress, applyObjectiveProgress, updateGameState]);

    // --- Daily Reset Logic ---
    useEffect(() => {
        const checkDailyObjectives = () => {
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            let lastReset = gameState.lastDailyReset;
            let currentProgress = { ...gameState.objectiveProgress };
            let currentCompletedFbcs = [...gameState.completedFbcIds];
            let stateChanged = false;

            if (!lastReset || (now - lastReset > oneDay)) {
                objectivesData.filter(o => o.type === 'daily').forEach(o => {
                    if (currentProgress[o.id]) delete currentProgress[o.id];
                });
                const dailyFbcIds = fbcData.filter(f => f.repeatable === 'daily').map(f => f.id);
                currentCompletedFbcs = currentCompletedFbcs.filter(id => !dailyFbcIds.includes(id));
                lastReset = now;
                stateChanged = true;
            }

            const loginObjId = 'd_login'; 
            const taskId = 'daily_login_task';
            const loginProgress = currentProgress[loginObjId]?.tasks[taskId] || 0;

            if (loginProgress < 1) {
                if (!currentProgress[loginObjId]) currentProgress[loginObjId] = { tasks: {}, claimed: false };
                currentProgress[loginObjId].tasks[taskId] = 1;
                stateChanged = true;
            }

            if (stateChanged) {
                updateGameState({ 
                    lastDailyReset: lastReset,
                    objectiveProgress: currentProgress,
                    completedFbcIds: currentCompletedFbcs
                });
            }
        };
        checkDailyObjectives();
    }, [gameState.lastDailyReset, gameState.objectiveProgress, gameState.completedFbcIds, updateGameState]);


    // --- Actions ---

    const handleBuyCard = async (marketCard: MarketCard) => {
        if (gameState.coins < marketCard.price) {
             setMessageModal({ title: 'Insufficient Funds', message: 'You do not have enough coins.' });
             return;
        }
        
        // Anti-Duplicate Check
        const alreadyInStorage = gameState.storage.some((c: GameCard) => c.name === marketCard.name);
        const alreadyInFormation = (Object.values(gameState.formation) as (GameCard | null)[]).some(c => c?.name === marketCard.name);
        
        if (alreadyInStorage || alreadyInFormation) {
             setMessageModal({ title: 'Duplicate Found', message: `You already own ${marketCard.name}.` });
             return;
        }

        if (!auth.currentUser) {
            setMessageModal({ title: 'Guest Mode', message: 'Market purchases require an account.' });
            return;
        }

        // TRANSACTION: Atomically remove from market AND update user
        try {
            await runTransaction(db, async (transaction) => {
                const cardRef = doc(db, 'market', marketCard.marketId!);
                const cardDoc = await transaction.get(cardRef);
                
                if (!cardDoc.exists()) {
                    throw "Card no longer exists!";
                }

                // 1. Remove from Market
                transaction.delete(cardRef);

                // 2. Read User Doc
                const userRef = doc(db, 'users', auth.currentUser!.uid);
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw "User not found";

                const userData = userDoc.data() as GameState;
                if (userData.coins < marketCard.price) throw "Insufficient funds (server check)";

                // 3. Update User Doc
                const { marketId, sellerId, price, createdAt, ...cardData } = marketCard;
                const newCard = { ...cardData, id: `${cardData.id}-${Date.now()}` };
                
                // We must use arrayUnion/increment ideally, but reading and writing the whole object in a transaction is safe too for this scale
                const newStorage = [...userData.storage, newCard];
                const newCoins = userData.coins - price;

                transaction.update(userRef, {
                    storage: newStorage,
                    coins: newCoins
                });

                // Update Local State Optimistically (Transaction successful if we get here?) 
                // Actually transaction runs on server. We should update local state AFTER await.
            });

            // If transaction succeeds:
            playSfx('purchase');
            // Manual local update to match DB
            const { marketId, sellerId, price, createdAt, ...cardData } = marketCard;
            const newCard = { ...cardData, id: `${cardData.id}-${Date.now()}` };
            
            setGameState(prev => ({
                ...prev,
                coins: prev.coins - price,
                storage: [...prev.storage, newCard]
            }));
            setMessageModal({ title: 'Success', message: `You bought ${marketCard.name}!` });

        } catch (e) {
            console.error("Buy Transaction Failed:", e);
            setMessageModal({ title: 'Error', message: 'Purchase failed. Someone else might have bought it.' });
        }
    };

    const handleListCard = async (card: GameCard, price: number) => {
        if (!firebaseUser) {
            setMessageModal({ title: 'Login Required', message: 'You must be logged in to use the market.' });
            return;
        }
        
        try {
            await addDoc(collection(db, 'market'), {
                ...card,
                price,
                sellerId: firebaseUser.uid,
                createdAt: Date.now()
            });

            const newStorage = gameState.storage.filter(c => c.id !== card.id);
            const newFormation = { ...gameState.formation };
            Object.keys(newFormation).forEach(key => {
                if (newFormation[key]?.id === card.id) {
                    newFormation[key] = null;
                }
            });

            const newObjectives = applyObjectiveProgress(gameState.objectiveProgress, 'list_market_cards', 1);
            const newEvo = applyEvolutionTask(gameState.activeEvolution, 'list_cards_market', 1);
            
            updateGameState({ 
                storage: newStorage,
                formation: newFormation,
                objectiveProgress: newObjectives,
                activeEvolution: newEvo
            });
            setCardToList(null);
            setPendingPackCards(prev => prev.filter(c => c.id !== card.id));

        } catch (e) {
            console.error("Listing error:", e);
            setMessageModal({ title: 'Error', message: 'Failed to list card.' });
        }
    };

    const handleCancelListing = async (marketCard: MarketCard) => {
         try {
             const cardRef = doc(db, 'market', marketCard.marketId!);
             await deleteDoc(cardRef);
             const { marketId, sellerId, price, createdAt, ...cardData } = marketCard;
             updateGameState({ storage: [...gameState.storage, cardData] });
         } catch(e) {
             console.error("Cancel listing error:", e);
         }
    };

    const handleOpenPack = useCallback((packType: PackType, options: { isReward?: boolean, bypassLimit?: boolean, fromInventory?: boolean, currency?: 'coins' | 'bp' } = {}) => {
        const { isReward = false, bypassLimit = false, fromInventory = false, currency = 'coins' } = options;
        
        const getCardWeight = (card: GameCard) => {
            if (card.rarity === 'gold') return card.ovr < 87 ? 100 : 3; 
            if (card.rarity === 'rotm') return card.ovr <= 90 ? 50 : 1;
            if (card.rarity === 'icon') return card.ovr <= 91 ? 50 : 1;
            return 20;
        };

        const selectWeightedCard = (candidates: GameCard[]): GameCard => {
            const totalWeight = candidates.reduce((sum, c: GameCard) => sum + getCardWeight(c), 0);
            let random = Math.random() * totalWeight;
            for (const card of candidates) {
                random -= getCardWeight(card);
                if (random < 0) return card;
            }
            return candidates[0];
        };
        
        const pack: PackData = packs[packType];
        const newCards: GameCard[] = [];
        const pickedTemplateIds = new Set<string>();

        for (let i = 0; i < 3; i++) {
            let foundCard: GameCard | null = null;
            let attempts = 0;
            while (!foundCard && attempts < 50) {
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
                    const candidate = selectWeightedCard(possibleCards);
                    if (!pickedTemplateIds.has(candidate.id)) {
                        foundCard = candidate;
                        pickedTemplateIds.add(candidate.id);
                    }
                }
                attempts++;
            }
            if (!foundCard) {
                const bronzeCards = allCards.filter(c => c.rarity === 'bronze');
                foundCard = bronzeCards.length > 0 ? selectWeightedCard(bronzeCards) : allCards[0];
            }
            const newCard = { ...foundCard } as GameCard;
            newCard.id = `${newCard.id}-${Date.now()}-${Math.floor(Math.random() * 100000)}-${i}`;
            newCards.push(newCard);
        }

        newCards.sort((a, b) => b.ovr - a.ovr);
        const bestCard = newCards[0];

        if (!isReward && !fromInventory && !isDevMode) {
            if (currency === 'coins' && pack.cost > gameState.coins) {
                setMessageModal({ title: 'Not Enough Coins', message: `You need ${pack.cost} coins.` });
                return;
            }
            if (currency === 'bp' && pack.bpCost > (gameState.battlePoints || 0)) {
                setMessageModal({ title: 'Not Enough BP', message: `You need ${pack.bpCost} Battle Points.` });
                return;
            }
        }
        
        let stateUpdates: Partial<GameState> = {};
        
        if (packType === 'free' && !bypassLimit && !fromInventory) {
            const twelveHours = 12 * 60 * 60 * 1000;
            const now = Date.now();
            let { freePacksOpenedToday, lastFreePackResetTime } = gameState;
            if (lastFreePackResetTime && (now - lastFreePackResetTime > twelveHours)) {
                freePacksOpenedToday = 0;
                lastFreePackResetTime = now;
            } else if (!lastFreePackResetTime) lastFreePackResetTime = now;
            
            if (freePacksOpenedToday >= 3 && !isDevMode) {
                setMessageModal({ title: 'Limit Reached', message: 'Come back later!' });
                return;
            }
            stateUpdates.freePacksOpenedToday = freePacksOpenedToday + 1;
            stateUpdates.lastFreePackResetTime = lastFreePackResetTime;
            stateUpdates.objectiveProgress = applyObjectiveProgress(gameState.objectiveProgress, 'open_free_packs', 1);

        } else if (!isReward && !fromInventory) {
            if (currency === 'coins') {
                stateUpdates.coins = gameState.coins - pack.cost;
            } else {
                stateUpdates.battlePoints = (gameState.battlePoints || 0) - pack.bpCost;
            }
            
            let currentObjectiveProgress = gameState.objectiveProgress;
            let currentActiveEvolution = gameState.activeEvolution;

            if (packType === 'builder') {
                currentObjectiveProgress = applyObjectiveProgress(currentObjectiveProgress, 'open_builder_packs', 1);
            }
            if (packType === 'special') {
                currentActiveEvolution = applyEvolutionTask(currentActiveEvolution, 'open_special_packs', 1);
            }
            stateUpdates.objectiveProgress = currentObjectiveProgress;
            stateUpdates.activeEvolution = currentActiveEvolution;
        }

        if (fromInventory) {
            const packIndex = gameState.ownedPacks.indexOf(packType);
            if (packIndex > -1) {
                const newOwned = [...gameState.ownedPacks];
                newOwned.splice(packIndex, 1);
                stateUpdates.ownedPacks = newOwned;
            }
        }

        playSfx('packBuildup');

        if (settings.animationsOn) {
            setPackCard(bestCard);
            setPendingPackCards(newCards);
            updateGameState(stateUpdates);
        } else {
            setPendingPackCards(newCards);
            updateGameState(stateUpdates);
        }
    }, [gameState, isDevMode, settings.animationsOn, playSfx, applyObjectiveProgress, applyEvolutionTask, updateGameState]);

    const handleOpenPlayerPick = (config: PlayerPickConfig) => {
        const pickIndex = gameState.ownedPlayerPicks.findIndex(p => p.id === config.id);
        if (pickIndex > -1) {
            const newOwned = [...gameState.ownedPlayerPicks];
            newOwned.splice(pickIndex, 1);
            updateGameState({ 
                ownedPlayerPicks: newOwned,
                activePlayerPick: config 
            });
        }
    };

    const handleKeepCard = (card: GameCard) => {
        const alreadyInStorage = gameState.storage.some((c: GameCard) => c.name === card.name);
        const alreadyInFormation = (Object.values(gameState.formation) as (GameCard | null)[]).some(c => c?.name === card.name);
        
        if (alreadyInStorage || alreadyInFormation) {
            setDuplicateCard(card);
            setPendingPackCards(prev => prev.filter(c => c.id !== card.id));
            return;
        }

        updateGameState({ storage: [...gameState.storage, card] });
        setPendingPackCards(prev => prev.filter(c => c.id !== card.id));
    };

    const handleQuickSell = (card: GameCard) => {
        playSfx('purchase');
        const value = calculateQuickSellValue(card);
        const updates: Partial<GameState> = { coins: gameState.coins + value };
        
        if (card.rarity === 'gold') {
             updates.activeEvolution = applyEvolutionTask(gameState.activeEvolution, 'quicksell_gold_card', 1);
        }

        let removed = false;
        if (pendingPackCards.find(c => c.id === card.id)) {
            setPendingPackCards(prev => prev.filter(c => c.id !== card.id));
            removed = true;
        } 
        
        if (!removed && gameState.storage.find(c => c.id === card.id)) {
            updates.storage = gameState.storage.filter(c => c.id !== card.id);
            removed = true;
        }

        if (!removed) {
             const newFormation = { ...gameState.formation };
             let foundInFormation = false;
             Object.keys(newFormation).forEach(key => {
                if (newFormation[key]?.id === card.id) {
                    newFormation[key] = null;
                    foundInFormation = true;
                }
             });
             if (foundInFormation) {
                 updates.formation = newFormation;
                 removed = true;
             }
        }

        if (duplicateCard?.id === card.id) setDuplicateCard(null);
        updateGameState(updates);
        if (cardOptions?.card.id === card.id) setCardOptions(null);
    };

    const handleAddToFormation = (card: GameCard) => {
        const emptyPos = Object.keys(gameState.formation).find(pos => gameState.formation[pos] === null);
        if (emptyPos) {
            const newFormation = { ...gameState.formation, [emptyPos]: card };
            const newStorage = gameState.storage.filter(c => c.id !== card.id);
            
            let newEvo = gameState.activeEvolution;
            if (card.name === 'Tommy Gun') {
                newEvo = applyEvolutionTask(newEvo, 'tommy_gun_in_formation', 1);
            }
            
            updateGameState({ formation: newFormation, storage: newStorage, activeEvolution: newEvo });
            setCardOptions(null);
        }
    };
    
    const handleBattleResult = (amount: number, isWin: boolean, mode: 'ranked' | 'challenge', squad: GameCard[]) => {
        const updates: Partial<GameState> = {};
        const xpGain = isWin ? 150 : 25;
        updates.battlePoints = (gameState.battlePoints || 0) + amount;
        updates.xp = (gameState.xp || 0) + xpGain;

        let newObjProgress = applyObjectiveProgress(gameState.objectiveProgress, 'play_any_battle', 1);
        if (mode === 'challenge') {
            newObjProgress = applyObjectiveProgress(newObjProgress, 'play_challenge_battle', 1);
            if (isWin) newObjProgress = applyObjectiveProgress(newObjProgress, 'win_challenge_battle', 1);
        } else if (mode === 'ranked' && isWin) {
            newObjProgress = applyObjectiveProgress(newObjProgress, 'win_ranked_games', 1);
        }
        updates.objectiveProgress = newObjProgress;

        if (squad.some((c: GameCard) => c.name === 'Abo El Anwar' && c.rarity === 'gold')) {
            updates.activeEvolution = applyEvolutionTask(gameState.activeEvolution, 'play_battle_abo', 1);
        }

        if (isWin && mode === 'ranked') {
            const currentRank = gameState.rank || 'Bronze';
            const rankConfig = rankSystem[currentRank];
            let newRankWins = (gameState.rankWins || 0) + 1;
            
            if (currentRank === 'Legend') {
                if (newRankWins >= rankConfig.winsToPromote) {
                    newRankWins = 0; 
                    const rewards = rankConfig.promotionReward;
                    updates.coins = gameState.coins + rewards.coins;
                    updates.ownedPacks = [...gameState.ownedPacks, ...rewards.packs];
                    const newPicks = rewards.picks.map(id => playerPickConfigs[id]).filter(Boolean);
                    updates.ownedPlayerPicks = [...gameState.ownedPlayerPicks, ...newPicks];
                    setRankUpModalData({ newRank: 'Legend', rewards });
                    playSfx('success');
                }
            } else if (newRankWins >= rankConfig.winsToPromote) {
                let nextRank: Rank = currentRank;
                if (currentRank === 'Bronze') nextRank = 'Silver';
                else if (currentRank === 'Silver') nextRank = 'Gold';
                else if (currentRank === 'Gold') nextRank = 'Legend';
                
                newRankWins = 0;
                const rewards = rankConfig.promotionReward;
                updates.coins = gameState.coins + rewards.coins;
                updates.ownedPacks = [...gameState.ownedPacks, ...rewards.packs];
                const newPicks = rewards.picks.map(id => playerPickConfigs[id]).filter(Boolean);
                updates.ownedPlayerPicks = [...gameState.ownedPlayerPicks, ...newPicks];

                setRankUpModalData({ newRank: nextRank, rewards });
                playSfx('success');
                updates.rank = nextRank;
            }
            updates.rankWins = newRankWins;
        }
        updateGameState(updates);
    };
    
    const handleFbcSubmit = (challengeId: string, submittedCards: GameCard[]) => {
        const challenge = fbcData.find(c => c.id === challengeId);
        if (!challenge) return;

        const submittedIds = submittedCards.map(c => c.id);
        const newStorage = gameState.storage.filter(c => !submittedIds.includes(c.id));
        const newFormation = { ...gameState.formation };
        Object.keys(newFormation).forEach(key => {
            if (newFormation[key] && submittedIds.includes(newFormation[key]!.id)) {
                newFormation[key] = null;
            }
        });

        let newCompletedFbcs = [...gameState.completedFbcIds, challengeId];
        let newObjectiveProgress = applyObjectiveProgress(gameState.objectiveProgress, 'complete_fbcs', 1);
        let rewardUpdate: Partial<GameState> = {};

        if (challenge.reward.type === 'coins' && challenge.reward.amount) {
            rewardUpdate.coins = gameState.coins + challenge.reward.amount;
        } else if (challenge.reward.type === 'pack' && challenge.reward.details) {
            rewardUpdate.ownedPacks = [...gameState.ownedPacks, challenge.reward.details];
        } else if (challenge.reward.type === 'card' && challenge.reward.cardId) {
            const rewardCard = allCards.find(c => c.id === challenge.reward.cardId);
            if (rewardCard) {
                newStorage.push({ ...rewardCard, id: `${rewardCard.id}-${Date.now()}` });
            }
        }

        updateGameState({
            storage: newStorage,
            formation: newFormation,
            completedFbcIds: newCompletedFbcs,
            objectiveProgress: newObjectiveProgress,
            ...rewardUpdate
        });
        playSfx('success');

        setRewardModal({
            isOpen: true,
            reward: {
                type: challenge.reward.type as any,
                amount: challenge.reward.amount,
                packType: challenge.reward.details,
                cardId: challenge.reward.cardId
            },
            title: t(challenge.title as TranslationKey) + " Completed!"
        });
    };

    const handleStartEvo = (evoId: string, cardId: string) => {
        updateGameState({ activeEvolution: { evoId, cardId, tasks: {} } });
    };

    const handleClaimEvo = () => {
        if (!gameState.activeEvolution) return;
        const evoDef = evoData.find(e => e.id === gameState.activeEvolution!.evoId);
        if (!evoDef) return;

        const resultCard = allCards.find(c => c.id === evoDef.resultCardId);
        if (resultCard) {
            const oldCardId = gameState.activeEvolution.cardId;
            let newStorage = gameState.storage.filter(c => c.id !== oldCardId);
            let newFormation = { ...gameState.formation };
            let replacedInFormation = false;
            
            Object.keys(newFormation).forEach(key => {
                if (newFormation[key]?.id === oldCardId) {
                    newFormation[key] = { ...resultCard, id: `${resultCard.id}-${Date.now()}` };
                    replacedInFormation = true;
                }
            });
            
            if (!replacedInFormation) {
                newStorage.push({ ...resultCard, id: `${resultCard.id}-${Date.now()}` });
            }

            updateGameState({
                activeEvolution: null,
                completedEvoIds: [...gameState.completedEvoIds, evoDef.id],
                storage: newStorage,
                formation: newFormation,
                objectiveProgress: applyObjectiveProgress(gameState.objectiveProgress, 'complete_evos', 1)
            });
            playSfx('rewardClaimed');

            setRewardModal({
                isOpen: true,
                reward: { type: 'card', cardId: resultCard.id },
                title: "Evolution Completed!"
            });
        }
    };
    
    const handleClaimObjective = (objId: string) => {
        const obj = objectivesData.find(o => o.id === objId);
        if (!obj) return;
        
        const progress = gameState.objectiveProgress[objId];
        if (!progress || progress.claimed) return;
        
        let updates: Partial<GameState> = {
            objectiveProgress: {
                ...gameState.objectiveProgress,
                [objId]: { ...progress, claimed: true }
            }
        };
        
        if (obj.reward.type === 'coins') {
            updates.coins = gameState.coins + (obj.reward.amount || 0);
        } else if (obj.reward.type === 'pack') {
            updates.ownedPacks = [...gameState.ownedPacks, obj.reward.packType!];
        } else if (obj.reward.type === 'card') {
            const card = allCards.find(c => c.id === obj.reward.cardId);
            if (card) {
                updates.storage = [...gameState.storage, { ...card, id: `${card.id}-${Date.now()}` }];
            }
        } else if (obj.reward.type === 'player_pick' && obj.reward.playerPickId) {
            const pickConfig = playerPickConfigs[obj.reward.playerPickId];
            if (pickConfig) {
                updates.ownedPlayerPicks = [...gameState.ownedPlayerPicks, pickConfig];
            }
        } else if (obj.reward.type === 'coins_and_pick') {
            if (obj.reward.amount) updates.coins = gameState.coins + obj.reward.amount;
            if (obj.reward.playerPickId) {
                const pickConfig = playerPickConfigs[obj.reward.playerPickId];
                if (pickConfig) updates.ownedPlayerPicks = [...gameState.ownedPlayerPicks, pickConfig];
            }
        }
        
        updateGameState(updates);
        playSfx('rewardClaimed');

        setRewardModal({
            isOpen: true,
            reward: obj.reward,
            title: t('completed') + ": " + t(obj.titleKey as TranslationKey)
        });
    };

    const handlePlayerPickComplete = (selectedCards: GameCard[]) => {
        const newCards: GameCard[] = [];
        selectedCards.forEach(card => {
            const uniqueCard = { ...card, id: `${card.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`};
            newCards.push(uniqueCard);
        });
        setPendingPackCards(newCards);
        updateGameState({ activePlayerPick: null });
        playSfx('purchase');
    };

    // --- RENDER ---

    if (isLoadingAssets) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[200]">
                <p className="text-gold-light mt-4 font-header tracking-wider">Loading...</p>
            </div>
        );
    }

    const notificationCounts = {
        objectives: objectivesData.filter(o => {
            const prog = gameState.objectiveProgress[o.id];
            return prog && !prog.claimed && o.tasks.every(t => (prog.tasks[t.id] || 0) >= t.target);
        }).length,
        evo: gameState.activeEvolution && evoData.find(e => e.id === gameState.activeEvolution?.evoId)?.tasks.every(t => (gameState.activeEvolution?.tasks[t.id] || 0) >= t.target) ? 1 : 0,
        fbc: 0,
        store: gameState.ownedPacks.length + gameState.ownedPlayerPicks.length
    };

    return (
        <div className="app-container min-h-screen bg-gradient-to-br from-gray-900 to-black text-white font-main overflow-x-hidden pb-10">
            <Particles rank={gameState.rank} />
            
            {showIntro && <IntroVideo onSkip={handleFinishIntro} />}
            {showWelcome && !showIntro && <WelcomeScreen onStart={handleStartGame} />}
            
            {!showWelcome && !showIntro && (
                <>
                    <Header 
                        gameState={gameState} 
                        currentUser={currentUser}
                        onToggleDevMode={() => setIsDevMode(!isDevMode)} 
                        isDevMode={isDevMode}
                        onOpenSettings={() => setModals({...modals, settings: true})}
                        onOpenHowToPlay={() => setModals({...modals, howToPlay: true})}
                        onOpenLogin={() => setModals({...modals, login: true})}
                        onOpenSignUp={() => setModals({...modals, signup: true})}
                        onLogout={() => signOut(auth)}
                        lang={lang}
                        setLang={setLang}
                        t={t}
                    />

                    <div className="container mx-auto px-4 pt-4">
                        <Navigation 
                            currentView={view} 
                            setCurrentView={setView} 
                            t={t}
                            notificationCounts={notificationCounts}
                        />

                        <div className="view-content min-h-[60vh]">
                            {view === 'store' && (
                                <Store 
                                    onOpenPack={handleOpenPack}
                                    onOpenInventoryPick={handleOpenPlayerPick}
                                    gameState={gameState} 
                                    isDevMode={isDevMode} 
                                    t={t} 
                                />
                            )}
                            {view === 'collection' && <Collection gameState={gameState} setGameState={updateGameState} setCardForOptions={setCardOptions} t={t} />}
                            {view === 'market' && <Market market={gameState.market} onBuyCard={handleBuyCard} onCancelListing={handleCancelListing} currentUserId={currentUser?.username || ''} t={t} userCoins={gameState.coins} />}
                            {view === 'battle' && <Battle gameState={gameState} onBattleWin={handleBattleResult} t={t} playSfx={playSfx} musicVolume={settings.musicVolume} musicOn={settings.musicOn} />}
                            {view === 'fbc' && <FBC gameState={gameState} onFbcSubmit={handleFbcSubmit} t={t} playSfx={playSfx} />}
                            {view === 'evo' && <Evo gameState={gameState} onStartEvo={handleStartEvo} onClaimEvo={handleClaimEvo} t={t} playSfx={playSfx} />}
                            {view === 'objectives' && <Objectives gameState={gameState} onClaimReward={handleClaimObjective} t={t} />}
                        </div>
                    </div>
                </>
            )}

            {/* Modals */}
            <LoginModal 
                isOpen={modals.login} 
                onClose={() => setModals({...modals, login: false})} 
                onLogin={(creds) => signInWithEmailAndPassword(auth, creds.username, creds.password!).then(() => setModals({...modals, login: false})).catch(e => alert(e.message))} 
                error={null} 
                t={t} 
            />
            <SignUpModal 
                isOpen={modals.signup} 
                onClose={() => setModals({...modals, signup: false})} 
                onSignUp={(creds) => createUserWithEmailAndPassword(auth, creds.email!, creds.password!).then((u) => {
                     setDoc(doc(db, 'users', u.user.uid), { userProfile: { username: creds.username, email: creds.email, avatar: creds.avatar }, ...initialState });
                     setModals({...modals, signup: false});
                }).catch(e => alert(e.message))} 
                error={null} 
                t={t} 
            />
            <SettingsModal isOpen={modals.settings} onClose={() => setModals({...modals, settings: false})} settings={settings} updateSettings={updateSettings} t={t} />
            <HowToPlayModal isOpen={modals.howToPlay} onClose={() => setModals({...modals, howToPlay: false})} t={t} />
            
            <MessageModal 
                isOpen={!!messageModal} 
                onClose={() => setMessageModal(null)} 
                title={messageModal?.title || ''} 
                message={messageModal?.message || ''} 
                card={messageModal?.card}
            />
            
            <CardOptionsModal 
                cardWithOptions={cardOptions} 
                onClose={() => setCardOptions(null)} 
                onListCard={(c) => setCardToList(c)}
                onQuickSell={handleQuickSell}
                onAddToFormation={handleAddToFormation}
                isFormationFull={Object.values(gameState.formation).every(c => c !== null)}
                t={t}
            />

            {packCard && (
                <PackAnimationModal 
                    card={packCard} 
                    onAnimationEnd={() => setPackCard(null)} 
                    playSfx={playSfx} 
                />
            )}

            {pendingPackCards.length > 0 && !packCard && (
                <PackResultsModal 
                    cards={pendingPackCards} 
                    onKeep={handleKeepCard} 
                    onSell={handleQuickSell}
                    onList={(c) => { handleKeepCard(c); setCardToList(c); }}
                    storage={gameState.storage}
                    t={t}
                />
            )}

            {gameState.activePlayerPick && (
                <PlayerPickModal
                    config={gameState.activePlayerPick}
                    onComplete={handlePlayerPickComplete}
                    storage={gameState.storage}
                    formation={gameState.formation}
                    t={t}
                    playSfx={playSfx}
                />
            )}

            {rankUpModalData && (
                <RankUpModal
                    isOpen={!!rankUpModalData}
                    onClose={() => setRankUpModalData(null)}
                    newRank={rankUpModalData.newRank}
                    rewards={rankUpModalData.rewards}
                    t={t}
                />
            )}

            {rewardModal.isOpen && (
                <RewardModal 
                    isOpen={rewardModal.isOpen} 
                    onClose={() => setRewardModal({ ...rewardModal, isOpen: false })} 
                    reward={rewardModal.reward} 
                    title={rewardModal.title}
                    t={t} 
                />
            )}

            <MarketModal 
                cardToList={cardToList} 
                onClose={() => setCardToList(null)} 
                onList={handleListCard} 
                t={t} 
            />
            
            <DuplicateSellModal 
                card={duplicateCard} 
                onSell={() => { handleQuickSell(duplicateCard!); }} 
                t={t} 
            />
        </div>
    );
};

export default App;
