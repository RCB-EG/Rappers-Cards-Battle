import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, Card as CardType, GameView, PackType, MarketCard, FormationLayoutId, User, CurrentUser, Objective } from './types';
import { initialState } from './data/initialState';
import { allCards, packs, fbcData, evoData, formationLayouts, objectivesData } from './data/gameData';
import { translations, TranslationKey } from './utils/translations';
import { useSettings } from './hooks/useSettings';
import { calculateQuickSellValue } from './utils/cardUtils';
import { playSound } from './utils/sound';
import { sfx, getRevealSfxKey } from './data/sounds';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, writeBatch, addDoc, deleteDoc, query, runTransaction } from 'firebase/firestore';

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

    useEffect(() => {
        if (!currentUser) return;

        const gameStateDocRef = doc(db, 'gameState', currentUser.uid);
        const storageCollectionRef = collection(db, 'users', currentUser.uid, 'storage');

        const unsubscribeGameState = onSnapshot(gameStateDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setGameState(prevState => ({ ...prevState, ...data, uid: currentUser.uid }));
            }
        });
        
        const unsubscribeStorage = onSnapshot(storageCollectionRef, (querySnapshot) => {
            const storageCards = querySnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as CardType[];
            setGameState(prevState => ({ ...prevState, storage: storageCards }));
        });

        return () => {
            unsubscribeGameState();
            unsubscribeStorage();
        };
    }, [currentUser]);

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
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, user.email!, user.password!);
            const firebaseUser = userCredential.user;

            await setDoc(doc(db, 'users', firebaseUser.uid), {
                username: user.username,
                email: user.email,
                avatar: user.avatar
            });

            await setDoc(doc(db, 'gameState', firebaseUser.uid), { ...initialState, uid: firebaseUser.uid });

            setIsSignUpModalOpen(false);
            setAuthError(null);
        } catch (error: any) {
            setAuthError(error.code === 'auth/email-already-in-use' ? t('email_taken') : error.message);
        }
    };

    const handleLogin = async (user: User) => {
        try {
            await signInWithEmailAndPassword(auth, user.email!, user.password!);
            setIsLoginModalOpen(false);
            setAuthError(null);
        } catch (error: any) {
            setAuthError('Invalid email or password.');
        }
    };
    
    const handleLogout = async () => {
        await signOut(auth);
    };

    const handleToggleDevMode = () => setIsDevMode(prev => !prev);
    
    const handleOpenPack = async (packType: PackType) => {
        if (!currentUser) {
             setMessageModal({ title: 'Please Login', message: 'You must be logged in to open packs.' });
            return;
        }
        playSfx('packBuildup');
        // ... (pack opening logic remains the same)
        // Find card...
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

        if (pack.cost > 0) {
             await updateDoc(doc(db, 'gameState', currentUser.uid), { coins: gameState.coins - pack.cost });
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
            await updateDoc(doc(db, 'gameState', currentUser.uid), { coins: gameState.coins + quickSellValue });
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
            await runTransaction(db, async (transaction) => {
                const buyerStateRef = doc(db, 'gameState', currentUser.uid);
                const sellerStateRef = doc(db, 'gameState', card.sellerUid);
                const marketItemRef = doc(db, 'market', card.listingId);

                const buyerStateDoc = await transaction.get(buyerStateRef);
                const sellerStateDoc = await transaction.get(sellerStateRef);

                if (!buyerStateDoc.exists()) throw "Buyer document does not exist!";
                
                const newBuyerCoins = buyerStateDoc.data().coins - card.price;
                if (newBuyerCoins < 0) throw "Not enough coins.";

                transaction.update(buyerStateRef, { coins: newBuyerCoins });

                if (sellerStateDoc.exists()) {
                     transaction.update(sellerStateRef, { coins: sellerStateDoc.data().coins + card.price });
                }

                const boughtCardData = { ...card };
                delete boughtCardData.listingId;
                delete boughtCardData.price;
                delete boughtCardData.sellerUid;
                delete boughtCardData.sellerUsername;
                
                const newCardRef = doc(collection(db, 'users', currentUser.uid, 'storage'));
                transaction.set(newCardRef, boughtCardData);
                
                transaction.delete(marketItemRef);
            });

            playSfx('purchase');
            setMessageModal({ title: 'Purchase Successful', message: `You bought ${card.name} for ${card.price} coins.`, card });
        } catch (e) {
            console.error("Transaction failed: ", e);
            setMessageModal({ title: 'Purchase Failed', message: 'There was an error processing your purchase.' });
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

        const batch = writeBatch(db);
        
        // Remove from storage or formation
        if (card.uid) { // Card is in storage
            batch.delete(doc(db, 'users', currentUser.uid, 'storage', card.uid));
        } else { // Card is in formation, need to find its position
            const formationPos = Object.keys(gameState.formation).find(pos => gameState.formation[pos]?.id === card.id);
            if (formationPos) {
                 batch.update(doc(db, 'gameState', currentUser.uid), { [`formation.${formationPos}`]: null });
            }
        }
        
        batch.set(doc(collection(db, 'market')), newMarketCard);
        
        await batch.commit();
        
        setCardToList(null);
        setMessageModal({ title: 'Card Listed', message: `${card.name} has been listed on the market for ${price} coins.` });
    };
    
    const handleQuickSell = async (cardToSell: CardType) => {
         if (!currentUser) return;
        const quickSellValue = calculateQuickSellValue(cardToSell);
        const batch = writeBatch(db);
        const gameStateRef = doc(db, 'gameState', currentUser.uid);
        
        batch.update(gameStateRef, { coins: gameState.coins + quickSellValue });
        
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

    if (isLoading) {
        return <div className="fixed inset-0 bg-black z-[100] flex justify-center items-center text-gold-light text-2xl font-header">Loading Game...</div>;
    }

    // All other handlers like FBC, Evo, Objectives would need similar async/Firestore logic
    // For brevity, those are omitted, but would follow the same pattern:
    // 1. Check for currentUser
    // 2. Perform database operations (updateDoc, setDoc, deleteDoc)
    // 3. Let onSnapshot listeners update the local state naturally

    const renderView = () => {
        // ... views are rendered the same way ...
        switch (currentView) {
            case 'store': return <Store onOpenPack={(packType) => handleOpenPack(packType)} gameState={gameState} isDevMode={isDevMode} t={t} />;
            case 'collection': return <Collection gameState={gameState} setGameState={() => {}} setCardForOptions={setCardWithOptions} t={t} />;
            case 'market': return <Market market={gameState.market} onBuyCard={handleBuyCard} currentUserId={currentUser?.uid || ''} t={t} />;
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
