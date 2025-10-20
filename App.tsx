
import React, { useState, useEffect, useCallback } from 'react';
// Fix: Correctly import all necessary types from the central types definition file.
import { GameState, Card as CardType, GameView, PackType, MarketCard, Settings, FBCChallenge, Evolution, FormationLayoutId, Stats, Deal, ObjectiveProgress } from './types';
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

const App: React.FC = () => {
    // App Flow State
    const [appState, setAppState] = useState<'welcome' | 'intro' | 'game'>('welcome');
    
    // Game State
    const [gameState, setGameState] = useState<GameState>(initialState);
    const [currentView, setCurrentView] = useState<GameView>('store');
    const [isDevMode, setIsDevMode] = useState(false);

    // Settings & Language
    const [settings, updateSettings] = useSettings();
    const [lang, setLang] = useState<'en' | 'ar'>('en');

    // Modal States
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
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

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            if ((event.target as HTMLElement).closest('button')) {
                playSfx('buttonClick');
            }
        };
        window.addEventListener('click', handleClick);
        return () => {
            window.removeEventListener('click', handleClick);
        };
    }, [playSfx]);

    useEffect(() => {
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }, [lang]);

    // Game State Persistence & Timed Resets
    useEffect(() => {
        const savedStateJSON = localStorage.getItem('rappersGameState');
        let savedState = savedStateJSON ? JSON.parse(savedStateJSON) : null;

        if (savedState) {
            const now = Date.now();
            const dailyDuration = 24 * 60 * 60 * 1000;
            const weeklyDuration = 7 * dailyDuration;

            let updatedProgress = { ...(savedState.objectiveProgress || {}) };
            let dailyReset = false;
            let weeklyReset = false;

            // Check for daily objective reset
            if (!savedState.lastDailyReset || (now - savedState.lastDailyReset > dailyDuration)) {
                Object.keys(updatedProgress).forEach(objId => {
                    const objDef = objectivesData.find(o => o.id === objId);
                    if (objDef?.type === 'daily') {
                        delete updatedProgress[objId];
                    }
                });
                savedState.lastDailyReset = now;
                dailyReset = true;
            }

            // Check for weekly objective reset
            if (!savedState.lastWeeklyReset || (now - savedState.lastWeeklyReset > weeklyDuration)) {
                Object.keys(updatedProgress).forEach(objId => {
                    const objDef = objectivesData.find(o => o.id === objId);
                    if (objDef?.type === 'weekly') {
                        delete updatedProgress[objId];
                    }
                });
                savedState.lastWeeklyReset = now;
                weeklyReset = true;
            }

            if (dailyReset || weeklyReset) {
                savedState.objectiveProgress = updatedProgress;
            }

            // Migration for older saves
            if (Array.isArray(savedState.formation)) {
                const migratedLayout: FormationLayoutId = '4-4-2';
                const newFormation: Record<string, CardType | null> = {};
                formationLayouts[migratedLayout].allPositions.forEach(posId => {
                    newFormation[posId] = null;
                });
                savedState = { ...initialState, ...savedState, formation: newFormation, formationLayout: migratedLayout, storage: [...savedState.storage, ...savedState.formation] };
            }
            
            setGameState({ ...initialState, ...savedState });
            
            // Check for daily reward
            if (!savedState.lastRewardClaimTime || (now - savedState.lastRewardClaimTime > dailyDuration)) {
                setTimeout(() => setIsDailyRewardModalOpen(true), 500);
            }

        } else {
             const now = Date.now();
             const newUserId = `user-${Math.random().toString(36).substr(2, 9)}`;
             setGameState(prevState => ({
                ...prevState, 
                userId: newUserId,
                lastDailyReset: now,
                lastWeeklyReset: now
            }));
             // New player gets reward immediately
             setTimeout(() => setIsDailyRewardModalOpen(true), 500);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('rappersGameState', JSON.stringify(gameState));
    }, [gameState]);

    // Music Control
    useEffect(() => {
        const bgMusic = document.getElementById('bg-music') as HTMLAudioElement;
        const introMusic = document.getElementById('intro-music') as HTMLAudioElement;

        if (bgMusic && introMusic) {
            const isGameActive = appState === 'game';
            bgMusic.volume = settings.musicVolume / 100;
            introMusic.volume = settings.musicVolume / 100;

            if (settings.musicOn && isGameActive) {
                bgMusic.play().catch(e => console.error("BG music autoplay failed", e));
            } else {
                bgMusic.pause();
            }
        }
    }, [settings.musicOn, settings.musicVolume, appState]);


    const updateGameState = (updates: Partial<GameState>) => {
        setGameState(prevState => ({ ...prevState, ...updates }));
    };
    
    const handleToggleDevMode = () => {
        const nextDevModeState = !isDevMode;
        setIsDevMode(nextDevModeState);

        if (nextDevModeState) {
            const aboElAnwarTemplate = allCards.find(card => card.id === 'g1');
            if (aboElAnwarTemplate) {
                const allPlayerCards = [...gameState.storage, ...Object.values(gameState.formation).filter(Boolean)];
                const playerAlreadyHasCard = allPlayerCards.some(card => card.name === 'Abo El Anwar' && card.rarity === 'gold');

                if (!playerAlreadyHasCard) {
                    const newCardInstance = { ...aboElAnwarTemplate, id: crypto.randomUUID() };
                    updateGameState({ storage: [...gameState.storage, newCardInstance] });
                    setMessageModal({ title: "Dev Mode Activated", message: "Abo El Anwar (Gold) has been added for Evolution testing." });
                }
            }
        }
    };
    
    const trackEvolutionTask = useCallback((taskId: string, amount: number) => {
        setGameState(prevState => {
            if (!prevState.activeEvolution) return prevState;
            const evoDef = evoData.find(e => e.id === prevState.activeEvolution?.evoId);
            if (!evoDef || !evoDef.tasks.some(t => t.id === taskId)) return prevState;

            const newProgress = (prevState.activeEvolution.tasks[taskId] || 0) + amount;
            const newActiveEvolution = { ...prevState.activeEvolution, tasks: { ...prevState.activeEvolution.tasks, [taskId]: newProgress } };
            return { ...prevState, activeEvolution: newActiveEvolution };
        });
    }, []);

    const trackObjectiveProgress = useCallback((task: string, amount: number) => {
        setGameState(prevState => {
            const newProgress = { ...prevState.objectiveProgress };
            let updated = false;
            objectivesData.forEach(obj => {
                if (obj.task === task) {
                    const current = newProgress[obj.id] || { progress: 0, claimed: false };
                    if (!current.claimed) {
                        newProgress[obj.id] = { ...current, progress: current.progress + amount };
                        updated = true;
                    }
                }
            });
            return updated ? { ...prevState, objectiveProgress: newProgress } : prevState;
        });
    }, []);

    const handleOpenPack = useCallback((packType: PackType, isReward = false) => {
        const pack = packs[packType];
        
        if (packType === 'free' && !isReward && !isDevMode) {
            const now = Date.now();
            const twelveHours = 12 * 60 * 60 * 1000;
            let packsOpened = gameState.freePacksOpenedToday;
            let lastReset = gameState.lastFreePackResetTime;

            if (lastReset === null || (now - lastReset > twelveHours)) {
                packsOpened = 0;
                lastReset = now;
            }
            
            if (packsOpened >= 3) {
                setMessageModal({ title: "No Free Packs", message: "You have already claimed all your free packs for now. Come back later!" });
                if (gameState.freePacksOpenedToday !== packsOpened || gameState.lastFreePackResetTime !== lastReset) {
                  updateGameState({ freePacksOpenedToday: packsOpened, lastFreePackResetTime: lastReset });
                }
                return;
            }
            setGameState(prevState => ({ ...prevState, freePacksOpenedToday: packsOpened + 1, lastFreePackResetTime: lastReset }));
        }

        if (!isReward) {
            if (gameState.coins < pack.cost && !isDevMode) {
                setMessageModal({ title: "Not Enough Coins", message: "You don't have enough coins to buy this pack." });
                return;
            }
            if (!isDevMode) {
                updateGameState({ coins: gameState.coins - pack.cost });
                if (packType === 'special') trackEvolutionTask('open_special_packs', 1);
            }
        }
        
        if (settings.animationsOn) playSfx('packBuildup');
        
        // Track objectives
        trackObjectiveProgress(`open_${packType}_packs`, 1);

        const rand = Math.random() * 100;
        let cumulative = 0;
        let chosenRarity: CardType['rarity'] | undefined;
        const validChances = Object.entries(pack.rarityChances).filter(([, chance]) => chance && chance > 0);

        for (const [rarity, chance] of validChances) {
            cumulative += chance;
            if (rand < cumulative) {
                chosenRarity = rarity as CardType['rarity'];
                break;
            }
        }

        if (!chosenRarity) return;

        const exclusiveCardIds = new Set([...fbcData.map(fbc => fbc.reward.cardId), ...evoData.map(evo => evo.resultCardId)].filter(Boolean));
        const possibleCards = allCards.filter(c => c.rarity === chosenRarity && !exclusiveCardIds.has(c.id));
        if (possibleCards.length === 0) {
            setMessageModal({ title: "Pack Error", message: "No available cards for this rarity. This is rare!"});
            return;
        }

        let selectedCardTemplate: CardType;
        if (possibleCards.length > 1) {
            const maxOvr = Math.max(...possibleCards.map(c => c.ovr));
            const weightedCards = possibleCards.map(card => ({ card, weight: (maxOvr - card.ovr) + 5 }));
            const totalWeight = weightedCards.reduce((sum, item) => sum + item.weight, 0);
            let randomWeight = Math.random() * totalWeight;
            for (const item of weightedCards) {
                randomWeight -= item.weight;
                if (randomWeight <= 0) {
                    selectedCardTemplate = item.card;
                    break;
                }
            }
            if (!selectedCardTemplate!) selectedCardTemplate = weightedCards[weightedCards.length - 1].card;
        } else {
            selectedCardTemplate = possibleCards[0];
        }

        const newCard: CardType = { ...selectedCardTemplate!, id: crypto.randomUUID() };
        const isDuplicateInStorage = gameState.storage.some(c => c.name === newCard.name && c.rarity === newCard.rarity);

        if (isDuplicateInStorage) {
            setDuplicateToSell(newCard);
        } else {
            if (settings.animationsOn) {
                setPackCard(newCard);
            } else {
                setMessageModal({ title: 'You Got a Card!', message: `You packed ${newCard.name} (${newCard.ovr})!`, card: newCard });
                updateGameState({ storage: [...gameState.storage, newCard] });
            }
        }
    }, [gameState, isDevMode, settings.animationsOn, trackEvolutionTask, playSfx, trackObjectiveProgress]);

    const handlePackAnimationEnd = (card: CardType) => {
        setPackCard(null);
        setMessageModal({ title: 'You Got a Card!', message: `You packed ${card.name} (${card.ovr})!`, card: card });
        updateGameState({ storage: [...gameState.storage, card] });
    };

    const handleBuyCard = (card: MarketCard) => {
        const isDuplicateInStorage = gameState.storage.some(c => c.name === card.name && c.rarity === card.rarity);
        if (isDuplicateInStorage) {
            setMessageModal({ title: "Cannot Buy Card", message: "You already own a copy of this card in your storage." });
            return;
        }
        if (gameState.coins < card.price) {
            setMessageModal({ title: "Not Enough Coins", message: "You can't afford this card." });
            return;
        }
        playSfx('purchase');
        updateGameState({
            coins: gameState.coins - card.price,
            storage: [...gameState.storage, card],
            market: gameState.market.filter(c => c.id !== card.id),
        });
        trackObjectiveProgress('buy_market_cards', 1);
    };

    const handleListCard = (card: CardType, price: number) => {
        const newMarketCard: MarketCard = { ...card, price, sellerId: gameState.userId };
        setMessageModal({ title: "Card Listed", message: `${card.name} is now on the market for ${price} coins.`});

        const newFormation = { ...gameState.formation };
        const positionKey = Object.keys(newFormation).find(key => newFormation[key]?.id === card.id);
        if (positionKey) newFormation[positionKey] = null;

        updateGameState({
            market: [...gameState.market, newMarketCard],
            storage: gameState.storage.filter(c => c.id !== card.id),
            formation: newFormation,
        });
        setCardToList(null);
        trackEvolutionTask('list_cards_market', 1);
        trackObjectiveProgress('list_market_cards', 1);
    };

    const handleQuickSell = (card: CardType) => {
        const sellValue = calculateQuickSellValue(card);
        const newFormation = { ...gameState.formation };
        const positionKey = Object.keys(newFormation).find(key => newFormation[key]?.id === card.id);
        if (positionKey) newFormation[positionKey] = null;

        updateGameState({
            coins: gameState.coins + sellValue,
            storage: gameState.storage.filter(c => c.id !== card.id),
            formation: newFormation,
        });
        setMessageModal({ title: "Card Sold", message: `You sold ${card.name} for ${sellValue} coins.` });
        setCardWithOptions(null);
        if (card.rarity === 'gold') trackEvolutionTask('quicksell_gold_card', 1);
    };
    
    const handleFbcSubmit = (challengeId: string, submittedCards: CardType[]) => {
        const challenge = fbcData.find(f => f.id === challengeId);
        if (!challenge) return;
        
        playSfx('rewardClaimed');
        const submittedIds = new Set(submittedCards.map(c => c.id));
        const newFormation = { ...gameState.formation };
        Object.keys(newFormation).forEach(key => {
            if (newFormation[key] && submittedIds.has(newFormation[key]!.id)) newFormation[key] = null;
        });

        updateGameState({
            formation: newFormation,
            storage: gameState.storage.filter(c => !submittedIds.has(c.id)),
            completedFbcIds: [...gameState.completedFbcIds, challengeId],
        });
        trackObjectiveProgress('complete_fbcs', 1);

        if (challenge.reward.type === 'pack' && challenge.reward.details) {
            handleOpenPack(challenge.reward.details, true);
            setMessageModal({ title: 'FBC Complete!', message: `You earned a ${challenge.reward.details} pack!` });
        } else if (challenge.reward.type === 'card' && challenge.reward.cardId) {
            const rewardCardTemplate = allCards.find(c => c.id === challenge.reward.cardId);
            if (rewardCardTemplate) {
                const newCardInstance: CardType = { ...rewardCardTemplate, id: crypto.randomUUID() };
                const isDuplicate = gameState.storage.some(c => c.name === newCardInstance.name && c.rarity === newCardInstance.rarity);
                if (isDuplicate) {
                    setDuplicateToSell(newCardInstance);
                } else {
                    updateGameState({ storage: [...gameState.storage, newCardInstance] });
                    setMessageModal({ title: 'FBC Complete!', message: `You unlocked ${newCardInstance.name}!`, card: newCardInstance });
                }
            }
        }
    };

    const handleStartEvo = (evoId: string, cardId: string) => {
        const evo = evoData.find(e => e.id === evoId);
        if (!evo) return;
        const initialTasks: Record<string, number> = {};
        evo.tasks.forEach(t => initialTasks[t.id] = 0);
        updateGameState({ activeEvolution: { evoId, cardId, tasks: initialTasks }});
        setMessageModal({ title: 'Evolution Started!', message: 'Your card is now evolving. Complete the tasks to upgrade it.' });
    };
    
    const handleClaimEvo = () => {
        const { activeEvolution } = gameState;
        if (!activeEvolution) return;
        const evo = evoData.find(e => e.id === activeEvolution.evoId);
        const resultCardTemplate = allCards.find(c => c.id === evo?.resultCardId);
        if (!evo || !resultCardTemplate) return;
    
        playSfx('rewardClaimed');
        const newEvolvedCard: CardType = { ...resultCardTemplate, id: crypto.randomUUID() };
        const newFormation = { ...gameState.formation };
        const newStorage = [...gameState.storage];
        let cardFound = false;
    
        const positionKey = Object.keys(newFormation).find(key => newFormation[key]?.id === activeEvolution.cardId);
        if (positionKey) {
            newFormation[positionKey] = newEvolvedCard;
            cardFound = true;
        } else {
            const storageIndex = newStorage.findIndex(c => c.id === activeEvolution.cardId);
            if (storageIndex > -1) {
                newStorage.splice(storageIndex, 1, newEvolvedCard);
                cardFound = true;
            }
        }
        
        if (cardFound) {
            updateGameState({ 
                formation: newFormation, 
                storage: newStorage, 
                activeEvolution: null,
                completedEvoIds: [...(gameState.completedEvoIds || []), evo.id] 
            });
            setMessageModal({ title: 'Evolution Complete!', message: `${resultCardTemplate.name} has been upgraded!`, card: newEvolvedCard });
            trackObjectiveProgress('complete_evos', 1);
        }
    };

    const handleClaimObjectiveReward = (objectiveId: string) => {
        const objective = objectivesData.find(o => o.id === objectiveId);
        if (!objective) return;

        const progress = gameState.objectiveProgress[objectiveId];
        if (!progress || progress.progress < objective.target || progress.claimed) return;

        playSfx('rewardClaimed');
        let rewardMessage = '';
        const updates: Partial<GameState> = {};

        if (objective.reward.type === 'coins' && objective.reward.amount) {
            updates.coins = gameState.coins + objective.reward.amount;
            rewardMessage = `You claimed ${objective.reward.amount} coins!`;
        } else if (objective.reward.type === 'pack' && objective.reward.packType) {
            handleOpenPack(objective.reward.packType, true);
        }

        const newObjectiveProgress = { ...gameState.objectiveProgress };
        newObjectiveProgress[objectiveId] = { ...progress, claimed: true };
        updates.objectiveProgress = newObjectiveProgress;

        updateGameState(updates);
        if (rewardMessage) {
            setMessageModal({ title: 'Objective Complete!', message: rewardMessage });
        }
    };

    const handleQuickSellDuplicate = () => {
        if (!duplicateToSell) return;
        const sellValue = calculateQuickSellValue(duplicateToSell);
        updateGameState({ coins: gameState.coins + sellValue });
        setMessageModal({ title: 'Duplicate Sold', message: `You sold the duplicate ${duplicateToSell.name} for ${sellValue} coins.` });
        setDuplicateToSell(null);
    };
    
    const handleClaimDailyReward = (rewardType: 'coins' | 'pack' | 'card') => {
        let rewardMessage = '';
        const updates: Partial<GameState> = { lastRewardClaimTime: Date.now() };

        if (rewardType === 'coins') {
            updates.coins = gameState.coins + 1000;
            rewardMessage = 'You received 1000 coins!';
        } else if (rewardType === 'pack') {
            const possiblePacks: PackType[] = ['builder', 'special'];
            const chosenPack = possiblePacks[Math.floor(Math.random() * possiblePacks.length)];
            handleOpenPack(chosenPack, true);
        } else if (rewardType === 'card') {
            const possibleCards = allCards.filter(c => c.value <= 5000);
            const newCard: CardType = { ...possibleCards[Math.floor(Math.random() * possibleCards.length)], id: crypto.randomUUID() };
            const isDuplicateInStorage = gameState.storage.some(c => c.name === newCard.name && c.rarity === newCard.rarity);
            if (isDuplicateInStorage) {
                const sellValue = calculateQuickSellValue(newCard);
                updates.coins = (gameState.coins || 0) + sellValue;
                rewardMessage = `The random card '${newCard.name}' was a duplicate and was sold for ${sellValue} coins.`;
            } else {
                updates.storage = [...gameState.storage, newCard];
                setMessageModal({ title: 'You Got a Card!', message: `You received a random card: ${newCard.name} (${newCard.ovr})!`, card: newCard });
            }
        }

        updateGameState(updates);
        if (rewardMessage) setMessageModal({ title: 'Daily Reward Claimed!', message: rewardMessage });
        setIsDailyRewardModalOpen(false);
    };

    const renderView = () => {
        switch (currentView) {
            case 'store':
                return <Store onOpenPack={(packType) => handleOpenPack(packType, false)} gameState={gameState} isDevMode={isDevMode} t={t} />;
            case 'collection':
                return <Collection gameState={gameState} setGameState={updateGameState} setCardForOptions={setCardWithOptions} t={t} />;
            case 'market':
                return <Market market={gameState.market} onBuyCard={handleBuyCard} currentUserId={gameState.userId} t={t} />;
            case 'battle':
                return <Battle t={t} />;
            case 'fbc':
                 return <FBC gameState={gameState} onFbcSubmit={handleFbcSubmit} t={t} playSfx={playSfx} />;
            case 'evo':
                 return <Evo gameState={gameState} onStartEvo={handleStartEvo} onClaimEvo={handleClaimEvo} t={t} playSfx={playSfx} />;
            case 'objectives':
                 return <Objectives gameState={gameState} onClaimReward={handleClaimObjectiveReward} t={t} />;
            default:
                return null;
        }
    };

    return (
        <div className={`App font-main bg-dark-gray min-h-screen text-white ${lang === 'ar' ? 'font-ar' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            
            {appState === 'welcome' && <WelcomeScreen onStart={() => setAppState('intro')} onHowToPlay={() => setIsHowToPlayOpen(true)} />}
            {appState === 'intro' && <IntroVideo onSkip={() => setAppState('game')} />}
            
            {appState === 'game' && (
                <>
                    <Particles />
                    <Header gameState={gameState} onToggleDevMode={handleToggleDevMode} isDevMode={isDevMode} onOpenSettings={() => setIsSettingsOpen(true)} lang={lang} setLang={setLang} t={t} />
                    <main className="container mx-auto px-4 pb-8">
                        <Navigation currentView={currentView} setCurrentView={setCurrentView} t={t} />
                        {renderView()}
                    </main>
                </>
            )}

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} updateSettings={updateSettings} t={t} />
            <HowToPlayModal isOpen={isHowToPlayOpen} onClose={() => setIsHowToPlayOpen(false)} t={t} />
            
            {messageModal && <MessageModal isOpen={!!messageModal} onClose={() => setMessageModal(null)} title={messageModal.title} message={messageModal.message} card={messageModal.card} />}
            {packCard && settings.animationsOn && <PackAnimationModal card={packCard} onAnimationEnd={handlePackAnimationEnd} playSfx={playSfx} />}
            
            <CardOptionsModal
                cardWithOptions={cardWithOptions}
                onClose={() => setCardWithOptions(null)}
                onListCard={(card) => { setCardToList(card); setCardWithOptions(null); }}
                onQuickSell={handleQuickSell}
                t={t}
            />

            <MarketModal
                cardToList={cardToList}
                onClose={() => setCardToList(null)}
                onList={handleListCard}
                t={t}
            />

            <DuplicateSellModal
                card={duplicateToSell}
                onSell={handleQuickSellDuplicate}
                t={t}
            />
            
            <DailyRewardModal 
                isOpen={isDailyRewardModalOpen}
                onClaim={handleClaimDailyReward}
            />

        </div>
    );
};

export default App;
