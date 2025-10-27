import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GameState, Card as CardType, FormationLayoutId } from '../../types';
import { formationLayouts } from '../../data/gameData';
import Card from '../Card';
import { TranslationKey } from '../../utils/translations';

interface CollectionProps {
    gameState: GameState;
    onFormationUpdate: (updates: {
        newFormation: Record<string, CardType | null>,
        movedToStorage: CardType[],
        movedFromStorage: CardType[]
    }) => void;
    onLayoutChange: (newLayoutId: FormationLayoutId) => void;
    setCardForOptions: (details: { card: CardType; origin: 'formation' | 'storage' } | null) => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

type DraggedCardInfo = {
    card: CardType;
    origin: 'formation' | 'storage';
    positionId?: string;
};

const Collection: React.FC<CollectionProps> = ({ gameState, onFormationUpdate, onLayoutChange, setCardForOptions, t }) => {
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

    const handleDragStart = (e: React.DragEvent, card: CardType, origin: 'formation' | 'storage', positionId?: string) => {
        if (gameState.activeEvolution?.cardId === card.id) {
            e.preventDefault();
            return;
        }
        
        e.dataTransfer.effectAllowed = 'move';
        
        setDraggedCard({ card, origin, positionId });
        setDraggingCardId(card.uid || card.id);
    };

    const handleDrop = (targetArea: 'formation' | 'storage', targetPositionId?: string) => {
        if (!draggedCard) return;
    
        let newFormation = { ...gameState.formation };
        const movedToStorage: CardType[] = [];
        const movedFromStorage: CardType[] = [];
        
        const { card: movedCard, origin, positionId: sourcePositionId } = draggedCard;
    
        if (origin === 'storage' && targetArea === 'formation' && targetPositionId) {
            const displacedCard = newFormation[targetPositionId];
            newFormation[targetPositionId] = movedCard;
            movedFromStorage.push(movedCard);
            if (displacedCard) {
                movedToStorage.push(displacedCard);
            }
        }
        else if (origin === 'formation' && targetArea === 'storage' && sourcePositionId) {
            newFormation[sourcePositionId] = null;
            movedToStorage.push(movedCard);
        }
        else if (origin === 'formation' && targetArea === 'formation' && sourcePositionId && targetPositionId) {
            const targetCard = newFormation[targetPositionId];
            newFormation[targetPositionId] = movedCard;
            newFormation[sourcePositionId] = targetCard;
        }
    
        onFormationUpdate({ newFormation, movedToStorage, movedFromStorage });
        
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
             <div className="controls-bar flex justify-between items-center mb-4 flex-wrap gap-4">
                <div className="formation-stats flex gap-5 items-center">
                    <h3 className="text-xl">{t('formation')} ({formationCardCount}/11)</h3>
                    <h3 className="text-xl">Rating: <span className="text-gold-light">{formationRating}</span></h3>
                </div>
                <div>
                    <select
                        id="formation-layout-selector"
                        value={gameState.formationLayout}
                        onChange={e => onLayoutChange(e.target.value as FormationLayoutId)}
                        className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md"
                    >
                        {Object.values(formationLayouts).map(layout => (
                            <option key={layout.name} value={layout.name}>{layout.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="formation-pitch">
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
                                        className={`${gameState.activeEvolution?.cardId === gameState.formation[pos.id]?.id ? 'cursor-not-allowed' : 'cursor-grab'} ${draggingCardId === (gameState.formation[pos.id]?.uid || gameState.formation[pos.id]?.id) ? 'opacity-40' : ''}`}
                                    >
                                        <Card card={gameState.formation[pos.id]!} origin="formation" isEvolving={gameState.activeEvolution?.cardId === gameState.formation[pos.id]?.id} className="!w-[90px] !h-[135px]" />
                                    </div>
                                ) : (
                                    <>
                                        <span className="opacity-50">{pos.label}</span>
                                        <div className="position-slot-label">{pos.label}</div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="controls-bar flex justify-between items-center mt-6 mb-4 flex-wrap gap-4">
                <h3 className="text-xl">{t('storage')} ({gameState.storage.length})</h3>
                <div className="filter-group flex gap-2 items-center">
                    <select id="filter-collection-rarity" value={rarityFilter} onChange={e => setRarityFilter(e.target.value)} className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md">
                        <option value="all">All Rarities</option>
                        <option value="bronze">Bronze</option>
                        <option value="silver">Silver</option>
                        <option value="gold">Gold</option>
                        <option value="rotm">ROTM</option>
                        <option value="icon">Icon</option>
                        <option value="legend">Legend</option>
                        <option value="event">Event</option>
                    </select>
                    <select id="sort-collection" value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md">
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
                className={`storage-container grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6 justify-items-center p-4 rounded-lg min-h-[300px] bg-black/30 border border-gold-dark/30 transition-all duration-300 ${isOverStorage ? 'is-over-storage' : ''}`}
            >
                {sortedAndFilteredStorage.map(card => (
                     <div 
                        key={card.uid || card.id}
                        draggable={gameState.activeEvolution?.cardId !== card.id}
                        onDragStart={(e) => handleDragStart(e, card, 'storage')} 
                        onClick={() => handleCardClick(card, 'storage')}
                        className={`${gameState.activeEvolution?.cardId === card.id ? 'cursor-not-allowed' : 'cursor-grab'} ${draggingCardId === (card.uid || card.id) ? 'opacity-40' : ''}`}
                     >
                        <Card card={card} origin="storage" isEvolving={gameState.activeEvolution?.cardId === card.id} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Collection;
