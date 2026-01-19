
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GameState, Card as CardType, FormationLayoutId } from '../../types';
import { formationLayouts } from '../../data/gameData';
import Card from '../Card';
import Button from '../Button';
import { TranslationKey } from '../../utils/translations';

interface CollectionProps {
    gameState: GameState;
    setGameState: (updates: Partial<GameState>) => void;
    setCardForOptions: (details: { card: CardType; origin: 'formation' | 'storage' } | null) => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

type DraggedCardInfo = {
    card: CardType;
    origin: 'formation' | 'storage';
    positionId?: string;
};

// Helper to determine role from position ID
const getRole = (posId: string): string => {
    if (posId.includes('gk')) return 'gk';
    if (['lb', 'rb', 'cb', 'lwb', 'rwb'].some(s => posId.includes(s))) return 'def';
    if (['cm', 'lm', 'rm', 'cdm', 'cam'].some(s => posId.includes(s))) return 'mid';
    if (['st', 'cf', 'lw', 'rw'].some(s => posId.includes(s))) return 'att';
    return 'any';
};

const Collection: React.FC<CollectionProps> = ({ gameState, setGameState, setCardForOptions, t }) => {
    const [draggedCard, setDraggedCard] = useState<DraggedCardInfo | null>(null);
    const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
    const [dragOverPosition, setDragOverPosition] = useState<string | null>(null);
    const [isOverStorage, setIsOverStorage] = useState(false);
    const [sortBy, setSortBy] = useState('value-desc');
    const [rarityFilter, setRarityFilter] = useState('all');

    const formationCardCount = useMemo(() => Object.values(gameState.formation).filter(Boolean).length, [gameState.formation]);

    const formationRating = useMemo(() => {
        if (formationCardCount === 0) return '-';
        let totalOvr = 0;
        for (const posId of Object.keys(gameState.formation)) {
            const card = gameState.formation[posId];
            if (card) {
                totalOvr += card.ovr;
            }
        }
        return Math.round(totalOvr / formationCardCount);
    }, [gameState.formation, formationCardCount]);

    const sortedAndFilteredStorage = useMemo(() => {
        let storage = [...gameState.storage];
        if (rarityFilter !== 'all') {
            storage = storage.filter(card => card.rarity === rarityFilter);
        }
        storage.sort((a, b) => {
            switch (sortBy) {
                case 'value-desc': return b.value - a.value;
                case 'value-asc': return a.value - b.value;
                case 'name-asc': return a.name.localeCompare(b.name);
                default: return 0;
            }
        });
        return storage;
    }, [gameState.storage, sortBy, rarityFilter]);
    
    const cleanupDragState = useCallback(() => {
        setDraggedCard(null);
        setDraggingCardId(null);
        setDragOverPosition(null);
        setIsOverStorage(false);
    }, []);

    const handleDragEnd = useCallback(() => {
        cleanupDragState();
    }, [cleanupDragState]);

    useEffect(() => {
        document.addEventListener('dragend', handleDragEnd);
        return () => {
            document.removeEventListener('dragend', handleDragEnd);
        };
    }, [handleDragEnd]);

    // Smart migration when changing formation
    const handleLayoutChange = (newLayoutId: FormationLayoutId) => {
        if (newLayoutId === gameState.formationLayout) return;

        const currentFormation = gameState.formation;
        const newLayout = formationLayouts[newLayoutId];
        const newFormation: Record<string, CardType | null> = {};
        
        // Initialize new formation positions
        newLayout.allPositions.forEach(pos => newFormation[pos] = null);

        // Buckets for migration
        let gkCard: CardType | null = null;
        const fieldPlayers: CardType[] = [];

        // Harvest current cards
        Object.keys(currentFormation).forEach(posId => {
            const card = currentFormation[posId];
            if (!card) return;
            if (getRole(posId) === 'gk') gkCard = card;
            else fieldPlayers.push(card);
        });

        // 1. Fill GK
        const newGkPos = newLayout.allPositions.find(p => getRole(p) === 'gk');
        if (newGkPos && gkCard) {
            newFormation[newGkPos] = gkCard;
        } else if (gkCard) {
            // Should not happen as all formations have GK, but safely return to storage
            fieldPlayers.push(gkCard); 
        }

        // 2. Fill Field Players strictly sequentially into available slots
        // This ignores roles (DEF/MID/ATT) temporarily to prioritize keeping cards in the squad
        const newFieldPositions = newLayout.allPositions.filter(p => getRole(p) !== 'gk');
        
        newFieldPositions.forEach(posId => {
            if (fieldPlayers.length > 0) {
                newFormation[posId] = fieldPlayers.shift()!;
            }
        });

        // Any cards still not placed return to storage
        
        setGameState({
            formationLayout: newLayoutId,
            formation: newFormation,
            storage: [...gameState.storage, ...fieldPlayers]
        });
    };
    
    const handleClearFormation = () => {
        if (!window.confirm("Are you sure you want to clear your formation? All players will be moved to storage.")) return;
        
        const cardsToReturn: CardType[] = [];
        const newFormation = { ...gameState.formation };
        
        Object.keys(newFormation).forEach(key => {
            if (newFormation[key]) {
                cardsToReturn.push(newFormation[key]!);
                newFormation[key] = null;
            }
        });

        setGameState({
            formation: newFormation,
            storage: [...gameState.storage, ...cardsToReturn]
        });
    };

    const handleDragStart = (e: React.DragEvent, card: CardType, origin: 'formation' | 'storage', positionId?: string) => {
        if (gameState.activeEvolution?.cardId === card.id) {
            e.preventDefault();
            return;
        }
        
        e.dataTransfer.effectAllowed = 'move';
        
        setDraggedCard({ card, origin, positionId });
        setDraggingCardId(card.id);
    };

    const handleDrop = (targetArea: 'formation' | 'storage', targetPositionId?: string) => {
        if (!draggedCard) return;

        let newFormation = { ...gameState.formation };
        let newStorage = [...gameState.storage];
        const { card: MovedCard, origin, positionId: sourcePositionId } = draggedCard;

        if (origin === 'storage' && targetArea === 'formation' && targetPositionId) {
            const displacedCard = newFormation[targetPositionId];
            newFormation[targetPositionId] = MovedCard;
            newStorage = newStorage.filter(c => c.id !== MovedCard.id);
            if (displacedCard) {
                newStorage.push(displacedCard);
            }
        }
        else if (origin === 'formation' && targetArea === 'storage' && sourcePositionId) {
            newFormation[sourcePositionId] = null;
            newStorage.push(MovedCard);
        }
        else if (origin === 'formation' && targetArea === 'formation' && sourcePositionId && targetPositionId) {
            // Swap cards in formation
            const targetCard = newFormation[targetPositionId];
            newFormation[targetPositionId] = MovedCard;
            newFormation[sourcePositionId] = targetCard;
        }
        
        // Note: 'storage' to 'storage' drag is handled by simply re-sorting via the view, 
        // but if we wanted manual sorting we'd need more logic. 
        // For now, dropping on storage just ensures it's in storage (no-op if already there).

        setGameState({ formation: newFormation, storage: newStorage });
        cleanupDragState();
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, positionId?: string) => {
        e.preventDefault();
        if (positionId) {
            setDragOverPosition(positionId);
        }
    };

    const handleDragEnterStorage = (e: React.DragEvent) => {
        e.preventDefault();
        if (draggedCard?.origin === 'formation') {
            setIsOverStorage(true);
        }
    };

    const handleDragLeaveStorage = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOverStorage(false);
    };
    
