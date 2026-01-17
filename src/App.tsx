
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, Card as CardType, GameView, PackType, MarketCard, FormationLayoutId, User, CurrentUser, Objective } from './types';
import { initialState } from './data/initialState';
import { allCards, packs, fbcData, evoData, formationLayouts, objectivesData } from './data/gameData';
import { translations, TranslationKey } from './utils/translations';
import { useSettings } from './hooks/useSettings';
import { calculateQuickSellValue } from './utils/cardUtils';
import { playSound } from './utils/sound';
import { sfx, getRevealSfxKey } from './data/sounds';

// Firebase Imports
import { auth, db } from './firebaseConfig';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    updateProfile 
} from 'firebase/auth';
import { 
    doc, 
    setDoc, 
    getDoc, 
    onSnapshot, 
    collection, 
    addDoc, 
    deleteDoc, 
    runTransaction,
    query,
    orderBy,
    limit,
    where
} from 'firebase/firestore';

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

// --- HELPER FUNCTIONS ---

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

const App: React.FC = () => {
    // App Flow State
    const [appState, setAppState] = useState<'welcome' | 'intro' | 'game'>('welcome');
    
    // Game & Auth State
    const [gameState, setGameState] = useState<GameState>(initialState);
    const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
    const [currentView, setCurrentView] = useState<GameView>('store');
    const [isDevMode, setIsDevMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Track signup process to prevent race conditions
    const isSigningUp = useRef(false);

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

    // --- FIREBASE INTEGRATION ---

    // 1. Auth Listener & User Data Fetching
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in
                setCurrentUser({
                    username: user.displayName || 'Player',
                    email: user.email || '',
                    avatar: user.photoURL || undefined
                });

                // Set up real-time listener for user's game state
                const userDocRef = doc(db, 'users', user.uid);
                const unsubUserData = onSnapshot(userDocRef, (docSnap) => {
                    // CRITICAL: Check if we are currently in the middle of a signup.
                    // If we are, do NOT touch state or create docs here, let handleSignUp finish its job.
                    if (isSigningUp.current) return;

                    if (docSnap.exists()) {
                        const data = docSnap.data() as GameState;
                        // Update local state, merging with existing to prevent overwriting 'market' which comes from another listener
                        setGameState(prev => ({ 
                            ...prev, 
                            ...data,
                            market: prev.market 
                        }));
                    } else {
                        // Document doesn't exist.
                        // ONLY create a default one if we are NOT signing up.
                        if (!isSigningUp.current) {
                             const newUserState = { ...initialState, userId: user.uid };
                             const { market, ...stateToSave } = newUserState;
                             setDoc(userDocRef, stateToSave, { merge: true });
                             setGameState(newUserState);
                        }
                    }
                });

                return () => unsubUserData();
            } else {
                // User is signed out, use Guest State
                setCurrentUser(null);
                setGameState(initialState);
            }
        });

        return () => unsubscribe();
    }, [playSfx]);

    // 2. Sales Listener (Incoming Earnings)
    useEffect(() => {
        if (!auth.currentUser) return;
        
        const q = query(collection(db, 'sales'), where('sellerId', '==', auth.currentUser.uid));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (snapshot.empty) return;

            // We found new sales!
            let totalEarned = 0;
            const salesToDelete: string[] = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                totalEarned += (Number(data.amount) || 0);
                salesToDelete.push(doc.id);
            });

            if (totalEarned > 0) {
                try {
                    // Claim these sales in a transaction to prevent duplicates
                    await runTransaction(db, async (transaction) => {
                        const userRef = doc(db, 'users', auth.currentUser!.uid);
                        const userDoc = await transaction.get(userRef);
                        if (!userDoc.exists()) return;

                        const currentCoins = Number(userDoc.data().coins) || 0;
                        
                        // Delete the sales records so they aren't processed again
                        salesToDelete.forEach(id => {
                            transaction.delete(doc(db, 'sales', id));
                        });
                        
                        // Update user balance
                        transaction.update(userRef, { coins: currentCoins + totalEarned });
                    });

                    // Notify User
                    playSfx('rewardClaimed');
                    setMessageModal({
                        title: 'Market Sale!',
                        message: `You sold cards for ${totalEarned} coins!`
                    });

                } catch (e) {
                    console.error("Error claiming sales:", e);
                }
            }
        });

        return () => unsubscribe();
    }, [currentUser, playSfx]); // Depend on currentUser to reset listener on login/logout

    // 3. Market Listener (Real-time Global Market)
    useEffect(() => {
        const q = query(collection(db, 'market'), orderBy('createdAt', 'desc'), limit(100)); 
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const marketCards: MarketCard[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as MarketCard;
                marketCards.push({ ...data, marketId: doc.id });
            });
            setGameState(prev => ({ ...prev, market: marketCards }));
        }, (error) => {
            console.error("Market listener error:", error);
            if (error.code === 'failed-precondition') {
                 const fallbackQ = query(collection(db, 'market'), limit(100));
                 onSnapshot(fallbackQ, (snap) => {
                    const cards: MarketCard[] = [];
                    snap.forEach((d) => cards.push({ ...d.data() as MarketCard, marketId: d.id }));
                    setGameState(p => ({ ...p, market: cards }));
                 });
            }
        });

        return () => unsubscribe();
    }, []);

    // 4. Helper to save state to Firebase
    const saveToFirebase = useCallback(async (newState: GameState) => {
        if (auth.currentUser && !isSigningUp.current) {
            try {
                const userDocRef = doc(db, 'users', auth.currentUser.uid);
                const { market, ...stateToSave } = newState; 
                await setDoc(userDocRef, stateToSave, { merge: true });
            } catch (e) {
                console.error("Error saving state:", e);
            }
        }
    }, []);

    const updateGameState = (updates: Partial<GameState>) => {
        setGameState(prevState => {
            const newState = { ...prevState, ...updates };
            saveToFirebase(newState);
            return newState;
        });
    };

    // --- OTHER EFFECTS ---
    useEffect(() => { document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
    
    // Music
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


    // --- AUTH ACTIONS ---

    const handleSignUp = async (user: User) => {
        if (!user.email || !user.password) return;
        setIsLoading(true);
        isSigningUp.current = true; // LOCK listeners

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
            await updateProfile(userCredential.user, {
                displayName: user.username,
                photoURL: user.avatar
            });
            
            // Create initial DB entry using CURRENT GUEST STATE
            const { market, ...currentLocalState } = gameState;
            const newUserState = { ...currentLocalState, userId: userCredential.user.uid };
            
            await setDoc(doc(db, 'users', userCredential.user.uid), newUserState);
            setGameState(prev => ({ ...prev, userId: userCredential.user.uid }));

            setIsSignUpModalOpen(false);
            setAuthError(null);
        } catch (error: any) {
            setAuthError(error.message || "Failed to sign up");
        } finally {
            isSigningUp.current = false; // UNLOCK listeners
            setIsLoading(false);
        }
    };

    const handleLogin = async (user: User) => {
        if (!user.username || !user.password) return; 
        
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, user.username, user.password);
            setIsLoginModalOpen(false);
            setAuthError(null);
        } catch (error: any) {
            setAuthError("Login failed. Please check your email and password.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleLogout = async () => {
        try {
            await signOut(auth);
            setGameState(initialState);
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const handleToggleDevMode = () => { setIsDevMode(prev => !prev); };

    // --- GAMEPLAY LOGIC ---

    // Effect for state-based evolution tasks
    useEffect(() => {
        const { activeEvolution } = gameState;
        if (!activeEvolution) return;
    
        const evoDef = evoData.find(e => e.id === activeEvolution.evoId);
        if (!evoDef || evoDef.id !== 'tommy_gun_upgrade') return;
        
        let newActiveEvo = { ...activeEvolution };
        let changed = false;
        
        const evolvingCardInFormation = Object.values(gameState.formation).some((c: CardType | null) => c?.id === activeEvolution.cardId);

        const task1Id = 'tommy_gun_in_formation';
        if (evolvingCardInFormation && (newActiveEvo.tasks[task1Id] || 0) < 1) {
            newActiveEvo = applyEvolutionTask(newActiveEvo, task1Id, 1)!;
            changed = true;
        }

        const task2Id = 'formation_rating_82';
        if (evolvingCardInFormation && (newActiveEvo.tasks[task2Id] || 0) < 1) {
            const formationCards = Object.values(gameState.formation).filter((c): c is CardType => !!c);
            if (formationCards.length > 0) {
                const totalOvr = formationCards.reduce((sum, card) => sum + card.ovr, 0);
                const formationRating = Math.round(totalOvr / formationCards.length);
                if (formationRating >= 82) {
                    newActiveEvo = applyEvolutionTask(newActiveEvo, task2Id, 1)!;
                    changed = true;
                }
            }
        }
        
        if (changed) {
            updateGameState({ activeEvolution: newActiveEvo });
        }
    }, [gameState.formation]);

    // Effect for objectives
    useEffect(() => {
        const goldCardsInFormation = Object.values(gameState.formation).filter((c): c is CardType => !!c && (c as CardType).rarity === 'gold').length;
        const requiredGoldCards = 11;
        
        const objective = objectivesData.find(o => o.tasks.some(t => t.id === 'formation_11_gold'));
        if (!objective) return;
        
        const currentProgress = gameState.objectiveProgress[objective.id]?.tasks['formation_11_gold'] || 0;
        const newProgressValue = goldCardsInFormation >= requiredGoldCards ? 1 : 0;
        
        if (currentProgress !== newProgressValue) {
            updateGameState({
                objectiveProgress: applyObjectiveProgress(gameState.objectiveProgress, 'formation_11_gold', newProgressValue, 'set')
            });
        }
    }, [gameState.formation]);
    
    const handleOpenPack = useCallback((packType: PackType, isReward = false, bypassLimit = false) => {
        playSfx('packBuildup');
        const pack = packs[packType];
        
        // ... (Card generation logic) ...
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
        newCard.id = `${newCard.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        if (!isReward && pack.cost > gameState.coins && !isDevMode) {
            setMessageModal({ title: 'Not Enough Coins', message: `You need ${pack.cost} coins to open this pack.` });
            return;
        }
        
        let stateUpdates: Partial<GameState> = {};
        
        if (packType === 'free' && !bypassLimit) {
            const twelveHours = 12 * 60 * 60 * 1000;
            const now = Date.now();
            let { freePacksOpenedToday, lastFreePackResetTime } = gameState;
            if (lastFreePackResetTime && (now - lastFreePackResetTime > twelveHours)) {
                freePacksOpenedToday = 0;
                lastFreePackResetTime = now;
            } else if (!lastFreePackResetTime) {
                lastFreePackResetTime = now;
            }
            if (freePacksOpenedToday >= 3 && !isDevMode) {
                setMessageModal({ title: 'Limit Reached', message: 'You have opened all your free packs for now. Come back later!' });
                return;
            }
            stateUpdates.freePacksOpenedToday = freePacksOpenedToday + 1;
            stateUpdates.lastFreePackResetTime = lastFreePackResetTime;
            stateUpdates.objectiveProgress = applyObjectiveProgress(gameState.objectiveProgress, 'open_free_packs', 1);

        } else if (!isReward) {
            stateUpdates.coins = gameState.coins - pack.cost;
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

        if (settings.animationsOn) {
            setPackCard(newCard);
            updateGameState(stateUpdates);
        } else {
            const isDuplicate = gameState.storage.some(card => card.name === newCard.name);
            if (isDuplicate) {
                setDuplicateToSell(newCard);
                updateGameState(stateUpdates);
            } else {
                stateUpdates.storage = [...gameState.storage, newCard];
                updateGameState(stateUpdates);
                setMessageModal({ title: 'New Card!', message: `You packed ${newCard.name}!`, card: newCard });
            }
        }
    }, [gameState, isDevMode, settings.animationsOn, playSfx]);


    const handlePackAnimationEnd = (card: CardType) => {
        setPackCard(null);
        const isDuplicate = gameState.storage.some(c => c.name === card.name);
        if (isDuplicate) {
            setDuplicateToSell(card);
        } else {
            updateGameState({ storage: [...gameState.storage, card] });
            setMessageModal({ title: `You got ${card.name}!`, message: `A new ${card.rarity} card has been added to your storage.`, card });
        }
    };
    
    const handleQuickSellDuplicate = () => {
        if (duplicateToSell) {
          const quickSellValue = calculateQuickSellValue(duplicateToSell);
          updateGameState({ coins: gameState.coins + quickSellValue });
          setMessageModal({ title: 'Card Sold', message: `You received ${quickSellValue} coins for the duplicate ${duplicateToSell.name}.` });
          setDuplicateToSell(null);
        }
    };
    
    // --- FIRESTORE TRANSACTION: BUY CARD ---
    const handleBuyCard = async (card: MarketCard) => {
        if (!auth.currentUser || !card.marketId) {
            setMessageModal({ title: 'Account Required', message: 'You must be logged in to buy cards.' });
            return;
        }

        const price = Number(card.price);
        if (gameState.coins < price) {
            setMessageModal({ title: 'Not Enough Coins', message: `You need ${price} coins to buy this card.` });
            return;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const marketRef = doc(db, 'market', card.marketId!);
                const buyerRef = doc(db, 'users', auth.currentUser!.uid);
                
                // 1. ALL READS FIRST
                const marketDoc = await transaction.get(marketRef);
                if (!marketDoc.exists()) throw "Card has already been sold.";

                const buyerDoc = await transaction.get(buyerRef);
                if (!buyerDoc.exists()) throw "Your user profile is missing from the server. Please try logging out and back in.";

                // 2. LOGIC CHECKS
                const buyerData = buyerDoc.data() as GameState;
                const currentCoins = Number(buyerData.coins);
                
                if (isNaN(currentCoins)) throw "Error reading your coin balance. Please refresh.";
                if (currentCoins < price) throw `Insufficient funds. Server says you have ${currentCoins}, but card costs ${price}.`;

                const newCoins = currentCoins - price;
                const newStorage = [...(buyerData.storage || []), card];

                // 3. ALL WRITES LAST
                
                // Update Buyer
                transaction.update(buyerRef, { coins: newCoins, storage: newStorage });
                
                // Remove Listing from Market
                transaction.delete(marketRef);

                // Create Sale Record for Seller (to claim earnings later)
                // We create a new doc in 'sales' collection instead of writing to seller's user doc
                if (card.sellerId && card.sellerId !== 'guest') {
                    const newSaleRef = doc(collection(db, 'sales'));
                    transaction.set(newSaleRef, {
                        sellerId: card.sellerId,
                        amount: price,
                        cardName: card.name,
                        buyerId: auth.currentUser!.uid,
                        timestamp: Date.now()
                    });
                }
            });

            playSfx('purchase');
            setMessageModal({ title: 'Purchase Successful', message: `You bought ${card.name} for ${price} coins.`, card });

        } catch (e: any) {
            console.error("Buy error:", e);
            const msg = typeof e === 'string' ? e : e.message || 'Could not complete purchase.';
            setMessageModal({ title: 'Transaction Failed', message: msg });
        }
    };

    // --- FIRESTORE TRANSACTION: CANCEL LISTING ---
    const handleCancelListing = async (card: MarketCard) => {
        if (!auth.currentUser || !card.marketId) return;

        try {
            await runTransaction(db, async (transaction) => {
                const marketRef = doc(db, 'market', card.marketId!);
                const userRef = doc(db, 'users', auth.currentUser!.uid);

                // 1. READS
                const marketDoc = await transaction.get(marketRef);
                if (!marketDoc.exists()) throw "Listing not found.";
                if (marketDoc.data().sellerId !== auth.currentUser!.uid) throw "You can only cancel your own listings.";

                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw "User profile not found.";

                // 2. LOGIC
                const userData = userDoc.data() as GameState;
                const newStorage = [...(userData.storage || []), card];

                // 3. WRITES
                transaction.delete(marketRef);
                transaction.update(userRef, { storage: newStorage });
            });

            setMessageModal({ title: 'Listing Cancelled', message: `${card.name} has been returned to your storage.` });

        } catch (e: any) {
            console.error("Cancel error:", e);
            setMessageModal({ title: 'Error', message: e.message || "Failed to cancel listing." });
        }
    };

    // --- FIRESTORE: LIST CARD ---
    const handleListCard = async (card: CardType, price: number) => {
        if (!auth.currentUser) {
            setMessageModal({ title: 'Account Required', message: 'You must Sign Up or Log In to list items on the live market.' });
            return;
        }

        const newMarketCard: MarketCard = { 
            ...card, 
            price: Number(price), // Ensure price is a number
            sellerId: auth.currentUser.uid,
            createdAt: Date.now()
        };
        
        // Optimistically remove from local state
        const { formation, storage } = gameState;
        const formationPos = Object.keys(formation).find(pos => formation[pos]?.id === card.id);
        let newFormation = { ...formation };
        let newStorage = [...storage];

        if (formationPos) {
            newFormation[formationPos] = null;
        } else {
            newStorage = storage.filter((c: CardType) => c.id !== card.id);
        }

        updateGameState({
            formation: newFormation,
            storage: newStorage,
            objectiveProgress: applyObjectiveProgress(gameState.objectiveProgress, 'list_market_cards', 1),
            activeEvolution: applyEvolutionTask(gameState.activeEvolution, 'list_cards_market', 1)
        });

        try {
            await addDoc(collection(db, 'market'), newMarketCard);
            setCardToList(null);
            setMessageModal({ title: 'Card Listed', message: `${card.name} has been listed on the market for ${price} coins.` });
        } catch (e) {
            console.error("Error listing card:", e);
            setMessageModal({ title: 'Error', message: 'Failed to list card on server.' });
        }
    };
    
    const handleQuickSell = (cardToSell: CardType) => {
        const quickSellValue = calculateQuickSellValue(cardToSell);
        
        const { formation, storage } = gameState;
        const formationPos = Object.keys(formation).find(pos => formation[pos]?.id === cardToSell.id);
        
        let newFormation = { ...formation };
        let newStorage = [...storage];
        let newActiveEvolution = gameState.activeEvolution;

        if (formationPos) {
            newFormation[formationPos] = null;
        } else {
            newStorage = storage.filter((c: CardType) => c.id !== cardToSell.id);
        }
        
        if (cardToSell.rarity === 'gold') {
            newActiveEvolution = applyEvolutionTask(gameState.activeEvolution, 'quicksell_gold_card', 1);
        }

        updateGameState({
            formation: newFormation,
            storage: newStorage,
            coins: gameState.coins + quickSellValue,
            activeEvolution: newActiveEvolution
        });
        
        setCardWithOptions(null);
        setMessageModal({ title: 'Card Sold', message: `You quick sold ${cardToSell.name} for ${quickSellValue} coins.` });
    };
    

    const handleFbcSubmit = (challengeId: string, submittedCards: CardType[]) => {
        const challenge = fbcData.find(c => c.id === challengeId);
        if (!challenge) return;

        let newFormation = { ...gameState.formation };
        let newStorage = [...gameState.storage];
        const submittedIds = new Set(submittedCards.map(c => c.id));

        for (const pos in newFormation) {
            if (newFormation[pos] && submittedIds.has(newFormation[pos]!.id)) {
                newFormation[pos] = null;
            }
        }
        newStorage = newStorage.filter((c: CardType) => !submittedIds.has(c.id));

        let rewardCard: CardType | null = null;
        if (challenge.reward.type === 'card' && challenge.reward.cardId) {
            const template = allCards.find(c => c.id === challenge.reward.cardId);
            if (template) {
                rewardCard = { ...template, id: `${template.id}-${Date.now()}` };
                newStorage.push(rewardCard);
            }
        }
        
        updateGameState({
            formation: newFormation,
            storage: newStorage,
            completedFbcIds: [...gameState.completedFbcIds, challengeId],
            objectiveProgress: applyObjectiveProgress(gameState.objectiveProgress, 'complete_fbcs', 1)
        });

        if (rewardCard) {
             setMessageModal({
                title: 'Challenge Complete!',
                message: `You earned ${rewardCard.name}!`,
                card: rewardCard
            });
        }

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
        
        if (!gameState.activeEvolution) return;
        const evoDef = evoData.find(e => e.id === gameState.activeEvolution!.evoId);
        const resultCardTemplate = allCards.find(c => c.id === evoDef?.resultCardId);
        if (!evoDef || !resultCardTemplate) return;

        const originalCardId = gameState.activeEvolution!.cardId;
        const resultCard = { ...resultCardTemplate, id: `${resultCardTemplate.id}-${Date.now()}` };

        let newFormation = { ...gameState.formation };
        let newStorage = gameState.storage.filter((c: CardType) => c.id !== originalCardId);
        const formationPos = Object.keys(gameState.formation).find(pos => gameState.formation[pos]?.id === originalCardId);
        
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

        updateGameState({
            activeEvolution: null,
            completedEvoIds: [...(gameState.completedEvoIds || []), evoDef.id],
            formation: newFormation,
            storage: newStorage,
            objectiveProgress: applyObjectiveProgress(gameState.objectiveProgress, 'complete_evos', 1)
        });
    };

    const handleClaimObjectiveReward = (objectiveId: string) => {
        const objective = objectivesData.find(o => o.id === objectiveId);
        if (!objective) return;
        const progress = gameState.objectiveProgress[objectiveId];
        const allTasksComplete = objective.tasks.every(task => (progress?.tasks?.[task.id] || 0) >= task.target);
        if (!progress || progress.claimed || !allTasksComplete) return;
    
        playSfx('rewardClaimed');
        
        let newCoins = gameState.coins;
        let newStorage = [...gameState.storage];
        let rewardCard: CardType | undefined;
        let rewardMessage = '';

        const newProgress = { ...gameState.objectiveProgress, [objectiveId]: { ...progress, claimed: true } };

        switch (objective.reward.type) {
            case 'coins':
                newCoins += objective.reward.amount!;
                rewardMessage = `You received ${objective.reward.amount} coins.`;
                break;
            case 'card':
                const cardTemplate = allCards.find(c => c.id === objective.reward.cardId);
                if (cardTemplate) {
                    const card = { ...cardTemplate, id: `${cardTemplate.id}-${Date.now()}` };
                    newStorage.push(card);
                    rewardCard = card;
                    rewardMessage = `You earned ${card.name}!`;
                }
                break;
        }
        
        if (rewardMessage) {
                setMessageModal({ title: 'Reward Claimed!', message: rewardMessage, card: rewardCard });
        }

        updateGameState({ coins: newCoins, storage: newStorage, objectiveProgress: newProgress });

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
            updateGameState({ lastRewardClaimTime: Date.now() });
            setIsDailyRewardModalOpen(false);
            return;
        }

        let newCoins = gameState.coins;
        let newStorage = [...gameState.storage];

        switch(rewardType) {
            case 'coins':
                newCoins += 1000;
                message = 'You received 1,000 coins!';
                break;
            case 'card':
                const possibleCards = allCards.filter(c => c.value <= 5000 && c.rarity !== 'bronze');
                const randomCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
                if (randomCard) {
                    const c = { ...randomCard, id: `${randomCard.id}-${Date.now()}` };
                    newStorage.push(c);
                    card = c;
                    message = `You received ${c.name}!`;
                }
                break;
        }
        if (message) {
            setMessageModal({ title, message, card });
        }
        updateGameState({ coins: newCoins, storage: newStorage, lastRewardClaimTime: Date.now() });
        setIsDailyRewardModalOpen(false);
    };
    
    const handleAddToFormation = useCallback((card: CardType) => {
        const { formation, formationLayout, storage } = gameState;
        const layout = formationLayouts[formationLayout];
        const emptyPositionId = layout.allPositions.find(posId => !formation[posId]);

        if (emptyPositionId) {
            const newFormation = { ...formation, [emptyPositionId]: card };
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
    
    const formationCardCount = useMemo(() => Object.values(gameState.formation).filter(Boolean).length, [gameState.formation]);
    const isFormationFull = formationCardCount >= 11;

    const renderView = () => {
        switch (currentView) {
            case 'store': return <Store onOpenPack={(packType) => handleOpenPack(packType, false)} gameState={gameState} isDevMode={isDevMode} t={t} />;
            case 'collection': return <Collection gameState={gameState} setGameState={updateGameState} setCardForOptions={setCardWithOptions} t={t} />;
            case 'market': return <Market market={gameState.market} onBuyCard={handleBuyCard} onCancelListing={handleCancelListing} currentUserId={gameState.userId} t={t} userCoins={gameState.coins} />;
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
                            notificationCounts={{ objectives: claimableObjectivesCount, evo: claimableEvoCount, fbc: 0 }}
                        />
                        {renderView()}
                    </main>
                </>
            )}

            {/* Global Loader */}
            {isLoading && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gold-light"></div>
                </div>
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
