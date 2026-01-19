
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    GameState, 
    Card as CardType, 
    PackType, 
    MarketCard, 
    User, 
    Settings, 
    GameView, 
    ObjectiveProgress, 
    Evolution,
    PlayerPickConfig,
    Rank
} from './types';
import { initialState } from './data/initialState';
import { packs, allCards, objectivesData, evoData, fbcData, playerPickConfigs, rankSystem } from './data/gameData';
import { sfx } from './data/sounds';
import { translations, TranslationKey } from './utils/translations';
import { playSound } from './utils/sound';
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
    deleteDoc 
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
import DealModal from './components/modals/DealModal';
import PackAnimationModal from './components/modals/PackAnimationModal';
import BuyModal from './components/modals/BuyModal';
import MarketModal from './components/modals/MarketModal';
import DuplicateSellModal from './components/modals/DuplicateSellModal';
import DailyRewardModal from './components/modals/DailyRewardModal';
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
    const [messageModal, setMessageModal] = useState<{title: string, message: string, card?: CardType} | null>(null);
    const [cardOptions, setCardOptions] = useState<{card: CardType, origin: 'formation' | 'storage'} | null>(null);
    const [cardToList, setCardToList] = useState<CardType | null>(null);
    const [packCard, setPackCard] = useState<CardType | null>(null); // For Animation
    const [pendingPackCards, setPendingPackCards] = useState<CardType[]>([]); // For Results
    const [duplicateCard, setDuplicateCard] = useState<CardType | null>(null);
    const [deal, setDeal] = useState<any>(null); // Placeholder for deal logic
    const [rankUpModalData, setRankUpModalData] = useState<{ newRank: Rank, rewards: { coins: number, packs: PackType[], picks: string[] } } | null>(null);
    const [rewardModal, setRewardModal] = useState<{ isOpen: boolean, reward: RewardData | null, title?: string }>({ isOpen: false, reward: null });

    // --- Helpers ---
    
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

    // Apply objective progress
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

    // Apply evolution task progress
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

    // Update Game State Wrapper
    const updateGameState = useCallback((updates: Partial<GameState>) => {
        setGameState(prev => {
            const newState = { ...prev, ...updates };
            if (currentUser && firebaseUser) {
                 const userRef = doc(db, 'users', firebaseUser.uid);
                 updateDoc(userRef, updates).catch(console.error);
            } else {
                 localStorage.setItem('guestGameState', JSON.stringify(newState));
            }
            return newState;
        });
    }, [currentUser, firebaseUser]);


    // --- Auth & Sync Effects ---

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setFirebaseUser(user);
            if (user) {
                const userRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(userRef);
                
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    setCurrentUser(userData.userProfile as User);
                    // Merge remote state with safe defaults
                    setGameState(prev => ({ ...initialState, ...userData, userId: user.uid, market: prev.market }));
                } else {
                    // New user setup
                    const newProfile: User = { username: user.email?.split('@')[0] || 'User', email: user.email || '' };
                    setCurrentUser(newProfile);
                    const newState = { ...initialState, userId: user.uid, userProfile: newProfile };
                    await setDoc(userRef, newState);
                    setGameState(prev => ({ ...newState, market: prev.market }));
                }
            } else {
                setCurrentUser(null);
                const savedGuest = localStorage.getItem('guestGameState');
                if (savedGuest) {
                    try {
                        setGameState({ ...initialState, ...JSON.parse(savedGuest) });
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

    // Sync Market
    useEffect(() => {
        const q = query(collection(db, 'market'), orderBy('createdAt', 'desc'), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const marketData: MarketCard[] = [];
            snapshot.forEach((doc) => {
                marketData.push({ ...doc.data() as MarketCard, marketId: doc.id });
            });
            setGameState(prev => ({ ...prev, market: marketData }));
        });
        return () => unsubscribe();
    }, []);

    // --- Daily Reset & Login Objective ---
    useEffect(() => {
        const checkDailyObjectives = () => {
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            let lastReset = gameState.lastDailyReset;
            let currentProgress = { ...gameState.objectiveProgress };
            let currentCompletedFbcs = [...gameState.completedFbcIds];
            let stateChanged = false;

            // 1. Check Reset
            if (!lastReset || (now - lastReset > oneDay)) {
                // Clear daily objectives
                objectivesData.filter(o => o.type === 'daily').forEach(o => {
                    if (currentProgress[o.id]) {
                        delete currentProgress[o.id];
                    }
                });
                
                // Clear daily FBCs
                const dailyFbcIds = fbcData.filter(f => f.repeatable === 'daily').map(f => f.id);
                currentCompletedFbcs = currentCompletedFbcs.filter(id => !dailyFbcIds.includes(id));

                lastReset = now;
                stateChanged = true;
            }

            // 2. Mark Login Objective
            const loginObjId = 'd_login'; 
            const taskId = 'daily_login_task';
            const loginProgress = currentProgress[loginObjId]?.tasks[taskId] || 0;

            if (loginProgress < 1) {
                if (!currentProgress[loginObjId]) {
                    currentProgress[loginObjId] = { tasks: {}, claimed: false };
                }
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

    // --- Objectives: Track Formation Changes (Ra3 Objective) ---
    useEffect(() => {
        const goldCount = Object.values(gameState.formation).filter(c => c && c.rarity === 'gold').length;
        const objId = 'milestone_a_step_ahead';
        const taskId = 'formation_11_gold';
        
        // Get current status to avoid infinite loops
        const currentProgress = gameState.objectiveProgress[objId]?.tasks[taskId] || 0;
        
        // If condition met and not yet recorded as complete (target is 1)
        if (goldCount >= 11 && currentProgress < 1) {
             const newObjectiveProgress = applyObjectiveProgress(gameState.objectiveProgress, taskId, 1);
             // Only update if it actually changes something
             updateGameState({ objectiveProgress: newObjectiveProgress });
        }
    }, [gameState.formation, gameState.objectiveProgress, applyObjectiveProgress, updateGameState]);


    // --- Logic & Handlers ---

    const handleOpenPack = useCallback((packType: PackType, options: { isReward?: boolean, bypassLimit?: boolean, fromInventory?: boolean, currency?: 'coins' | 'bp' } = {}) => {
        const { isReward = false, bypassLimit = false, fromInventory = false, currency = 'coins' } = options;
        playSfx('packBuildup');
        const pack = packs[packType];
        
        // --- Weighting Logic ---
        const getCardWeight = (card: CardType) => {
            if (card.rarity === 'gold') return card.ovr < 87 ? 100 : 3; 
            if (card.rarity === 'rotm') return card.ovr <= 90 ? 50 : 1;
            if (card.rarity === 'icon') return card.ovr <= 91 ? 50 : 1;
            return 20;
        };

        const selectWeightedCard = (candidates: CardType[]): CardType => {
            const totalWeight = candidates.reduce((sum, c) => sum + getCardWeight(c), 0);
            let random = Math.random() * totalWeight;
            for (const card of candidates) {
                random -= getCardWeight(card);
                if (random < 0) return card;
            }
            return candidates[0];
        };
        
        const newCards: CardType[] = [];
        const pickedTemplateIds = new Set<string>();

        for (let i = 0; i < 3; i++) {
            let foundCard: CardType | null = null;
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
            const newCard = { ...foundCard } as CardType;
            newCard.id = `${newCard.id}-${Date.now()}-${Math.floor(Math.random() * 100000)}-${i}`;
            newCards.push(newCard);
        }

        newCards.sort((a, b) => b.ovr - a.ovr);
        const bestCard = newCards[0];

        // Cost check if not a reward and not from inventory
        if (!isReward && !fromInventory && !isDevMode) {
            if (currency === 'coins' && pack.cost > gameState.coins) {
                setMessageModal({ title: 'Not Enough Coins', message: `You need ${pack.cost} coins to open this pack.` });
                return;
            }
            if (currency === 'bp' && pack.bpCost > (gameState.battlePoints || 0)) {
                setMessageModal({ title: 'Not Enough BP', message: `You need ${pack.bpCost} Battle Points to open this pack.` });
                return;
            }
        }
        
        let stateUpdates: Partial<GameState> = {};
        
        // Handling Free Pack Limits
        if (packType === 'free' && !bypassLimit && !fromInventory) {
            const twelveHours = 12 * 60 * 60 * 1000;
            const now = Date.now();
            let { freePacksOpenedToday, lastFreePackResetTime } = gameState;
            if (lastFreePackResetTime && (now - lastFreePackResetTime > twelveHours)) {
                freePacksOpenedToday = 0;
                lastFreePackResetTime = now;
            } else if (!lastFreePackResetTime) lastFreePackResetTime = now;
            
            if (freePacksOpenedToday >= 3 && !isDevMode) {
                setMessageModal({ title: 'Limit Reached', message: 'You have opened all your free packs for now. Come back later!' });
                return;
            }
            stateUpdates.freePacksOpenedToday = freePacksOpenedToday + 1;
            stateUpdates.lastFreePackResetTime = lastFreePackResetTime;
            stateUpdates.objectiveProgress = applyObjectiveProgress(gameState.objectiveProgress, 'open_free_packs', 1);

        } else if (!isReward && !fromInventory) {
            // Deduct Currency
            if (currency === 'coins') {
                stateUpdates.coins = gameState.coins - pack.cost;
            } else {
                stateUpdates.battlePoints = (gameState.battlePoints || 0) - pack.bpCost;
            }
            
            // Apply Objectives logic for purchased packs
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

        // Inventory Removal
        if (fromInventory) {
            const packIndex = gameState.ownedPacks.indexOf(packType);
            if (packIndex > -1) {
                const newOwned = [...gameState.ownedPacks];
                newOwned.splice(packIndex, 1);
                stateUpdates.ownedPacks = newOwned;
            }
        }

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
        // Find pick in inventory and remove one instance
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

    const handleKeepCard = (card: CardType) => {
        // Strict duplicate checking by card Name
        const alreadyInStorage = gameState.storage.some(c => c.name === card.name);
        const alreadyInFormation = Object.values(gameState.formation).some(c => c?.name === card.name);
        
        if (alreadyInStorage || alreadyInFormation) {
            setDuplicateCard(card);
            setPendingPackCards(prev => prev.filter(c => c.id !== card.id));
            return;
        }

        updateGameState({ storage: [...gameState.storage, card] });
        setPendingPackCards(prev => prev.filter(c => c.id !== card.id));
    };

    const handleQuickSell = (card: CardType) => {
        playSfx('purchase');
        const value = calculateQuickSellValue(card);
        const updates: Partial<GameState> = { coins: gameState.coins + value };
        
        if (card.rarity === 'gold') {
             updates.activeEvolution = applyEvolutionTask(gameState.activeEvolution, 'quicksell_gold_card', 1);
        }

        updateGameState(updates);
        
        if (pendingPackCards.find(c => c.id === card.id)) {
            setPendingPackCards(prev => prev.filter(c => c.id !== card.id));
        } else if (gameState.storage.find(c => c.id === card.id)) {
            updateGameState({ storage: gameState.storage.filter(c => c.id !== card.id) });
        } else if (duplicateCard?.id === card.id) {
            setDuplicateCard(null);
        }
        
        if (cardOptions?.card.id === card.id) setCardOptions(null);
    };

    const handleListCard = (card: CardType, price: number) => {
        if (!firebaseUser) {
            setMessageModal({ title: 'Login Required', message: 'You must be logged in to use the market.' });
            return;
        }
        
        addDoc(collection(db, 'market'), {
            ...card,
            price,
            sellerId: firebaseUser.uid,
            createdAt: Date.now()
        }).then(() => {
            const newStorage = gameState.storage.filter(c => c.id !== card.id);
            const newObjectives = applyObjectiveProgress(gameState.objectiveProgress, 'list_market_cards', 1);
            const newEvo = applyEvolutionTask(gameState.activeEvolution, 'list_cards_market', 1);
            
            updateGameState({ 
                storage: newStorage,
                objectiveProgress: newObjectives,
                activeEvolution: newEvo
            });
            setCardToList(null);
            if (pendingPackCards.find(c => c.id === card.id)) {
                setPendingPackCards(prev => prev.filter(c => c.id !== card.id));
            }
        });
    };

    const handleBuyCard = (marketCard: MarketCard) => {
        if (gameState.coins < marketCard.price) {
             setMessageModal({ title: 'Insufficient Funds', message: 'You do not have enough coins.' });
             return;
        }
        
        // Optimistic check for duplicates before buying
        const alreadyInStorage = gameState.storage.some(c => c.name === marketCard.name);
        const alreadyInFormation = Object.values(gameState.formation).some(c => c?.name === marketCard.name);
        
        if (alreadyInStorage || alreadyInFormation) {
             setMessageModal({ title: 'Duplicate Found', message: `You already own ${marketCard.name}.` });
             return;
        }
        
        const cardRef = doc(db, 'market', marketCard.marketId!);
        deleteDoc(cardRef).then(() => {
             playSfx('purchase');
             const { marketId, sellerId, price, createdAt, ...cardData } = marketCard;
             const newCard = { ...cardData, id: `${cardData.id}-${Date.now()}` };
             updateGameState({
                 coins: gameState.coins - marketCard.price,
                 storage: [...gameState.storage, newCard]
             });
             setMessageModal({ title: 'Success', message: `You bought ${marketCard.name}!` });
        }).catch(() => {
             setMessageModal({ title: 'Error', message: 'This card is no longer available.' });
        });
    };

    const handleCancelListing = (marketCard: MarketCard) => {
         const cardRef = doc(db, 'market', marketCard.marketId!);
         deleteDoc(cardRef).then(() => {
             const { marketId, sellerId, price, createdAt, ...cardData } = marketCard;
             updateGameState({ storage: [...gameState.storage, cardData] });
         });
    };

    const handleAddToFormation = (card: CardType) => {
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
    
    // XP, Rank, and Rewards Logic
    const handleBattleResult = (amount: number, isWin: boolean, mode: 'ranked' | 'challenge', squad: CardType[]) => {
        setGameState(prev => {
            let newState = { ...prev };
            
            // 1. Update BP & XP
            const xpGain = isWin ? 150 : 25;
            
            newState.battlePoints = (prev.battlePoints || 0) + amount;
            newState.xp = (prev.xp || 0) + xpGain;

            // Update Objectives for Battles
            let newObjProgress = applyObjectiveProgress(newState.objectiveProgress, 'play_any_battle', 1);
            if (mode === 'challenge') {
                newObjProgress = applyObjectiveProgress(newObjProgress, 'play_challenge_battle', 1);
                if (isWin) {
                    newObjProgress = applyObjectiveProgress(newObjProgress, 'win_challenge_battle', 1);
                }
            } else if (mode === 'ranked' && isWin) {
                // New logic: Win 5 Ranked Games for Milestone
                newObjProgress = applyObjectiveProgress(newObjProgress, 'win_ranked_games', 1);
            }
            newState.objectiveProgress = newObjProgress;

            // New logic: Evo Task - Play with Abo El Anwar
            if (squad.some(c => c.name === 'Abo El Anwar' && c.rarity === 'gold')) {
                newState.activeEvolution = applyEvolutionTask(newState.activeEvolution, 'play_battle_abo', 1);
            }

            // 2. Rank Progression (Only for Ranked Mode & Win)
            if (isWin && mode === 'ranked') {
                const currentRank = prev.rank || 'Bronze';
                const rankConfig = rankSystem[currentRank];
                
                // Increment wins for current rank
                let newRankWins = (prev.rankWins || 0) + 1;
                
                // Check Promotion/Reward Logic
                let promoted = false;
                let nextRank: Rank = currentRank;
                
                // Legend Loop Logic (Every 5 wins)
                if (currentRank === 'Legend') {
                    if (newRankWins >= rankConfig.winsToPromote) {
                        newRankWins = 0; // Reset loop
                        
                        // Distribute Legend Rewards
                        const rewards = rankConfig.promotionReward;
                        newState.coins += rewards.coins;
                        newState.ownedPacks = [...newState.ownedPacks, ...rewards.packs];
                        
                        // Add Picks
                        const newPicks = rewards.picks.map(id => playerPickConfigs[id]).filter(Boolean);
                        newState.ownedPlayerPicks = [...newState.ownedPlayerPicks, ...newPicks];
                        
                        setRankUpModalData({ newRank: 'Legend', rewards });
                        playSfx('success');
                    }
                } 
                // Normal Rank Progression
                else if (newRankWins >= rankConfig.winsToPromote) {
                    if (currentRank === 'Bronze') nextRank = 'Silver';
                    else if (currentRank === 'Silver') nextRank = 'Gold';
                    else if (currentRank === 'Gold') nextRank = 'Legend';
                    
                    newRankWins = 0; // Reset for next rank
                    promoted = true;
                    
                    // Distribute Promotion Rewards
                    const rewards = rankConfig.promotionReward;
                    newState.coins += rewards.coins;
                    newState.ownedPacks = [...newState.ownedPacks, ...rewards.packs];
                    const newPicks = rewards.picks.map(id => playerPickConfigs[id]).filter(Boolean);
                    newState.ownedPlayerPicks = [...newState.ownedPlayerPicks, ...newPicks];

                    setRankUpModalData({ newRank: nextRank, rewards });
                    playSfx('success');
                }

                newState.rank = nextRank;
                newState.rankWins = newRankWins;
            }

            // Sync to Firebase if user logged in
            if (currentUser && firebaseUser) {
                 const userRef = doc(db, 'users', firebaseUser.uid);
                 updateDoc(userRef, { 
                     battlePoints: newState.battlePoints,
                     xp: newState.xp,
                     rank: newState.rank,
                     rankWins: newState.rankWins,
                     coins: newState.coins,
                     ownedPacks: newState.ownedPacks,
                     ownedPlayerPicks: newState.ownedPlayerPicks,
                     objectiveProgress: newState.objectiveProgress,
                     activeEvolution: newState.activeEvolution
                 }).catch(console.error);
            } else {
                 localStorage.setItem('guestGameState', JSON.stringify(newState));
            }
            return newState;
        });
    };
    
    // FBC Submit
    const handleFbcSubmit = (challengeId: string, submittedCards: CardType[]) => {
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

        // Give Reward - Store in inventory
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

        // Show Modal
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

    // Evo Logic
    const handleStartEvo = (evoId: string, cardId: string) => {
        updateGameState({
            activeEvolution: {
                evoId,
                cardId,
                tasks: {}
            }
        });
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

            // Show Modal
            setRewardModal({
                isOpen: true,
                reward: { type: 'card', cardId: resultCard.id },
                title: "Evolution Completed!"
            });
        }
    };
    
    // Objective Claim
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
        
        // Add Rewards to Inventory
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
            // New Mixed Reward Type
            if (obj.reward.amount) {
                updates.coins = gameState.coins + obj.reward.amount;
            }
            if (obj.reward.playerPickId) {
                const pickConfig = playerPickConfigs[obj.reward.playerPickId];
                if (pickConfig) {
                    updates.ownedPlayerPicks = [...gameState.ownedPlayerPicks, pickConfig];
                }
            }
        }
        
        updateGameState(updates);
        playSfx('rewardClaimed');

        // Show Modal
        setRewardModal({
            isOpen: true,
            reward: obj.reward,
            title: t('completed') + ": " + t(obj.titleKey as TranslationKey)
        });
    };

    const handlePlayerPickComplete = (selectedCards: CardType[]) => {
        const newCards: CardType[] = [];
        selectedCards.forEach(card => {
            const uniqueCard = { ...card, id: `${card.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`};
            newCards.push(uniqueCard);
        });

        // Instead of adding directly to storage, route through the PackResults flow to decide fate (Keep/Sell/List)
        setPendingPackCards(newCards);
        
        updateGameState({
            activePlayerPick: null // Close selection modal
        });
        playSfx('purchase');
    };

    // --- Render ---

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
            <Particles />
            
            {showIntro && <IntroVideo onSkip={() => setShowIntro(false)} />}
            {showWelcome && !showIntro && <WelcomeScreen onStart={() => { setShowWelcome(false); setShowIntro(true); playSfx('buttonClick'); }} />}
            
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
                            {view === 'battle' && <Battle gameState={gameState} onBattleWin={handleBattleResult} t={t} playSfx={playSfx} />}
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

            {/* Player Pick Modal */}
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

            {/* Rank Up Rewards Modal */}
            {rankUpModalData && (
                <RankUpModal
                    isOpen={!!rankUpModalData}
                    onClose={() => setRankUpModalData(null)}
                    newRank={rankUpModalData.newRank}
                    rewards={rankUpModalData.rewards}
                    t={t}
                />
            )}

            {/* Generic Reward Modal */}
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
