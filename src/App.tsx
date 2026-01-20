
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    Rank,
    BattleInvite,
    OnlineBattleState,
    BattleCard
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
    runTransaction,
    where,
    writeBatch
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
import Social from './components/views/Social';
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
import BattleInviteModal from './components/modals/BattleInviteModal';
import PvPBattle from './components/views/PvPBattle';
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
    const [isBattleActive, setIsBattleActive] = useState(false); // New state to lock nav
    
    // Social Notification States
    const [friendRequestCount, setFriendRequestCount] = useState(0);
    const [incomingInvite, setIncomingInvite] = useState<BattleInvite | null>(null);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [unreadFromFriends, setUnreadFromFriends] = useState<Set<string>>(new Set());
    
    // Special Battle States
    const [directBattleId, setDirectBattleId] = useState<string | null>(null);
    const [setupInvite, setSetupInvite] = useState<BattleInvite | null>(null); // Invite currently being set up

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

    // Use a ref to access current gameState inside callbacks without adding it to dependency array (avoid loops)
    const gameStateRef = useRef(gameState);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

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
                    
                    // Listen to realtime updates for self (this handles friend acceptance by others immediately)
                    onSnapshot(userRef, (docSnap) => {
                        if (docSnap.exists()) {
                            const userData = docSnap.data();
                            
                            const profile: User = userData.userProfile || {
                                username: userData.username || user.email?.split('@')[0] || 'User',
                                email: userData.email || user.email || '',
                                avatar: userData.avatar || undefined
                            };
                            setCurrentUser(profile);
                            
                            // Ensure rankValue is set in state if missing in DB
                            const rankMap: Record<Rank, number> = { 'Legend': 4, 'Gold': 3, 'Silver': 2, 'Bronze': 1 };
                            const calculatedRankValue = rankMap[userData.rank as Rank] || 1;

                            setGameState(prev => ({ 
                                ...initialState, 
                                ...userData, 
                                rankValue: userData.rankValue || calculatedRankValue, // Use DB value or calc fallback
                                userId: user.uid, 
                                market: prev.market 
                            }));
                            
                            // Fix: If rankValue was missing in DB, write it now to ensure leaderboard visibility
                            if (!userData.rankValue) {
                                updateDoc(userRef, { rankValue: calculatedRankValue }).catch(console.error);
                            }

                        } else {
                            // First time creation logic if direct listen fails or new user
                            const newProfile: User = { username: user.email?.split('@')[0] || 'User', email: user.email || '' };
                            setCurrentUser(newProfile);
                            const newState = { ...initialState, userId: user.uid, userProfile: newProfile, rankValue: 1 };
                            const { market, ...stateToSave } = newState;
                            setDoc(userRef, stateToSave); // No await needed to block
                            setGameState(prev => ({ ...newState, market: prev.market }));
                        }
                    });

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

    // 2. Global Social Listeners (Invites, Requests, CHATS)
    useEffect(() => {
        if (!firebaseUser) return;

        // Friend Requests Listener
        const reqQuery = query(
            collection(db, 'friend_requests'), 
            where('toUid', '==', firebaseUser.uid), 
            where('status', '==', 'pending')
        );
        const unsubReqs = onSnapshot(reqQuery, (snap) => {
            setFriendRequestCount(snap.size);
        });

        // Battle Invites Listener
        const inviteQuery = query(
            collection(db, 'battle_invites'),
            where('toUid', '==', firebaseUser.uid),
            where('status', '==', 'pending')
        );
        const unsubInvites = onSnapshot(inviteQuery, (snap) => {
            // Just take the first one for simplicity
            if (!snap.empty) {
                const doc = snap.docs[0];
                setIncomingInvite({ id: doc.id, ...doc.data() } as BattleInvite);
                playSfx('packBuildup'); // Alert sound
            } else {
                setIncomingInvite(null);
            }
        });

        // Chats Listener (For Notifications)
        const chatsQuery = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', firebaseUser.uid)
        );
        const unsubChats = onSnapshot(chatsQuery, (snap) => {
            let totalUnread = 0;
            const senders = new Set<string>();

            snap.forEach(doc => {
                const data = doc.data();
                // If the last message was NOT sent by me
                if (data.lastSenderId && data.lastSenderId !== firebaseUser.uid) {
                    const myReadTime = data.readStatus?.[firebaseUser.uid] || 0;
                    const lastMsgTime = data.lastMessageTime || 0;
                    
                    if (lastMsgTime > myReadTime) {
                        totalUnread++;
                        const friendUid = data.participants.find((p: string) => p !== firebaseUser.uid);
                        if (friendUid) senders.add(friendUid);
                    }
                }
            });
            setUnreadChatCount(totalUnread);
            setUnreadFromFriends(senders);
        });

        return () => {
            unsubReqs();
            unsubInvites();
            unsubChats();
        };
    }, [firebaseUser, playSfx]);

    // Called when user clicks "Accept" on invite modal (Player B)
    const handleAcceptInvite = async () => {
        if (!incomingInvite || !firebaseUser) return;
        
        try {
            // 1. Create the battle document in 'preparing' state immediately
            // This ensures both players have a battle ID to join
            const newBattleId = `battle_${Date.now()}_invite`;
            const battleRef = doc(db, 'battles', newBattleId);
            
            // Fetch opponent profile data
            const opponentDoc = await getDoc(doc(db, 'users', incomingInvite.fromUid));
            const opponentData = opponentDoc.data() as GameState;
            const opponentProfile = opponentData?.userProfile;
            const myProfile = gameStateRef.current.userProfile;

            const initialState: OnlineBattleState = {
                id: newBattleId,
                player1: { 
                    uid: incomingInvite.fromUid, 
                    username: opponentProfile?.username || 'Opponent', 
                    avatar: opponentProfile?.avatar || null,
                    team: [] // Empty team initially, they must select
                },
                player2: { 
                    uid: firebaseUser.uid, 
                    username: myProfile?.username || 'Me', 
                    avatar: myProfile?.avatar || null,
                    team: [] // Empty team initially
                },
                turn: incomingInvite.fromUid, // Challenger starts
                winner: null,
                lastMoveTimestamp: Date.now(),
                logs: ['Players preparing...'],
                status: 'preparing' // Waiting for both to submit teams
            };

            await setDoc(battleRef, initialState);
            
            // 2. Update Invite to 'accepted' with battle ID
            await updateDoc(doc(db, 'battle_invites', incomingInvite.id), { status: 'accepted', battleId: newBattleId });

            // 3. Move Receiver to Setup View
            setIncomingInvite(null);
            setSetupInvite({ ...incomingInvite, battleId: newBattleId }); // Store battleId in local invite state
            setView('battle');

        } catch (e) {
            console.error("Error accepting invite", e);
        }
    };

    // Called by Battle component when user finishes setup and clicks "Ready"
    const handleFinalizeInviteStart = async (selectedTeam: BattleCard[]) => {
        if (!setupInvite || !setupInvite.battleId || !firebaseUser) return;

        try {
            const battleRef = doc(db, 'battles', setupInvite.battleId);
            
            await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) throw "Battle not found";
                
                const battleData = battleDoc.data() as OnlineBattleState;
                const isPlayer1 = battleData.player1.uid === firebaseUser.uid;
                
                // Prepare my team with instance IDs
                const myTeam = selectedTeam.map((card, i) => ({
                    ...card,
                    instanceId: `${firebaseUser.uid}-${i}-${card.id}`,
                }));

                // Update my team in the document
                if (isPlayer1) {
                    transaction.update(battleRef, { 'player1.team': myTeam });
                    // Check if Player 2 is already ready
                    if (battleData.player2.team && battleData.player2.team.length > 0) {
                        transaction.update(battleRef, { status: 'active', logs: ['Battle Started!'] });
                    }
                } else {
                    transaction.update(battleRef, { 'player2.team': myTeam });
                    // Check if Player 1 is already ready
                    if (battleData.player1.team && battleData.player1.team.length > 0) {
                        transaction.update(battleRef, { status: 'active', logs: ['Battle Started!'] });
                    }
                }
            });

            // Move to PvP View (Waiting Room or Battle)
            setDirectBattleId(setupInvite.battleId);
            setSetupInvite(null);
            
        } catch (e) {
            console.error("Error finalizing invite setup", e);
            setSetupInvite(null);
        }
    };

    const handleRejectInvite = async () => {
        if (!incomingInvite) return;
        await deleteDoc(doc(db, 'battle_invites', incomingInvite.id));
        setIncomingInvite(null);
    };

    // Sender Listener: Move to Setup when invite is accepted (Player A)
    useEffect(() => {
        if (!firebaseUser) return;
        // Listen for my sent invites that become accepted
        const q = query(
            collection(db, 'battle_invites'),
            where('fromUid', '==', firebaseUser.uid),
            where('status', '==', 'accepted')
        );
        
        const unsub = onSnapshot(q, (snap) => {
            snap.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data() as BattleInvite;
                    if (data.battleId) {
                        // My invite was accepted! 
                        // Instead of going straight to battle, go to setup first.
                        if (!directBattleId && !setupInvite) { // Avoid infinite loop or double set
                            setSetupInvite(data); 
                            setView('battle');
                            // Clean up invite doc as we have the battleId now
                            deleteDoc(change.doc.ref).catch(console.error); 
                        }
                    }
                }
            });
        });
        return () => unsub();
    }, [firebaseUser, directBattleId, setupInvite]);


    // 3. Data Saver & Rank Value Calculation
    const saveGameData = useCallback(async (stateToSave: Partial<GameState>) => {
        if (!auth.currentUser) {
            try {
                const current = JSON.parse(localStorage.getItem('guestGameState') || '{}');
                const merged = { ...current, ...stateToSave };
                localStorage.setItem('guestGameState', JSON.stringify(merged));
            } catch (e) { console.error("LS Error", e); }
            return;
        }

        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const { market, ...cleanState } = stateToSave as GameState; 
            const sanitized = JSON.parse(JSON.stringify(cleanState)); 
            
            // Fix: Always ensure rankValue matches the current rank (from state or update)
            // Use the updated rank if present, otherwise fall back to current state
            const effectiveRank = (sanitized.rank || gameStateRef.current.rank) as Rank;
            const rankMap: Record<Rank, number> = { 'Legend': 4, 'Gold': 3, 'Silver': 2, 'Bronze': 1 };
            sanitized.rankValue = rankMap[effectiveRank] || 1;

            await updateDoc(userRef, sanitized);
        } catch (error) {
            console.error("Error saving game data:", error);
        }
    }, []); // No dependencies needed due to gameStateRef

    // 4. State Update Wrapper
    const updateGameState = useCallback((updates: Partial<GameState>) => {
        setGameState(prev => {
            const newState = { ...prev, ...updates };
            saveGameData(updates); 
            return newState;
        });
    }, [saveGameData]);

    // 5. Market Listener (Global Data)
    useEffect(() => {
        // Market is public read, so this should work for guests too if rules allow `read: if true`
        const q = query(collection(db, 'market'), orderBy('createdAt', 'desc'), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const marketData: MarketCard[] = [];
            snapshot.forEach((doc) => {
                marketData.push({ ...doc.data() as MarketCard, marketId: doc.id });
            });
            setGameState(prev => ({ ...prev, market: marketData }));
        }, (error) => {
            console.error("Market sync error:", error);
        });
        return () => unsubscribe();
    }, []);

    // 6. Payout Listener (Seller Logic)
    useEffect(() => {
        if (!firebaseUser) return;

        const q = query(collection(db, 'payouts'), where('receiverId', '==', firebaseUser.uid));
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (snapshot.empty) return;

            let totalEarned = 0;
            const batch = writeBatch(db);
            const itemsSold: string[] = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                totalEarned += data.amount;
                itemsSold.push(data.cardName || 'Card');
                batch.delete(doc.ref);
            });

            if (totalEarned > 0) {
                try {
                    // Execute batch delete of payout docs
                    await batch.commit();
                    
                    // Update local state and save to DB
                    setGameState(prev => {
                        const newCoins = prev.coins + totalEarned;
                        // Trigger save immediately for consistency
                        const userRef = doc(db, 'users', firebaseUser.uid);
                        updateDoc(userRef, { coins: newCoins }).catch(e => console.error(e));
                        return { ...prev, coins: newCoins };
                    });

                    // Notify user
                    playSfx('rewardClaimed');
                    // Simple summary
                    const msg = itemsSold.length === 1 
                        ? `You sold ${itemsSold[0]} for ${totalEarned} coins!` 
                        : `You sold ${itemsSold.length} items for ${totalEarned} coins!`;
                        
                    setMessageModal({ title: 'Market Earnings', message: msg });
                } catch (e) {
                    console.error("Error claiming payouts", e);
                }
            }
        });

        return () => unsubscribe();
    }, [firebaseUser, playSfx]);


    // --- Game Logic ---

    const handleStartGame = () => {
        setShowWelcome(false);
        setShowIntro(true);
        playSfx('buttonClick');
    };

    const handleFinishIntro = () => {
        setShowIntro(false);
    };

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

    // This function handles both "Buy Now" (using buyNowPrice) and "Bid" (using input amount)
    const handleMarketAction = async (marketCard: MarketCard) => {
        if (!auth.currentUser) {
            setMessageModal({ title: 'Guest Mode', message: 'Market actions require an account.' });
            return;
        }

        if (!marketCard.marketId) {
            setMessageModal({ title: 'Error', message: 'Invalid card data (missing ID).' });
            return;
        }

        // --- Fix: Ensure bidPrice is defined (fallback to price if legacy) ---
        if (marketCard.bidPrice === undefined) {
             // If legacy data, fallback to using the price field logic
             if (marketCard.price) {
                 marketCard.bidPrice = marketCard.price; // Assume it's a Buy Now intent if passed this way
             } else {
                 setMessageModal({ title: 'Error', message: 'Invalid pricing data.' });
                 return;
             }
        }

        const safeBuyNowPrice = marketCard.buyNowPrice || marketCard.price || 0;
        const actionType = marketCard.bidPrice >= safeBuyNowPrice ? 'buy' : 'bid';
        const cost = marketCard.bidPrice; 

        if (gameState.coins < cost) {
             setMessageModal({ title: 'Insufficient Funds', message: 'You do not have enough coins.' });
             return;
        }
        
        // Only check duplicates on Full Purchase, allow bidding on duplicates if you want (but risk stuck value)
        if (actionType === 'buy') {
            const alreadyInStorage = gameState.storage.some((c: GameCard) => c.name === marketCard.name);
            const alreadyInFormation = (Object.values(gameState.formation) as (GameCard | null)[]).some(c => c?.name === marketCard.name);
            if (alreadyInStorage || alreadyInFormation) {
                setMessageModal({ title: 'Duplicate Found', message: `You already own ${marketCard.name}.` });
                return;
            }
        }

        try {
            await runTransaction(db, async (transaction) => {
                const cardRef = doc(db, 'market', marketCard.marketId!);
                const userRef = doc(db, 'users', auth.currentUser!.uid);

                // 1. READS (MUST come before any writes)
                const cardDoc = await transaction.get(cardRef);
                const userDoc = await transaction.get(userRef);
                
                if (!cardDoc.exists()) throw "Card no longer exists!";
                if (!userDoc.exists()) throw "User not found";

                const currentCardData = cardDoc.data() as MarketCard;
                const userData = userDoc.data() as GameState;

                // Validate Funds
                if (userData.coins < cost) throw "Insufficient funds (server check)";

                // -- AUTO-RESET LOGIC CHECK --
                const now = Date.now();
                const currentExpiry = currentCardData.expiresAt || 0;
                const durationMs = (currentCardData.durationHours || 24) * 3600000;
                
                if (now > currentExpiry && !currentCardData.highestBidderId) {
                    const cycles = Math.ceil((now - currentExpiry) / durationMs);
                    const newExpiry = currentExpiry + (cycles * durationMs);
                    currentCardData.expiresAt = newExpiry;
                    transaction.update(cardRef, { expiresAt: newExpiry });
                }

                if (now > currentCardData.expiresAt && currentCardData.highestBidderId) {
                    throw "Auction has ended.";
                }

                // 2. READ previous bidder data IF NEEDED (must be done before writes)
                let prevBidderData = null;
                let prevBidderRef = null;
                
                if (currentCardData.highestBidderId) {
                    prevBidderRef = doc(db, 'users', currentCardData.highestBidderId);
                    const prevBidderDoc = await transaction.get(prevBidderRef);
                    if (prevBidderDoc.exists()) {
                        prevBidderData = prevBidderDoc.data();
                    }
                }

                // --- NOW we can perform WRITES ---

                if (actionType === 'buy') {
                    // --- BUY NOW LOGIC ---
                    
                    // Legacy support for price vs buyNowPrice
                    const currentBuyPrice = currentCardData.buyNowPrice || currentCardData.price || 0;
                    const intendedBuyPrice = marketCard.buyNowPrice || marketCard.price || 0;

                    if (currentBuyPrice !== intendedBuyPrice) throw "Price has changed.";

                    // Refund Previous Highest Bidder (if exists)
                    if (currentCardData.highestBidderId && prevBidderRef && prevBidderData) {
                        transaction.update(prevBidderRef, { coins: (prevBidderData.coins || 0) + currentCardData.bidPrice });
                    }

                    // Delete from Market
                    transaction.delete(cardRef);

                    // Update Buyer
                    const { marketId, sellerId, price, buyNowPrice, bidPrice, startingPrice, highestBidderId, expiresAt, durationHours, createdAt, ...cardData } = currentCardData;
                    const newCard = { ...cardData, id: `${cardData.id}-${Date.now()}` };
                    
                    transaction.update(userRef, {
                        storage: [...userData.storage, newCard],
                        coins: userData.coins - cost
                    });

                    // Pay Seller
                    const newPayoutRef = doc(collection(db, 'payouts'));
                    transaction.set(newPayoutRef, {
                        receiverId: currentCardData.sellerId,
                        amount: cost,
                        cardName: currentCardData.name,
                        timestamp: Date.now()
                    });

                } else {
                    // --- BID LOGIC ---
                    
                    if (cost <= currentCardData.bidPrice && currentCardData.highestBidderId) throw "Bid too low.";
                    if (cost < currentCardData.startingPrice) throw "Bid below starting price.";

                    // Refund Previous Highest Bidder
                    if (currentCardData.highestBidderId && prevBidderRef && prevBidderData) {
                        transaction.update(prevBidderRef, { coins: (prevBidderData.coins || 0) + currentCardData.bidPrice });
                    }

                    // Update Market Card
                    transaction.update(cardRef, {
                        bidPrice: cost,
                        highestBidderId: auth.currentUser!.uid
                    });

                    // Deduct Coins from New Bidder
                    transaction.update(userRef, {
                        coins: userData.coins - cost
                    });
                }
            });

            // Optimistic Updates
            playSfx('purchase');
            if (actionType === 'buy') {
                const { marketId, ...cardData } = marketCard;
                setGameState(prev => ({
                    ...prev,
                    coins: prev.coins - cost,
                    storage: [...prev.storage, { ...cardData, id: `${cardData.id}-${Date.now()}` } as GameCard]
                }));
                setMessageModal({ title: 'Success', message: `You bought ${marketCard.name}!` });
            } else {
                setGameState(prev => ({ ...prev, coins: prev.coins - cost }));
                setMessageModal({ title: 'Bid Placed', message: `You are winning ${marketCard.name}!` });
            }

        } catch (e) {
            console.error("Transaction Failed:", e);
            setMessageModal({ title: 'Error', message: typeof e === 'string' ? e : 'Transaction failed. Please try again.' });
        }
    };

    const handleListCard = async (card: GameCard, startPrice: number, buyNowPrice: number, durationHours: number) => {
        if (!firebaseUser) {
            setMessageModal({ title: 'Login Required', message: 'You must be logged in to use the market.' });
            return;
        }
        
        try {
            await addDoc(collection(db, 'market'), {
                ...card,
                price: buyNowPrice, // Legacy support
                buyNowPrice,
                bidPrice: 0, // Starts at 0, first bid must be >= startingPrice
                startingPrice: startPrice,
                highestBidderId: null,
                expiresAt: Date.now() + (durationHours * 3600000),
                durationHours,
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
             // Note: In a real app, verify no bids exist or refund bidder before deleting.
             // Our UI blocks cancelling if bids exist, but rules should enforce it.
             const { marketId, sellerId, price, buyNowPrice, bidPrice, startingPrice, highestBidderId, expiresAt, durationHours, createdAt, ...cardData } = marketCard;
             updateGameState({ storage: [...gameState.storage, cardData as GameCard] });
         } catch(e) {
             console.error("Cancel listing error:", e);
         }
    };

    // ... (Keep existing pack, pick, sell, battle logic as is)
    
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
        // Reset direct battle ID if active
        if (directBattleId) setDirectBattleId(null);

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
                
                // Set rank value immediately for updates
                const rankMap: Record<Rank, number> = { 'Legend': 4, 'Gold': 3, 'Silver': 2, 'Bronze': 1 };
                updates.rankValue = rankMap[nextRank];
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
        store: gameState.ownedPacks.length + gameState.ownedPlayerPicks.length,
        social: friendRequestCount + (incomingInvite ? 1 : 0) + unreadChatCount
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
                        {/* Only hide nav when BATTLE is actually ACTIVE */}
                        {!isBattleActive && (
                            <Navigation 
                                currentView={view} 
                                setCurrentView={setView} 
                                t={t}
                                notificationCounts={notificationCounts}
                                isDisabled={isBattleActive}
                            />
                        )}

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
                            {view === 'market' && <Market market={gameState.market} onBuyCard={handleMarketAction} onCancelListing={handleCancelListing} currentUserId={currentUser?.username || ''} t={t} userCoins={gameState.coins} />}
                            {view === 'battle' && (
                                directBattleId ? (
                                    <PvPBattle
                                        gameState={gameState}
                                        preparedTeam={Object.values(gameState.formation).filter(Boolean) as any}
                                        onBattleEnd={(reward, isWin) => handleBattleResult(reward, isWin, 'challenge', [])}
                                        onExit={() => { setDirectBattleId(null); setView('social'); }}
                                        playSfx={playSfx}
                                        musicVolume={settings.musicVolume}
                                        musicOn={settings.musicOn}
                                        initialBattleId={directBattleId}
                                    />
                                ) : (
                                    <Battle 
                                        gameState={gameState} 
                                        onBattleWin={handleBattleResult} 
                                        t={t} 
                                        playSfx={playSfx} 
                                        musicVolume={settings.musicVolume} 
                                        musicOn={settings.musicOn} 
                                        setIsBattleActive={setIsBattleActive} 
                                        setupInvite={setupInvite}
                                        onStartInviteBattle={handleFinalizeInviteStart}
                                        currentUser={currentUser}
                                    />
                                )
                            )}
                            {view === 'fbc' && <FBC gameState={gameState} onFbcSubmit={handleFbcSubmit} t={t} playSfx={playSfx} />}
                            {view === 'evo' && <Evo gameState={gameState} onStartEvo={handleStartEvo} onClaimEvo={handleClaimEvo} t={t} playSfx={playSfx} />}
                            {view === 'objectives' && <Objectives gameState={gameState} onClaimReward={handleClaimObjective} t={t} />}
                            {view === 'social' && (
                                <Social 
                                    gameState={gameState} 
                                    currentUser={currentUser} 
                                    t={t} 
                                    unreadFromFriends={unreadFromFriends}
                                    hasPendingRequests={friendRequestCount > 0}
                                />
                            )}
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
                     // Ensure rankValue is set on creation
                     setDoc(doc(db, 'users', u.user.uid), { userProfile: { username: creds.username, email: creds.email, avatar: creds.avatar }, ...initialState, rankValue: 1 });
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

            <BattleInviteModal 
                invite={incomingInvite}
                onAccept={handleAcceptInvite}
                onReject={handleRejectInvite}
            />
        </div>
    );
};

export default App;
