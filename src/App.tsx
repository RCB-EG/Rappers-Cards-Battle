import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Card as CardType, GameView, PackType, MarketCard, FormationLayoutId, User, CurrentUser, Objective } from './types';
import { initialState, initialDbState } from './data/initialState';
import { allCards, packs, fbcData, evoData, formationLayouts, objectivesData } from './data/gameData';
import { translations, TranslationKey } from './utils/translations';
import { useSettings } from './hooks/useSettings';
import { calculateQuickSellValue } from './utils/cardUtils';
import { playSound } from './utils/sound';
import { sfx, getRevealSfxKey } from './data/sounds';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, writeBatch, addDoc, deleteDoc, query, runTransaction, increment } from 'firebase/firestore';

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
import DelistModal from './components/modals/DelistModal';

const App: React.FC = () => {
    // App Flow State
    const [appState, setAppState] = useState<'welcome' | 'intro' | 'game'>('welcome');
    const [isLoading, setIsLoading] = useState(true);
    
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

    // --- FIREBASE AUTH & DATA PERSISTENCE ---

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setCurrentUser({ uid: firebaseUser.uid, ...userDoc.data() } as User);
                } else {
                    // This case can happen if the user doc is deleted but auth record remains. Log them out.
                    await signOut(auth);
                }
            } else {
                setCurrentUser(null);
                setGameState(initialState);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Listener for Game State (coins, formation, etc.)
    useEffect(() => {
        if (!currentUser) return;

        const gameStateDocRef = doc(db, 'gameState', currentUser.uid);
        const unsubscribeGameState = onSnapshot(gameStateDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setGameState(prevState => ({ ...prevState, ...data, uid: currentUser.uid }));
            }
        });
        
        return () => unsubscribeGameState();
    }, [currentUser]);

    // Listener for user's card storage (sub-collection)
    useEffect(() => {
        if (!currentUser) return;

        const storageCollectionRef = collection(db, 'users', currentUser.uid, 'storage');
        const unsubscribeStorage = onSnapshot(storageCollectionRef, (querySnapshot) => {
            const storageCards = querySnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as CardType[];
            setGameState(prevState => ({ ...prevState, storage: storageCards }));
        });

        return () => unsubscribeStorage();
    }, [currentUser]);

    // Listener for the global market
    useEffect(() => {
        const marketCollectionRef = collection(db, 'market');
        const q = query(marketCollectionRef);
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const marketCards = querySnapshot.docs.map(doc => ({
                ...doc.data(),
                listingId: doc.id
            })) as MarketCard[];
            setGameState(prevState => ({ ...prevState, market: marketCards }));
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => { document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
    useEffect(() => {
        const handleClick = (event: MouseEvent) => { if ((event.target as HTMLElement).closest('button')) playSfx('buttonClick'); };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
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


    const handleSignUp = async (user: User) => {
        if (!user.email || !user.password) return;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
            const firebaseUser = userCredential.user;

            // Create user profile document
            await setDoc(doc(db, 'users', firebaseUser.uid), {
                username: user.username,
                email: user.email,
                avatar: user.avatar
            });

            // Create initial game state for the new user, using the clean DB state object
            await setDoc(doc(db, 'gameState', firebaseUser.uid), { ...initialDbState, uid: firebaseUser.uid });

            setIsSignUpModalOpen(false);
            setAuthError(null);
        } catch (error: any) {
            setAuthError(error.code === 'auth/email-already-in-use' ? t('email_taken') : error.message);
        }
    };

    const handleLogin = async (user: User) => {
        if (!user.email || !user.password) return;
        try {
            await signInWithEmailAndPassword(auth, user.email, user.password);
            setIsLoginModalOpen(false);
            setAuthError(null);
        } catch (error: any) {
            setAuthError('Invalid email or password.');
        }
    };
    
    const handleLogout = async () => {
        await signOut(auth);
    };
    
    const updateGameStateInDb = async (updates: Partial<GameState>) => {
        if (!currentUser) return;
        const gameStateRef = doc(db, 'gameState', currentUser.uid);
        await updateDoc(gameStateRef, updates);
    }

    const handleToggleDevMode = () => setIsDevMode(prev => !prev);
    
    const handleOpenPack = async (packType: PackType) => {
        if (!currentUser) {
             setMessageModal({ title: 'Please Login', message: 'You must be logged in to open packs.' });
            return;
        }
        playSfx('packBuildup');
        const pack = packs[packType];
        
        if (pack.cost > gameState.coins && !isDevMode) {
             setMessageModal({ title: 'Not Enough Coins', message: `You need ${pack.cost} coins to open this pack.` });
            return;
        }

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

        const newCard = { ...foundCard } as CardType;
        delete newCard.uid; // Ensure no UID is carried over from template

        if (settings.animationsOn) {
            setPackCard(newCard);
        } else {
            const isDuplicate = gameState.storage.some(card => card.name === newCard.name);
            if (isDuplicate) {
                setDuplicateToSell(newCard);
            } else {
                await addDoc(collection(db, 'users', currentUser.uid, 'storage'), newCard);
                setMessageModal({ title: 'New Card!', message: `You packed ${newCard.name}!`, card: newCard });
            }
        }

        if (pack.cost > 0 && !isDevMode) {
             await updateGameStateInDb({ coins: increment(-pack.cost) as any });
        }
    };

    const handlePackAnimationEnd = async (card: CardType) => {
        setPackCard(null);
        if (!currentUser) return;
        
        const isDuplicate = gameState.storage.some(c => c.name === card.name);
        if (isDuplicate) {
            setDuplicateToSell(card);
        } else {
            await addDoc(collection(db, 'users', currentUser.uid, 'storage'), card);
            setMessageModal({ title: `You got ${card.name}!`, message: `A new ${card.rarity} card has been added to your storage.`, card });
        }
    };

    const handleQuickSellDuplicate = async () => {
        if (duplicateToSell && currentUser) {
            const quickSellValue = calculateQuickSellValue(duplicateToSell);
            await updateGameStateInDb({ coins: increment(quickSellValue) as any });
            setMessageModal({ title: 'Card Sold', message: `You received ${quickSellValue} coins for the duplicate ${duplicateToSell.name}.` });
            setDuplicateToSell(null);
        }
    };
    
    const handleBuyCard = async (card: MarketCard) => {
        if (!currentUser) return;
        if (gameState.coins < card.price) {
            setMessageModal({ title: 'Not Enough Coins', message: `You need ${card.price} coins to buy this card.` });
            return;
        }
    
        try {
            // Atomic transaction for the buyer and market item
            await runTransaction(db, async (transaction) => {
                const buyerStateRef = doc(db, 'gameState', currentUser.uid);
                const marketItemRef = doc(db, 'market', card.listingId);
    
                const buyerStateDoc = await transaction.get(buyerStateRef);
                const marketItemDoc = await transaction.get(marketItemRef);
    
                if (!buyerStateDoc.exists()) throw new Error("Your user data could not be found.");
                if (!marketItemDoc.exists()) throw new Error("This item is no longer available.");
                
                const currentBuyerCoins = buyerStateDoc.data().coins;
                if (currentBuyerCoins < card.price) throw new Error("You do not have enough coins for this purchase.");
    
                // 1. Debit buyer
                transaction.update(buyerStateRef, { coins: increment(-card.price) });
    
                // 2. Add card to buyer's storage
                const boughtCardData: any = { ...marketItemDoc.data() };
                // Clean up market-specific fields before adding to storage
                delete boughtCardData.listingId;
                delete boughtCardData.price;
                delete boughtCardData.sellerUid;
                delete boughtCardData.sellerUsername;
                
                const newCardRef = doc(collection(db, 'users', currentUser.uid, 'storage'));
                transaction.set(newCardRef, boughtCardData);
                
                // 3. Delete market listing
                transaction.delete(marketItemRef);
            });
    
            // If transaction is successful, pay the seller. This is not atomic with the above but is safer.
            try {
                const sellerStateRef = doc(db, 'gameState', card.sellerUid);
                await updateDoc(sellerStateRef, { coins: increment(card.price) });
            } catch (payoutError) {
                console.error("Payout to seller failed, needs manual reconciliation:", payoutError);
                // The purchase was still successful for the buyer. We should probably log this error.
            }
    
            playSfx('purchase');
            setMessageModal({ title: 'Purchase Successful', message: `You bought ${card.name} for ${card.price} coins.`, card });
    
        } catch (e: any) {
            console.error("Transaction failed: ", e);
            setMessageModal({ title: 'Purchase Failed', message: e.message || 'There was an error processing your purchase.' });
        }
    };

    const handleListCard = async (card: CardType, price: number) => {
        if (!currentUser) return;
    
        const newMarketCard: Omit<MarketCard, 'listingId'> = {
            ...card,
            price,
            sellerUid: currentUser.uid,
            sellerUsername: currentUser.username,
        };
        // The card being listed might be from formation (no UID) or storage (has UID).
        // We delete the UID property to ensure the new market document gets a fresh ID.
        delete newMarketCard.uid;

        const batch = writeBatch(db);
        
        // Remove from storage or formation
        if (card.uid) { // Card is in storage, identified by its unique document ID
            batch.delete(doc(db, 'users', currentUser.uid, 'storage', card.uid));
        } else { // Card is in formation, identified by its template ID
            const formationPos = Object.keys(gameState.formation).find(pos => gameState.formation[pos]?.id === card.id);
            if (formationPos) {
                 batch.update(doc(db, 'gameState', currentUser.uid), { [`formation.${formationPos}`]: null });
            }
        }
        
        // Add the new listing to the market collection
        batch.set(doc(collection(db, 'market')), newMarketCard);
        
        await batch.commit();
        
        setCardToList(null);
        setMessageModal({ title: 'Card Listed', message: `${card.name} has been listed on the market for ${price} coins.` });
    };

    const handleDelistCard = async (card: MarketCard) => {
        if (!currentUser || card.sellerUid !== currentUser.uid) return;
    
        try {
            const marketItemRef = doc(db, 'market', card.listingId);
            
            // Prepare the card data to be added back to storage
            const cardDataToRestore: any = { ...card };
            delete cardDataToRestore.listingId;
            delete cardDataToRestore.price;
            delete cardDataToRestore.sellerUid;
            delete cardDataToRestore.sellerUsername;
            
            const newStorageCardRef = doc(collection(db, 'users', currentUser.uid, 'storage'));
    
            // Use a batch to perform both operations atomically
            const batch = writeBatch(db);
            batch.delete(marketItemRef);
            batch.set(newStorageCardRef, cardDataToRestore);
    
            await batch.commit();
    
            setMessageModal({ title: 'Card Delisted', message: `${card.name} has been returned to your storage.` });
        } catch (e) {
            console.error("Failed to delist card: ", e);
            setMessageModal({ title: 'Error', message: 'Could not delist the card. Please try again.' });
        }
    };
    
    const handleQuickSell = async (cardToSell: CardType) => {
         if (!currentUser) return;
        const quickSellValue = calculateQuickSellValue(cardToSell);
        const batch = writeBatch(db);
        const gameStateRef = doc(db, 'gameState', currentUser.uid);
        
        batch.update(gameStateRef, { coins: increment(quickSellValue) });
        
        if(cardToSell.uid) {
            batch.delete(doc(db, 'users', currentUser.uid, 'storage', cardToSell.uid));
        } else {
             const formationPos = Object.keys(gameState.formation).find(pos => gameState.formation[pos]?.id === cardToSell.id);
             if (formationPos) {
                 batch.update(gameStateRef, { [`formation.${formationPos}`]: null });
             }
        }

        await batch.commit();

        setCardWithOptions(null);
        setMessageModal({ title: 'Card Sold', message: `You quick sold ${cardToSell.name} for ${quickSellValue} coins.` });
    };
    
    // New handler for formation updates from Collection.tsx
    const handleFormationUpdate = async (updates: {
        newFormation: Record<string, CardType | null>,
        movedToStorage: CardType[],
        movedFromStorage: CardType[]
    }) => {
        if (!currentUser) return;
        const { newFormation, movedToStorage, movedFromStorage } = updates;

        const batch = writeBatch(db);
        const gameStateRef = doc(db, 'gameState', currentUser.uid);
        batch.update(gameStateRef, { formation: newFormation });

        movedToStorage.forEach(card => {
            const newDocRef = doc(collection(db, 'users', currentUser.uid, 'storage'));
            const cardData = { ...card };
            delete cardData.uid; 
            batch.set(newDocRef, cardData);
        });

        movedFromStorage.forEach(card => {
            if (card.uid) { 
                const docRef = doc(db, 'users', currentUser.uid, 'storage', card.uid);
                batch.delete(docRef);
            }
        });

        await batch.commit();
    };
    
    const handleLayoutChange = async (newLayoutId: FormationLayoutId) => {
        if (!currentUser) return;

        const currentFormationCards = Object.values(gameState.formation).filter(Boolean) as CardType[];
        
        const newLayout = formationLayouts[newLayoutId];
        const newFormation: Record<string, CardType | null> = {};
        newLayout.allPositions.forEach(posId => { newFormation[posId] = null; });

        const batch = writeBatch(db);

        const gameStateRef = doc(db, 'gameState', currentUser.uid);
        batch.update(gameStateRef, {
            formationLayout: newLayoutId,
            formation: newFormation
        });

        currentFormationCards.forEach(card => {
            const newDocRef = doc(collection(db, 'users', currentUser.uid, 'storage'));
            const cardData = { ...card };
            delete cardData.uid;
            batch.set(newDocRef, cardData);
        });

        await batch.commit();
    };


    if (isLoading) {
        return <div className="fixed inset-0 bg-black z-[100] flex justify-center items-center text-gold-light text-2xl font-header">Loading Game...</div>;
    }

    // TODO: Other handlers like FBC, Evo, Objectives would need similar async/Firestore logic

    const renderView = () => {
        switch (currentView) {
            case 'store': return <Store onOpenPack={handleOpenPack} gameState={gameState} isDevMode={isDevMode} t={t} />;
            case 'collection': return <Collection gameState={gameState} onFormationUpdate={handleFormationUpdate} onLayoutChange={handleLayoutChange} setCardForOptions={setCardWithOptions} t={t} />;
            case 'market': return <Market market={gameState.market} onBuyCard={handleBuyCard} onDelistCard={handleDelistCard} currentUserUid={currentUser?.uid || ''} t={t} />;
            case 'battle': return <Battle t={t} />;
            case 'fbc': return <FBC gameState={gameState} onFbcSubmit={()=>{}} t={t} playSfx={playSfx} />;
            case 'evo': return <Evo gameState={gameState} onStartEvo={()=>{}} onClaimEvo={()=>{}} t={t} playSfx={playSfx} />;
            case 'objectives': return <Objectives gameState={gameState} onClaimReward={()=>{}} t={t} />;
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
                            notificationCounts={{ objectives: 0, evo: 0, fbc: 0 }}
                        />
                        {currentUser ? renderView() : (
                            <div className="text-center py-20">
                                <h2 className="font-header text-3xl text-gold-light">Please Log In</h2>
                                <p className="text-gray-400 mt-2">Log in or create an account to start your journey.</p>
                            </div>
                        )}
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
                onAddToFormation={()=>{}}
                isFormationFull={false}
                t={t} 
            />
            <MarketModal cardToList={cardToList} onClose={() => setCardToList(null)} onList={handleListCard} t={t} />
            <DuplicateSellModal card={duplicateToSell} onSell={handleQuickSellDuplicate} t={t} />
            <DailyRewardModal isOpen={isDailyRewardModalOpen} onClaim={()=>{}} />
        </div>
    );
};

export default App;
