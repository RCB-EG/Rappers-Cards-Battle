
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
    BattleCard,
    BlitzRank,
    GlobalSettings,
    Objective,
    FBCChallenge,
    Evolution,
    TaskActionType,
    TaskRequirements,
    InboxMessage
} from './types';
import { initialState } from './data/initialState';
import { packs as defaultPacks, allCards, objectivesData, evoData, fbcData, playerPickConfigs, rankSystem, blitzRankSystem, DEV_EMAILS, PROMO_RARITIES } from './data/gameData';
import { sfx, getRevealSfxKey } from './data/sounds';
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
    writeBatch,
    increment,
    arrayUnion,
    getDocs
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
import ControlRoom from './components/views/ControlRoom'; // Import Control Room
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
    
    // Global Settings State (Default open)
    const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
        maintenanceMode: false,
        marketEnabled: true,
        battlesEnabled: true,
        announcement: { active: false, message: '', type: 'info' },
        disabledCardIds: [],
        activePromos: ['rotm', 'legend', 'event'] // Default active
    });

    // Dynamic Game Data
    const [libraryCards, setLibraryCards] = useState<GameCard[]>(allCards); // Default to hardcoded
    const [dynamicPacks, setDynamicPacks] = useState<Record<string, PackData>>({});
    
    // BATCH 1: Dynamic Content Data
    const [dynamicObjectives, setDynamicObjectives] = useState<Objective[]>([]);
    const [dynamicFBCs, setDynamicFBCs] = useState<FBCChallenge[]>([]);
    const [dynamicEvos, setDynamicEvos] = useState<Evolution[]>([]);

    // UI State
    const [isLoadingAssets, setIsLoadingAssets] = useState(true);
    const [showWelcome, setShowWelcome] = useState(true);
    const [showIntro, setShowIntro] = useState(false);
    const [isBattleActive, setIsBattleActive] = useState(false); 
    
    // Social Notification States
    const [friendRequestCount, setFriendRequestCount] = useState(0);
    const [incomingInvite, setIncomingInvite] = useState<BattleInvite | null>(null);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [unreadFromFriends, setUnreadFromFriends] = useState<Set<string>>(new Set());
    
    // Special Battle States
    const [directBattleId, setDirectBattleId] = useState<string | null>(null);
    const [setupInvite, setSetupInvite] = useState<BattleInvite | null>(null); 

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
    
    // Inbox Handling
    const [activeInboxMessage, setActiveInboxMessage] = useState<InboxMessage | null>(null);

    const handleStartGame = () => {
        setShowWelcome(false);
        setShowIntro(true);
    };

    const handleFinishIntro = () => {
        setShowIntro(false);
    };

    const gameStateRef = useRef(gameState);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    // Admin Check logic
    const isAdmin = isDevMode || (currentUser?.email && DEV_EMAILS.includes(currentUser.email));

    // --- Asset Preloading ---
    useEffect(() => {
        const loadAssets = async () => {
            await preloadCriticalAssets();
            setIsLoadingAssets(false);
        };
        loadAssets();
    }, []);

    // --- Dynamic Data Sync (Merge Logic) ---
    useEffect(() => {
        // Listen to game_cards collection in realtime
        const q = query(collection(db, 'game_cards'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Start with a map of hardcoded cards (ID -> Card)
            const combinedMap = new Map<string, GameCard>();
            allCards.forEach(card => combinedMap.set(card.id, card));

            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const dbCard = doc.data() as GameCard;
                    // Firestore cards overwrite hardcoded ones if IDs match, or are added if new
                    combinedMap.set(dbCard.id, dbCard);
                });
            }
            
            // Convert back to array
            setLibraryCards(Array.from(combinedMap.values()));
        }, (error) => {
            console.log("Using default card library (Firestore sync skipped or denied).");
            // Fallback to hardcoded if sync fails
            setLibraryCards(allCards);
        });

        return () => unsubscribe();
    }, []);

    // Sync Dynamic Packs
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'packs'), (docSnap) => {
            if (docSnap.exists()) {
                setDynamicPacks(docSnap.data() as Record<string, PackData>);
            }
        });
        return () => unsub();
    }, []);

    // BATCH 1: Sync Content
    useEffect(() => {
        const unsubObj = onSnapshot(doc(db, 'settings', 'objectives'), (snap) => {
            if (snap.exists()) setDynamicObjectives(snap.data().list || []);
        });
        const unsubFbc = onSnapshot(doc(db, 'settings', 'fbc'), (snap) => {
            if (snap.exists()) setDynamicFBCs(snap.data().list || []);
        });
        const unsubEvo = onSnapshot(doc(db, 'settings', 'evolutions'), (snap) => {
            if (snap.exists()) setDynamicEvos(snap.data().list || []);
        });
        return () => { unsubObj(); unsubFbc(); unsubEvo(); };
    }, []);

    // Merge static and dynamic lists
    // Filter out items where active === false
    const activeObjectives = [...objectivesData, ...dynamicObjectives].filter(o => o.active !== false);
    const activeFBCs = [...fbcData, ...dynamicFBCs].filter(f => f.active !== false);
    const activeEvos = [...evoData, ...dynamicEvos].filter(e => e.active !== false);

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

    // 0. Global Settings Listener
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as GlobalSettings;
                setGlobalSettings({ 
                    ...data, 
                    activePromos: data.activePromos || ['rotm', 'legend', 'event'] 
                });
            }
        }, (error) => {
            console.warn("Could not sync global settings:", error.message);
        });
        return () => unsub();
    }, []);

    // 1. Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setFirebaseUser(user);
            if (user) {
                try {
                    const userRef = doc(db, 'users', user.uid);
                    onSnapshot(userRef, (docSnap) => {
                        if (docSnap.exists()) {
                            const userData = docSnap.data();
                            
                            const profile: User = userData.userProfile || {
                                username: userData.username || user.email?.split('@')[0] || 'User',
                                email: userData.email || user.email || '',
                                avatar: userData.avatar || undefined
                            };
                            setCurrentUser(profile);
                            
                            const rankMap: Record<Rank, number> = { 'Legend': 4, 'Gold': 3, 'Silver': 2, 'Bronze': 1 };
                            const calculatedRankValue = rankMap[userData.rank as Rank] || 1;

                            setGameState(prev => ({ 
                                ...initialState, 
                                ...userData, 
                                rankValue: userData.rankValue || calculatedRankValue, 
                                userId: user.uid, 
                                market: prev.market 
                            }));
                            
                            if (!userData.rankValue) {
                                updateDoc(userRef, { rankValue: calculatedRankValue }).catch(console.error);
                            }

                        } else {
                            const newProfile: User = { username: user.email?.split('@')[0] || 'User', email: user.email || '' };
                            setCurrentUser(newProfile);
                            const newState = { ...initialState, userId: user.uid, userProfile: newProfile, rankValue: 1 };
                            const { market, ...stateToSave } = newState;
                            setDoc(userRef, stateToSave); 
                            setGameState(prev => ({ ...newState, market: prev.market }));
                        }
                    });

                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            } else {
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

    // 1.5 Inbox Listener (Admin Rewards)
    useEffect(() => {
        if (!firebaseUser) return;
        const q = query(collection(db, 'users', firebaseUser.uid, 'inbox'), limit(1));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const msg = { id: change.doc.id, ...change.doc.data() } as InboxMessage;
                    setActiveInboxMessage(msg);
                    playSfx('notification');
                }
            });
        });
        return () => unsubscribe();
    }, [firebaseUser, playSfx]);

    const handleClaimInboxItem = async () => {
        if (!activeInboxMessage || !firebaseUser) return;
        
        const msg = activeInboxMessage;
        const userRef = doc(db, 'users', firebaseUser.uid);
        const inboxRef = doc(db, 'users', firebaseUser.uid, 'inbox', msg.id);
        
        const { reward } = msg;
        const updates: Partial<GameState> = {};

        // Local Updates
        if (reward?.type === 'coins') {
            updates.coins = gameState.coins + (reward.amount || 0);
            updateDoc(userRef, { coins: increment(reward.amount || 0) }).catch(console.error);
        } else if (reward?.type === 'card' && reward.cardId) {
            const card = libraryCards.find(c => c.id === reward.cardId);
            if (card) {
                const newCard = { ...card, id: `${card.id}-${Date.now()}` };
                updates.storage = [...gameState.storage, newCard];
                updateDoc(userRef, { storage: arrayUnion(newCard) }).catch(console.error);
            }
        } else if (reward?.type === 'pack' && reward.packType) {
            handleOpenPack(reward.packType, { isReward: true });
        } else if (reward?.type === 'pick' && reward.pickId) {
            const pickConfig = playerPickConfigs[reward.pickId];
            if (pickConfig) {
                updates.ownedPlayerPicks = [...gameState.ownedPlayerPicks, pickConfig];
                updateDoc(userRef, { ownedPlayerPicks: arrayUnion(pickConfig) }).catch(console.error);
            }
        }

        if (Object.keys(updates).length > 0) {
            updateGameState(updates);
        }

        // Cleanup
        await deleteDoc(inboxRef);
        setActiveInboxMessage(null);
        
        if (reward?.type !== 'pack') {
            playSfx('rewardClaimed');
        }
    };

    // 2. Global Social Listeners
    useEffect(() => {
        if (!firebaseUser) return;

        const reqQuery = query(
            collection(db, 'friend_requests'), 
            where('toUid', '==', firebaseUser.uid), 
            where('status', '==', 'pending')
        );
        const unsubReqs = onSnapshot(reqQuery, (snap) => {
            if (snap.size > friendRequestCount) playSfx('notification');
            setFriendRequestCount(snap.size);
        });

        const inviteQuery = query(
            collection(db, 'battle_invites'),
            where('toUid', '==', firebaseUser.uid),
            where('status', '==', 'pending')
        );
        const unsubInvites = onSnapshot(inviteQuery, (snap) => {
            if (!snap.empty) {
                const doc = snap.docs[0];
                setIncomingInvite({ id: doc.id, ...doc.data() } as BattleInvite);
                playSfx('notification');
            } else {
                setIncomingInvite(null);
            }
        });

        const chatsQuery = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', firebaseUser.uid)
        );
        const unsubChats = onSnapshot(chatsQuery, (snap) => {
            let totalUnread = 0;
            const senders = new Set<string>();

            snap.forEach(doc => {
                const data = doc.data();
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
            if (totalUnread > unreadChatCount) playSfx('notification');
            setUnreadChatCount(totalUnread);
            setUnreadFromFriends(senders);
        });

        return () => {
            unsubReqs();
            unsubInvites();
            unsubChats();
        };
    }, [firebaseUser, playSfx, friendRequestCount, unreadChatCount]);

    // ... (Keep Accept/Reject Invite Logic - Unchanged)
    const handleAcceptInvite = async () => {
        if (!incomingInvite || !firebaseUser) return;
        try {
            const newBattleId = `battle_${Date.now()}_invite`;
            const battleRef = doc(db, 'battles', newBattleId);
            const opponentDoc = await getDoc(doc(db, 'users', incomingInvite.fromUid));
            const opponentData = opponentDoc.data() as GameState;
            const opponentProfile = opponentData?.userProfile;
            const myProfile = gameStateRef.current.userProfile;

            const initialState: OnlineBattleState = {
                id: newBattleId,
                mode: 'standard', 
                player1: { uid: incomingInvite.fromUid, username: opponentProfile?.username || 'Opponent', avatar: opponentProfile?.avatar || null, team: [] },
                player2: { uid: firebaseUser.uid, username: myProfile?.username || 'Me', avatar: myProfile?.avatar || null, team: [] },
                turn: incomingInvite.fromUid, 
                winner: null,
                lastMoveTimestamp: Date.now(),
                lastAction: null,
                logs: ['Players preparing...'],
                status: 'preparing'
            };

            await setDoc(battleRef, initialState);
            await updateDoc(doc(db, 'battle_invites', incomingInvite.id), { status: 'accepted', battleId: newBattleId });
            setIncomingInvite(null);
            setSetupInvite({ ...incomingInvite, battleId: newBattleId }); 
            setView('battle');
        } catch (e) { console.error("Error accepting invite", e); }
    };

    const handleFinalizeInviteStart = async (selectedTeam: BattleCard[]) => {
        if (!setupInvite || !setupInvite.battleId || !firebaseUser) return;
        try {
            const battleRef = doc(db, 'battles', setupInvite.battleId);
            await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) throw "Battle not found";
                const battleData = battleDoc.data() as OnlineBattleState;
                const isPlayer1 = battleData.player1.uid === firebaseUser.uid;
                const myTeam = selectedTeam.map((card, i) => ({ ...card, instanceId: `${firebaseUser.uid}-${i}-${card.id}`}));
                if (isPlayer1) {
                    transaction.update(battleRef, { 'player1.team': myTeam });
                    if (battleData.player2.team && battleData.player2.team.length > 0) transaction.update(battleRef, { status: 'active', logs: ['Battle Started!'] });
                } else {
                    transaction.update(battleRef, { 'player2.team': myTeam });
                    if (battleData.player1.team && battleData.player1.team.length > 0) transaction.update(battleRef, { status: 'active', logs: ['Battle Started!'] });
                }
            });
            setDirectBattleId(setupInvite.battleId);
            setSetupInvite(null);
        } catch (e) { console.error("Error finalizing invite setup", e); setSetupInvite(null); }
    };

    const handleRejectInvite = async () => {
        if (!incomingInvite) return;
        await deleteDoc(doc(db, 'battle_invites', incomingInvite.id));
        setIncomingInvite(null);
    };

    useEffect(() => {
        if (!firebaseUser) return;
        const q = query(collection(db, 'battle_invites'), where('fromUid', '==', firebaseUser.uid), where('status', '==', 'accepted'));
        const unsub = onSnapshot(q, (snap) => {
            snap.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data() as BattleInvite;
                    if (data.battleId) {
                        if (!directBattleId && !setupInvite) { 
                            setSetupInvite(data); 
                            setView('battle');
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
            const effectiveRank = (sanitized.rank || gameStateRef.current.rank) as Rank;
            const rankMap: Record<Rank, number> = { 'Legend': 4, 'Gold': 3, 'Silver': 2, 'Bronze': 1 };
            sanitized.rankValue = rankMap[effectiveRank] || 1;
            await updateDoc(userRef, sanitized);
        } catch (error) { console.error("Error saving game data:", error); }
    }, []);

    // 4. State Update Wrapper
    const updateGameState = useCallback((updates: Partial<GameState>) => {
        setGameState(prev => {
            const newState = { ...prev, ...updates };
            saveGameData(updates); 
            return newState;
        });
    }, [saveGameData]);

    // 5. Market Listener
    useEffect(() => {
        if (!globalSettings.marketEnabled) {
            setGameState(prev => ({ ...prev, market: [] }));
            return; 
        }
        const q = query(collection(db, 'market'), orderBy('createdAt', 'desc'), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const marketData: MarketCard[] = [];
            snapshot.forEach((doc) => {
                marketData.push({ ...doc.data() as MarketCard, marketId: doc.id });
            });
            setGameState(prev => ({ ...prev, market: marketData }));
        }, (error) => console.error("Market sync error:", error));
        return () => unsubscribe();
    }, [globalSettings.marketEnabled]);

    // 6. Payout Listener
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
                    const userRef = doc(db, 'users', firebaseUser.uid);
                    batch.update(userRef, { coins: increment(totalEarned) });
                    await batch.commit();
                    playSfx('rewardClaimed');
                    const msg = itemsSold.length === 1 ? `You sold ${itemsSold[0]} for ${totalEarned} coins!` : `You sold ${itemsSold.length} items for ${totalEarned} coins!`;
                    setMessageModal({ title: 'Market Earnings', message: msg });
                } catch (e) { console.error("Error claiming payouts", e); }
            }
        });
        return () => unsubscribe();
    }, [firebaseUser, playSfx]);

    // --- GENERIC LOGIC PROCESSOR ---
    const checkTaskRequirements = (req: TaskRequirements | undefined, context: any): boolean => {
        if (!req) return true;
        if (req.mode && context.mode !== req.mode) return false;
        if (req.packType && context.packType !== req.packType) return false;
        if (req.rarity && context.rarity !== req.rarity) return false;
        if (req.cardName && context.cardName !== req.cardName) return false;
        return true;
    };

    const handleTaskProgress = useCallback((action: TaskActionType, context: any = {}) => {
        let updates: Partial<GameState> = {};
        let progressChanged = false;
        let newObjectiveProgress = { ...gameStateRef.current.objectiveProgress };
        
        // 1. Check Objectives
        activeObjectives.forEach(obj => {
            obj.tasks.forEach(task => {
                // Match by ID (Legacy) or ActionType (Dynamic)
                const isLegacyMatch = task.id === context.legacyId;
                const isDynamicMatch = task.actionType === action && checkTaskRequirements(task.requirements, context);
                
                if (isLegacyMatch || isDynamicMatch) {
                    if (!newObjectiveProgress[obj.id]) newObjectiveProgress[obj.id] = { tasks: {}, claimed: false };
                    const currentVal = newObjectiveProgress[obj.id].tasks[task.id] || 0;
                    if (currentVal < task.target) {
                        newObjectiveProgress[obj.id].tasks[task.id] = Math.min(task.target, currentVal + (context.amount || 1));
                        progressChanged = true;
                    }
                }
            });
        });

        if (progressChanged) updates.objectiveProgress = newObjectiveProgress;

        // 2. Check Evolutions
        const activeEvo = gameStateRef.current.activeEvolution;
        if (activeEvo) {
            const evoDef = activeEvos.find(e => e.id === activeEvo.evoId);
            if (evoDef) {
                let evoChanged = false;
                const newTasks = { ...activeEvo.tasks };
                
                evoDef.tasks.forEach(task => {
                    const isLegacyMatch = task.id === context.legacyId;
                    const isDynamicMatch = task.actionType === action && checkTaskRequirements(task.requirements, context);
                    
                    if (isLegacyMatch || isDynamicMatch) {
                        const currentVal = newTasks[task.id] || 0;
                        if (currentVal < task.target) {
                            newTasks[task.id] = Math.min(task.target, currentVal + (context.amount || 1));
                            evoChanged = true;
                        }
                    }
                });
                
                if (evoChanged) updates.activeEvolution = { ...activeEvo, tasks: newTasks };
            }
        }

        if (Object.keys(updates).length > 0) updateGameState(updates);

    }, [activeObjectives, activeEvos, updateGameState]); // Dependencies

    // ... (Keep remaining effects for objective tracking) ...
    useEffect(() => {
        const goldCount = Object.values(gameState.formation).filter((c: GameCard | null) => c && c.rarity === 'gold').length;
        const objId = 'milestone_a_step_ahead';
        const taskId = 'formation_11_gold';
        const currentProgress = gameState.objectiveProgress[objId]?.tasks[taskId] || 0;
        if (goldCount >= 11 && currentProgress < 1) {
             // Use generic handler with legacy ID
             handleTaskProgress('COMPLETE_FBC', { legacyId: taskId }); // Dummy action type, relying on legacy ID match
        }
    }, [gameState.formation, gameState.objectiveProgress, handleTaskProgress]);

    useEffect(() => {
        const checkDailyObjectives = () => {
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            let lastReset = gameState.lastDailyReset;
            let currentProgress = { ...gameState.objectiveProgress };
            let currentCompletedFbcs = [...gameState.completedFbcIds];
            let stateChanged = false;
            if (!lastReset || (now - lastReset > oneDay)) {
                activeObjectives.filter(o => o.type === 'daily').forEach(o => { if (currentProgress[o.id]) delete currentProgress[o.id]; }); // FIX: Use merged list
                const dailyFbcIds = activeFBCs.filter(f => f.repeatable === 'daily').map(f => f.id); // FIX: Use merged list
                currentCompletedFbcs = currentCompletedFbcs.filter(id => !dailyFbcIds.includes(id));
                lastReset = now;
                stateChanged = true;
            }
            
            // Login Task Check
            handleTaskProgress('LOGIN', { legacyId: 'daily_login_task' });
            
            if (stateChanged) updateGameState({ lastDailyReset: lastReset, objectiveProgress: currentProgress, completedFbcIds: currentCompletedFbcs });
        };
        checkDailyObjectives();
    }, [gameState.lastDailyReset, gameState.objectiveProgress, gameState.completedFbcIds, updateGameState, activeObjectives, activeFBCs]);

    const handleClaimMarketItem = async (card: MarketCard) => {
        if (!auth.currentUser || !card.marketId) return;
        try {
            await runTransaction(db, async (transaction) => {
                const cardRef = doc(db, 'market', card.marketId!);
                const cardDoc = await transaction.get(cardRef);
                if (!cardDoc.exists()) throw "Item already claimed.";
                const cardData = cardDoc.data() as MarketCard;
                const isWinner = cardData.highestBidderId === auth.currentUser!.uid;
                const isOwner = cardData.sellerId === auth.currentUser!.uid;
                if (!isWinner && !isOwner) throw "Not authorized.";
                
                // Use a new ID for the claimed card to avoid conflicts
                const newCard = { ...cardData, id: `${cardData.id}-${Date.now()}` };
                delete (newCard as any).marketId;
                delete (newCard as any).price;
                delete (newCard as any).bidPrice;
                delete (newCard as any).startingPrice;
                delete (newCard as any).highestBidderId;
                delete (newCard as any).expiresAt;
                delete (newCard as any).durationHours;
                delete (newCard as any).sellerId;
                delete (newCard as any).createdAt;
                delete (newCard as any).buyNowPrice;

                const userRef = doc(db, 'users', auth.currentUser!.uid);
                
                if (isWinner) {
                    transaction.update(userRef, { storage: arrayUnion(newCard) });
                    const newPayoutRef = doc(collection(db, 'payouts'));
                    transaction.set(newPayoutRef, { receiverId: cardData.sellerId, amount: cardData.bidPrice, cardName: cardData.name, timestamp: Date.now() });
                } else if (isOwner) {
                    if (cardData.highestBidderId) throw "Cannot reclaim sold item.";
                    transaction.update(userRef, { storage: arrayUnion(newCard) });
                }
                transaction.delete(cardRef);
            });
            playSfx('rewardClaimed');
            setMessageModal({ title: 'Success', message: 'Item claimed successfully.' });
        } catch (e) {
            console.error(e);
            setMessageModal({ title: 'Error', message: 'Failed to claim item.' });
        }
    };

    // --- VIEW HANDLERS ---

    const handleOpenPack = (packType: PackType, options: { isReward?: boolean, bypassLimit?: boolean, fromInventory?: boolean, currency?: 'coins' | 'bp' } = {}) => {
        const packData = ({ ...defaultPacks, ...dynamicPacks } as Record<string, PackData>)[packType];
        if (!packData) return;

        // Cost Check
        if (!options.isReward && !options.fromInventory) {
            const cost: number = Number(options.currency === 'bp' ? packData.bpCost : packData.cost);
            const balance: number = Number(options.currency === 'bp' ? (gameState.battlePoints || 0) : gameState.coins);
            
            if (balance < cost && !isDevMode) {
                playSfx('purchase'); // Fail sound?
                return;
            }
            updateGameState({ 
                coins: options.currency !== 'bp' ? gameState.coins - cost : gameState.coins,
                battlePoints: options.currency === 'bp' ? (gameState.battlePoints || 0) - cost : gameState.battlePoints
            });
        }

        // Logic to generate cards based on rarity chances
        // Simplified for this file generation, usually in a utility
        const generateCard = () => {
            let rnd = Math.random() * 100;
            let rarity = 'bronze';
            for (const [r, chance] of Object.entries(packData.rarityChances)) {
                if (rnd < chance) { rarity = r; break; }
                rnd -= chance;
            }
            const pool = libraryCards.filter(c => c.rarity === rarity && c.isPackable !== false);
            const card = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : libraryCards[0];
            return { ...card, id: `${card.id}-${Date.now()}-${Math.random()}` };
        };

        // For now, assume single card packs unless it's a specific type
        const newCard = generateCard();
        const newStorage = [...gameState.storage, newCard];
        
        // Handle Inventory Consumption
        let newOwnedPacks = gameState.ownedPacks;
        if (options.fromInventory) {
            const idx = newOwnedPacks.indexOf(packType);
            if (idx > -1) {
                newOwnedPacks = [...newOwnedPacks];
                newOwnedPacks.splice(idx, 1);
            }
        }

        updateGameState({ 
            storage: newStorage, 
            ownedPacks: newOwnedPacks,
            freePacksOpenedToday: packType === 'free' ? gameState.freePacksOpenedToday + 1 : gameState.freePacksOpenedToday,
            lastFreePackResetTime: packType === 'free' ? Date.now() : gameState.lastFreePackResetTime
        });

        setPackCard(newCard); // Triggers animation
        handleTaskProgress('OPEN_PACK', { packType, rarity: newCard.rarity });
    };

    const handleListCard = async (card: GameCard, startPrice: number, buyNowPrice: number, durationHours: number) => {
        if (!auth.currentUser) return setModals(p => ({...p, login: true}));
        
        try {
            await addDoc(collection(db, 'market'), {
                ...card,
                sellerId: auth.currentUser.uid,
                startingPrice: startPrice,
                price: buyNowPrice, // Legacy
                buyNowPrice: buyNowPrice,
                bidPrice: startPrice,
                durationHours: durationHours,
                expiresAt: Date.now() + (durationHours * 3600000),
                createdAt: Date.now(),
                highestBidderId: null
            });
            
            updateGameState({ storage: gameState.storage.filter(c => c.id !== card.id) });
            setCardToList(null);
            handleTaskProgress('LIST_MARKET');
            setMessageModal({ title: 'Success', message: 'Card listed on market!' });
        } catch (e) {
            console.error(e);
            setMessageModal({ title: 'Error', message: 'Failed to list card.' });
        }
    };

    const handleCancelListing = async (card: MarketCard) => {
        if (!auth.currentUser || card.sellerId !== auth.currentUser.uid || !card.marketId) return;
        if (card.highestBidderId) return setMessageModal({ title: 'Error', message: 'Cannot cancel active auction.' });
        
        try {
            await deleteDoc(doc(db, 'market', card.marketId));
            const reclaimedCard = { ...card };
            // Cleanup market props
            delete (reclaimedCard as any).marketId;
            // ... (cleanup other props)
            updateGameState({ storage: [...gameState.storage, reclaimedCard] });
            setMessageModal({ title: 'Success', message: 'Listing cancelled.' });
        } catch (e) { console.error(e); }
    };

    const handleQuickSell = (card: GameCard) => {
        const value = calculateQuickSellValue(card);
        updateGameState({ 
            coins: gameState.coins + value,
            storage: gameState.storage.filter(c => c.id !== card.id),
            pendingEarnings: (gameState.pendingEarnings || 0) + value // Track for session
        });
        handleTaskProgress('QUICK_SELL', { rarity: card.rarity, amount: 1 });
        setCardOptions(null);
        setPendingPackCards(prev => prev.filter(c => c.id !== card.id)); // If in pack result
    };

    const handleAddToFormation = (card: GameCard) => {
        // Simple logic: add to first empty slot or alert
        const emptySlot = Object.keys(gameState.formation).find(key => gameState.formation[key] === null);
        if (emptySlot) {
            updateGameState({
                formation: { ...gameState.formation, [emptySlot]: card },
                storage: gameState.storage.filter(c => c.id !== card.id)
            });
            setCardOptions(null);
        } else {
            alert("Formation full!");
        }
    };

    const handleSendToStorage = (card: GameCard) => {
        const slot = Object.keys(gameState.formation).find(key => gameState.formation[key]?.id === card.id);
        if (slot) {
            updateGameState({
                formation: { ...gameState.formation, [slot]: null },
                storage: [...gameState.storage, card]
            });
            setCardOptions(null);
        }
    };

    const handleFbcSubmit = (challengeId: string, submittedCards: GameCard[]) => {
        const challenge = activeFBCs.find(c => c.id === challengeId);
        if (!challenge) return;

        // Remove cards
        const submittedIds = submittedCards.map(c => c.id);
        const newStorage = gameState.storage.filter(c => !submittedIds.includes(c.id));
        
        // Grant Reward
        let rewardMsg = '';
        const updates: Partial<GameState> = { storage: newStorage, completedFbcIds: [...gameState.completedFbcIds, challengeId] };
        
        if (challenge.reward.type === 'coins') {
            updates.coins = gameState.coins + (challenge.reward.amount || 0);
            rewardMsg = `${challenge.reward.amount} Coins`;
        } else if (challenge.reward.type === 'pack' && challenge.reward.details) {
            // Add pack to inventory
            updates.ownedPacks = [...gameState.ownedPacks, challenge.reward.details];
            rewardMsg = `${challenge.reward.details} Pack`;
        } else if (challenge.reward.type === 'card' && challenge.reward.cardId) {
            const rewardCard = libraryCards.find(c => c.id === challenge.reward.cardId);
            if (rewardCard) {
                const newCard = { ...rewardCard, id: `${rewardCard.id}-${Date.now()}` };
                updates.storage = [...newStorage, newCard];
                rewardMsg = rewardCard.name;
            }
        }

        updateGameState(updates);
        handleTaskProgress('COMPLETE_FBC', { legacyId: challengeId }); // And generic
        setMessageModal({ title: 'Challenge Completed!', message: `You earned: ${rewardMsg}` });
    };

    const handleStartEvo = (evoId: string, cardId: string) => {
        updateGameState({ activeEvolution: { evoId, cardId, tasks: {} } });
    };

    const handleClaimEvo = () => {
        const activeEvo = gameState.activeEvolution;
        if (!activeEvo) return;
        const evoDef = activeEvos.find(e => e.id === activeEvo.evoId);
        if (!evoDef) return;

        const resultCard = libraryCards.find(c => c.id === evoDef.resultCardId);
        if (resultCard) {
            const newCard = { ...resultCard, id: `${resultCard.id}-${Date.now()}` };
            // Remove base card, add evolved card
            const newStorage = gameState.storage.filter(c => c.id !== activeEvo.cardId);
            // Also check formation
            const newFormation = { ...gameState.formation };
            Object.keys(newFormation).forEach(k => {
                if (newFormation[k]?.id === activeEvo.cardId) newFormation[k] = null;
            });

            updateGameState({ 
                storage: [...newStorage, newCard],
                formation: newFormation,
                activeEvolution: null,
                completedEvoIds: [...gameState.completedEvoIds, activeEvo.evoId]
            });
            handleTaskProgress('COMPLETE_EVO', { legacyId: evoDef.id });
            setRewardModal({ isOpen: true, reward: { type: 'card', cardId: resultCard.id } });
        }
    };

    const handleClaimObjectiveReward = (objectiveId: string) => {
        const obj = activeObjectives.find(o => o.id === objectiveId);
        if (!obj) return;
        
        const updates: Partial<GameState> = {
            objectiveProgress: { 
                ...gameState.objectiveProgress, 
                [objectiveId]: { ...gameState.objectiveProgress[objectiveId], claimed: true } 
            }
        };

        const { reward } = obj;
        if (reward.type === 'coins') updates.coins = gameState.coins + (reward.amount || 0);
        else if (reward.type === 'pack' && reward.packType) updates.ownedPacks = [...gameState.ownedPacks, reward.packType];
        else if (reward.type === 'player_pick' && reward.playerPickId) {
            const pickConfig = playerPickConfigs[reward.playerPickId];
            if (pickConfig) updates.ownedPlayerPicks = [...gameState.ownedPlayerPicks, pickConfig];
        }
        else if (reward.type === 'card' && reward.cardId) {
            const card = libraryCards.find(c => c.id === reward.cardId);
            if (card) updates.storage = [...gameState.storage, { ...card, id: `${card.id}-${Date.now()}` }];
        }

        updateGameState(updates);
        setRewardModal({ isOpen: true, reward: reward });
    };

    const handleBattleWin = (amount: number, isWin: boolean, mode: 'ranked' | 'challenge' | 'blitz', squad: GameCard[]) => {
        const updates: Partial<GameState> = {};
        
        if (mode === 'ranked') {
            updates.rankWins = gameState.rankWins + (isWin ? 1 : 0);
            // Check Promotion
            const currentRank = gameState.rank;
            const reqWins = rankSystem[currentRank].winsToPromote;
            if (updates.rankWins >= reqWins) {
                // Handle Rank Up
                const ranks: Rank[] = ['Bronze', 'Silver', 'Gold', 'Legend'];
                const idx = ranks.indexOf(currentRank);
                if (idx < ranks.length - 1) {
                    const newRank = ranks[idx + 1];
                    updates.rank = newRank;
                    updates.rankWins = 0;
                    // Trigger Rank Up Modal with Rewards
                    setRankUpModalData({ newRank, rewards: rankSystem[currentRank].promotionReward });
                } else {
                    // Legend Loop
                    updates.rankWins = 0;
                    setRankUpModalData({ newRank: 'Legend', rewards: rankSystem['Legend'].promotionReward });
                }
            }
        } else if (mode === 'blitz') {
            updates.blitzWins = gameState.blitzWins + (isWin ? 1 : 0);
            // Handle Blitz Rank Logic (simplified)
        }

        if (amount > 0) updates.battlePoints = (gameState.battlePoints || 0) + amount;
        
        updateGameState(updates);
        handleTaskProgress(isWin ? 'WIN_BATTLE' : 'PLAY_BATTLE', { mode });
    };

    const handlePlayerPickComplete = (selectedCards: GameCard[]) => {
        const newStorage = [...gameState.storage, ...selectedCards.map(c => ({...c, id: `${c.id}-${Date.now()}`}))];
        updateGameState({ 
            storage: newStorage, 
            activePlayerPick: null 
        });
        setMessageModal({ title: 'Pick Complete', message: `Added ${selectedCards.length} players to your club.` });
    };

    const handleInventoryPickOpen = (config: PlayerPickConfig) => {
        // Remove one instance of this pick from inventory
        const idx = gameState.ownedPlayerPicks.findIndex(p => p.id === config.id);
        if (idx > -1) {
            const newInventory = [...gameState.ownedPlayerPicks];
            newInventory.splice(idx, 1);
            updateGameState({ 
                ownedPlayerPicks: newInventory,
                activePlayerPick: config
            });
        }
    };

    const notificationCounts = {
        objectives: activeObjectives.filter(o => {
            const progress = gameState.objectiveProgress[o.id] || { tasks: {}, claimed: false };
            const allMet = o.tasks.every(t => (progress.tasks?.[t.id] || 0) >= t.target);
            return allMet && !progress.claimed;
        }).length,
        evo: 0, 
        fbc: 0,
        store: (gameState.ownedPacks?.length || 0) + (gameState.ownedPlayerPicks?.length || 0),
        social: friendRequestCount + unreadChatCount
    };

    return (
        <div className="bg-black/95 text-white min-h-screen font-main relative overflow-hidden select-none">
            {/* Background elements */}
            <div className="fixed inset-0 bg-[url('https://i.imghippo.com/files/Exm8210UFo.png')] bg-cover bg-center opacity-40 z-0"></div>
            <div className="fixed inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 z-0"></div>
            <Particles rank={gameState.rank} />

            {/* Main Content Area */}
            <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar">
                
                {/* Header (Always visible unless in fullscreen intro/battle) */}
                {!showWelcome && !showIntro && !isBattleActive && (
                    <Header 
                        gameState={gameState} 
                        currentUser={currentUser}
                        onToggleDevMode={() => setIsDevMode(!isDevMode)}
                        isDevMode={isDevMode}
                        isAdmin={isAdmin}
                        onOpenSettings={() => setModals(prev => ({ ...prev, settings: true }))}
                        onOpenHowToPlay={() => setModals(prev => ({ ...prev, howToPlay: true }))}
                        onOpenLogin={() => setModals(prev => ({ ...prev, login: true }))}
                        onOpenSignUp={() => setModals(prev => ({ ...prev, signup: true }))}
                        onLogout={() => signOut(auth)}
                        lang={lang} 
                        setLang={setLang}
                        t={t}
                        globalSettings={globalSettings}
                    />
                )}

                <main className={`flex-grow container mx-auto px-2 md:px-4 ${(!showWelcome && !showIntro && !isBattleActive) ? 'pt-4 pb-24 md:pb-8' : ''}`}>
                   {showWelcome ? (
                       <WelcomeScreen onStart={handleStartGame} />
                   ) : showIntro ? (
                       <IntroVideo onSkip={handleFinishIntro} />
                   ) : (
                       <>
                           {view === 'store' && <Store onOpenPack={handleOpenPack} onOpenInventoryPick={handleInventoryPickOpen} gameState={gameState} isDevMode={isDevMode} t={t} globalSettings={globalSettings} />}
                           {view === 'collection' && <Collection gameState={gameState} setGameState={updateGameState} setCardForOptions={setCardOptions} t={t} />}
                           {view === 'market' && <Market market={gameState.market} onBuyCard={card => setCardToList(card)} onCancelListing={handleCancelListing} onClaimCard={handleClaimMarketItem} currentUserId={gameState.userId} t={t} userCoins={gameState.coins} allCards={libraryCards} />}
                           {view === 'battle' && <Battle gameState={gameState} onBattleWin={handleBattleWin} t={t} playSfx={playSfx} musicVolume={settings.musicVolume} musicOn={settings.musicOn} setIsBattleActive={setIsBattleActive} setupInvite={setupInvite} onStartInviteBattle={handleFinalizeInviteStart} currentUser={currentUser} allCards={libraryCards} />}
                           {view === 'fbc' && <FBC gameState={gameState} onFbcSubmit={handleFbcSubmit} t={t} playSfx={playSfx} allCards={libraryCards} challenges={activeFBCs} />}
                           {view === 'evo' && <Evo gameState={gameState} onStartEvo={handleStartEvo} onClaimEvo={handleClaimEvo} t={t} playSfx={playSfx} allCards={libraryCards} evolutions={activeEvos} />}
                           {view === 'objectives' && <Objectives gameState={gameState} onClaimReward={handleClaimObjectiveReward} t={t} allCards={libraryCards} objectives={activeObjectives} />}
                           {view === 'social' && <Social gameState={gameState} currentUser={currentUser} t={t} unreadFromFriends={unreadFromFriends} hasPendingRequests={friendRequestCount > 0} />}
                           {view === 'admin' && isAdmin && <ControlRoom globalSettings={globalSettings} onClose={() => setView('store')} t={t} allCards={libraryCards} />}
                       </>
                   )}
                </main>

                {/* Mobile Navigation (Bottom) */}
                {!showWelcome && !showIntro && !isBattleActive && (
                    <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/90 border-t border-gold-dark/30 backdrop-blur-md pb-safe">
                        <Navigation 
                            currentView={view} 
                            setCurrentView={setView} 
                            t={t} 
                            notificationCounts={notificationCounts}
                            isAdmin={isAdmin}
                        />
                    </div>
                )}
            </div>

            {/* Modals */}
            <SettingsModal isOpen={modals.settings} onClose={() => setModals(p => ({...p, settings: false}))} settings={settings} updateSettings={updateSettings} t={t} />
            <HowToPlayModal isOpen={modals.howToPlay} onClose={() => setModals(p => ({...p, howToPlay: false}))} t={t} />
            <LoginModal isOpen={modals.login} onClose={() => setModals(p => ({...p, login: false}))} onLogin={(u) => { signInWithEmailAndPassword(auth, u.username, u.password!).then(() => setModals(p => ({...p, login: false}))).catch(e => alert(e.message)); }} error={null} t={t} />
            <SignUpModal isOpen={modals.signup} onClose={() => setModals(p => ({...p, signup: false}))} onSignUp={(u) => { createUserWithEmailAndPassword(auth, u.email!, u.password!).then(cred => setDoc(doc(db, 'users', cred.user.uid), { userProfile: { username: u.username, email: u.email, avatar: u.avatar }, coins: 10000, formation: initialState.formation, storage: [], formationLayout: '4-4-2' })).then(() => setModals(p => ({...p, signup: false}))).catch(e => alert(e.message)); }} error={null} t={t} />
            
            {messageModal && <MessageModal isOpen={true} onClose={() => setMessageModal(null)} title={messageModal.title} message={messageModal.message} card={messageModal.card} />}
            {cardOptions && <CardOptionsModal cardWithOptions={cardOptions} onClose={() => setCardOptions(null)} onListCard={(c) => setCardToList(c)} onQuickSell={handleQuickSell} onAddToFormation={handleAddToFormation} onSendToStorage={handleSendToStorage} isFormationFull={Object.values(gameState.formation).filter(Boolean).length >= 11} t={t} />}
            {cardToList && <MarketModal cardToList={cardToList} onClose={() => setCardToList(null)} onList={handleListCard} t={t} />}
            
            {/* Pack Animations & Results */}
            <PackAnimationModal card={packCard} onAnimationEnd={(c) => { setPackCard(null); if (pendingPackCards.length > 0) { /* Show results */ } else if (c) { /* Show single result */ setPendingPackCards([c]); } }} playSfx={playSfx} />
            {pendingPackCards.length > 0 && !packCard && (
                <PackResultsModal cards={pendingPackCards} onKeep={(c) => { setPendingPackCards(p => p.filter(pc => pc.id !== c.id)); if (pendingPackCards.length === 1) setPendingPackCards([]); }} onSell={handleQuickSell} onList={handleListCard} storage={gameState.storage} t={t} />
            )}
            
            {/* Pick Modals */}
            {gameState.activePlayerPick && <PlayerPickModal config={gameState.activePlayerPick} onComplete={handlePlayerPickComplete} storage={gameState.storage} formation={gameState.formation} t={t} playSfx={playSfx} allCards={libraryCards} />}
            
            {rankUpModalData && <RankUpModal isOpen={!!rankUpModalData} onClose={() => setRankUpModalData(null)} newRank={rankUpModalData.newRank} rewards={rankUpModalData.rewards} t={t} />}
            {rewardModal.isOpen && <RewardModal isOpen={true} onClose={() => setRewardModal({ isOpen: false, reward: null })} reward={rewardModal.reward} title={rewardModal.title} t={t} allCards={libraryCards} />}
            
            {/* Admin Reward Modal */}
            {activeInboxMessage && (
                <RewardModal 
                    isOpen={true} 
                    onClose={handleClaimInboxItem} 
                    reward={activeInboxMessage.reward || null} 
                    title={activeInboxMessage.title} 
                    t={t} 
                    allCards={libraryCards} 
                />
            )}
            
            {incomingInvite && <BattleInviteModal invite={incomingInvite} onAccept={handleAcceptInvite} onReject={handleRejectInvite} />}
        </div>
    );
};

export default App;