    const handleCardClick = (card: CardType, origin: 'formation' | 'storage') => {
        if (gameState.activeEvolution?.cardId === card.id) return;
        setCardForOptions({ card, origin });
    };

    const currentLayout = formationLayouts[gameState.formationLayout];

    return (
        <div className="animate-fadeIn">
             <div className="controls-bar flex flex-col md:flex-row justify-between items-center mb-4 gap-4 bg-black/20 p-4 rounded-lg">
                <div className="formation-stats flex gap-6 items-center">
                    <div>
                        <h3 className="text-gray-400 text-sm uppercase tracking-wide">{t('formation')}</h3>
                        <span className="text-2xl text-white font-header">{formationCardCount}/11</span>
                    </div>
                    <div>
                        <h3 className="text-gray-400 text-sm uppercase tracking-wide">Rating</h3>
                        <span className="text-2xl text-gold-light font-header">{formationRating}</span>
                    </div>
                </div>
                
                <div className="flex gap-2 items-center w-full md:w-auto">
                    <select
                        id="formation-layout-selector"
                        value={gameState.formationLayout}
                        onChange={e => handleLayoutChange(e.target.value as FormationLayoutId)}
                        className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md flex-grow md:flex-grow-0"
                    >
                        {Object.values(formationLayouts).map(layout => (
                            <option key={layout.name} value={layout.name}>{layout.name}</option>
                        ))}
                    </select>
                    <Button variant="sell" onClick={handleClearFormation} className="!py-2 !px-3 text-sm whitespace-nowrap">
                        Clear Squad
                    </Button>
                </div>
            </div>

            <div className="formation-pitch mb-8">
                {['attackers', 'midfielders', 'defenders', 'goalkeeper'].map(rowKey => (
                    <div key={rowKey} className="formation-row">
                        {currentLayout.positions[rowKey as keyof typeof currentLayout.positions].map(pos => (
                             <div 
                                key={pos.id}
                                onDrop={() => handleDrop('formation', pos.id)}
                                onDragOver={(e) => handleDragOver(e, pos.id)}
                                onDragLeave={() => setDragOverPosition(null)}
                                className={`position-slot ${dragOverPosition === pos.id ? 'is-over' : ''}`}
                             >
                                {gameState.formation[pos.id] ? (
                                    <div
                                        draggable={gameState.activeEvolution?.cardId !== gameState.formation[pos.id]?.id}
                                        onDragStart={(e) => handleDragStart(e, gameState.formation[pos.id]!, 'formation', pos.id)}
                                        onClick={() => handleCardClick(gameState.formation[pos.id]!, 'formation')}
                                        className={`${gameState.activeEvolution?.cardId === gameState.formation[pos.id]?.id ? 'cursor-not-allowed' : 'cursor-grab'} ${draggingCardId === gameState.formation[pos.id]?.id ? 'opacity-40' : ''}`}
                                    >
                                        <Card card={gameState.formation[pos.id]!} origin="formation" isEvolving={gameState.activeEvolution?.cardId === gameState.formation[pos.id]?.id} className="!w-[90px] !h-[135px]" />
                                    </div>
                                ) : (
                                    <>
                                        <span className="opacity-50 text-2xl">{pos.label}</span>
                                        {/* <div className="position-slot-label">{pos.label}</div> */}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="controls-bar flex flex-col md:flex-row justify-between items-center mt-6 mb-4 gap-4">
                <h3 className="text-2xl font-header text-white">{t('storage')} ({gameState.storage.length})</h3>
                <div className="filter-group flex flex-col sm:flex-row gap-2 items-center w-full md:w-auto">
                    <select id="filter-collection-rarity" value={rarityFilter} onChange={e => setRarityFilter(e.target.value)} className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md w-full sm:w-auto">
                        <option value="all">All Rarities</option>
                        <option value="bronze">Bronze</option>
                        <option value="silver">Silver</option>
                        <option value="gold">Gold</option>
                        <option value="rotm">ROTM</option>
                        <option value="icon">Icon</option>
                        <option value="legend">Legend</option>
                        <option value="event">Event</option>
                    </select>
                    <select id="sort-collection" value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md w-full sm:w-auto">
                        <option value="value-desc">{t('sort_value_desc')}</option>
                        <option value="value-asc">{t('sort_value_asc')}</option>
                        <option value="name-asc">{t('sort_name_asc')}</option>
                    </select>
                </div>
            </div>
            
            <div 
                id="storage-container" 
                onDrop={() => handleDrop('storage')}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={handleDragEnterStorage}
                onDragLeave={handleDragLeaveStorage}
                className={`storage-container grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 justify-items-center p-4 rounded-lg min-h-[300px] bg-black/30 border border-gold-dark/30 transition-all duration-300 ${isOverStorage ? 'is-over-storage' : ''}`}
            >
                {sortedAndFilteredStorage.map(card => (
                     <div 
                        key={card.id} 
                        draggable={gameState.activeEvolution?.cardId !== card.id}
                        onDragStart={(e) => handleDragStart(e, card, 'storage')} 
                        onClick={() => handleCardClick(card, 'storage')}
                        className={`${gameState.activeEvolution?.cardId === card.id ? 'cursor-not-allowed' : 'cursor-grab'} ${draggingCardId === card.id ? 'opacity-40' : ''}`}
                     >
                        <Card card={card} origin="storage" isEvolving={gameState.activeEvolution?.cardId === card.id} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Collection;
