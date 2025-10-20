import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { GameState, Card as CardType, FormationLayoutId } from '../../types';
import { formationLayouts } from '../../data/gameData';
import Card from '../Card';
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

const Collection: React.FC<CollectionProps> = ({ gameState, setGameState, setCardForOptions, t }) => {
    const [draggedCard, setDraggedCard] = useState<DraggedCardInfo | null>(null);
    const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
    const [dragOverPosition, setDragOverPosition] = useState<string | null>(null);
    const [isOverStorage, setIsOverStorage] = useState(false);
    const [sortBy, setSortBy] = useState('value-desc');
    const [rarityFilter, setRarityFilter] = useState('all');

    const ghostRef = useRef<HTMLElement | null>(null);
    const draggedInfoRef = useRef<DraggedCardInfo | null>(null);
    const lastTouchTargetRef = useRef<Element | null>(null);

    const formationCardCount = useMemo(() => Object.values(gameState.formation).filter(Boolean).length, [gameState.formation]);

    const formationRating = useMemo(() => {
        if (formationCardCount === 0) return '-';
        // FIX: Explicitly type the 'sum' accumulator as a number to prevent type inference issues.
        const totalOvr = Object.values(gameState.formation).reduce((sum: number, card) => sum + (card?.ovr || 0), 0);
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
    
    const handleDrop = useCallback((cardInfo: DraggedCardInfo, targetArea: 'formation' | 'storage', targetPositionId?: string) => {
        let newFormation = { ...gameState.formation };
        let newStorage = [...gameState.storage];
        const { card: MovedCard, origin, positionId: sourcePositionId } = cardInfo;

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
            const targetCard = newFormation[targetPositionId];
            newFormation[targetPositionId] = MovedCard;
            newFormation[sourcePositionId] = targetCard;
        }

        setGameState({ formation: newFormation, storage: newStorage });
    }, [gameState.formation, gameState.storage, setGameState]);

    const handleMouseDrop = (targetArea: 'formation' | 'storage', targetPositionId?: string) => {
        if (!draggedCard) return;
        handleDrop(draggedCard, targetArea, targetPositionId);
        cleanupDragState();
    };

    const handleDragEnd = useCallback(() => {
        cleanupDragState();
    }, [cleanupDragState]);

    useEffect(() => {
        document.addEventListener('dragend', handleDragEnd);
        return () => {
            document.removeEventListener('dragend', handleDragEnd);
        };
    }, [handleDragEnd]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        if (!ghostRef.current || !touch) return;

        ghostRef.current.style.transform = `translate(${touch.pageX}px, ${touch.pageY}px) translate(-50%, -50%)`;

        ghostRef.current.style.display = 'none';
        const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        ghostRef.current.style.display = 'block';
        lastTouchTargetRef.current = elementUnder;

        if (elementUnder) {
            const positionSlot = elementUnder.closest('.position-slot');
            const storageContainer = elementUnder.closest('#storage-container');
            if (positionSlot) {
                const posId = positionSlot.getAttribute('data-position-id');
                setDragOverPosition(posId);
                setIsOverStorage(false);
            } else if (storageContainer && draggedInfoRef.current?.origin === 'formation') {
                setIsOverStorage(true);
                setDragOverPosition(null);
            } else {
                setDragOverPosition(null);
                setIsOverStorage(false);
            }
        } else {
            setDragOverPosition(null);
            setIsOverStorage(false);
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        if (lastTouchTargetRef.current && draggedInfoRef.current) {
            const positionSlot = lastTouchTargetRef.current.closest('.position-slot');
            const storageContainer = lastTouchTargetRef.current.closest('#storage-container');
            if (positionSlot) {
                const posId = positionSlot.getAttribute('data-position-id');
                if (posId) handleDrop(draggedInfoRef.current, 'formation', posId);
            } else if (storageContainer) {
                handleDrop(draggedInfoRef.current, 'storage');
            }
        }
        if (ghostRef.current) {
            ghostRef.current.remove();
            ghostRef.current = null;
        }
        draggedInfoRef.current = null;
        lastTouchTargetRef.current = null;
        cleanupDragState();
    }, [handleTouchMove, handleDrop, cleanupDragState]);

    const handleTouchStart = (e: React.TouchEvent, card: CardType, origin: 'formation' | 'storage', positionId?: string) => {
        if (gameState.activeEvolution?.cardId === card.id) return;
        draggedInfoRef.current = { card, origin, positionId };
        setDraggingCardId(card.id);
        const cardElement = e.currentTarget;
        const rect = cardElement.getBoundingClientRect();
        const ghost = cardElement.cloneNode(true) as HTMLElement;
        ghost.style.position = 'fixed';
        ghost.style.top = '0px';
        ghost.style.left = '0px';
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '1000';
        ghost.style.opacity = '0.8';
        ghost.style.transition = 'none';
        ghost.style.transform = `translate(${e.touches[0].pageX}px, ${e.touches[0].pageY}px) translate(-50%, -50%) scale(1.1)`;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { once: true });
    };

    const handleLayoutChange = (newLayoutId: FormationLayoutId) => {
        const currentCards = Object.values(gameState.formation).filter(Boolean) as CardType[];
        const newLayout = formationLayouts[newLayoutId];
        const newFormation: Record<string, CardType | null> = {};
        newLayout.allPositions.forEach(posId => { newFormation[posId] = null; });
        const newStorage = [...gameState.storage, ...currentCards];
        setGameState({ formationLayout: newLayoutId, formation: newFormation, storage: newStorage });
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

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, positionId?: string) => {
        e.preventDefault();
        if (positionId) setDragOverPosition(positionId);
    };

    const handleDragEnterStorage = (e: React.DragEvent) => {
        e.preventDefault();
        if (draggedCard?.origin === 'formation') setIsOverStorage(true);
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
                        onChange={e => handleLayoutChange(e.target.value as FormationLayoutId)}
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
                                data-position-id={pos.id}
                                onDrop={() => handleMouseDrop('formation', pos.id)}
                                onDragOver={(e) => handleDragOver(e, pos.id)}
                                onDragLeave={() => setDragOverPosition(null)}
                                className={`position-slot ${dragOverPosition === pos.id ? 'is-over' : ''}`}
                             >
                                {gameState.formation[pos.id] ? (
                                    <div
                                        draggable={gameState.activeEvolution?.cardId !== gameState.formation[pos.id]?.id}
                                        onDragStart={(e) => handleDragStart(e, gameState.formation[pos.id]!, 'formation', pos.id)}
                                        onTouchStart={(e) => handleTouchStart(e, gameState.formation[pos.id]!, 'formation', pos.id)}
                                        onClick={() => handleCardClick(gameState.formation[pos.id]!, 'formation')}
                                        className={`${gameState.activeEvolution?.cardId === gameState.formation[pos.id]?.id ? 'cursor-not-allowed' : 'cursor-grab'} ${draggingCardId === gameState.formation[pos.id]?.id ? 'opacity-40' : ''}`}
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
                <h3 className="text-xl">{t('storage')} ({gameState.storage.length}/50)</h3>
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
                onDrop={() => handleMouseDrop('storage')}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={handleDragEnterStorage}
                onDragLeave={handleDragLeaveStorage}
                className={`storage-container grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6 justify-items-center p-4 rounded-lg min-h-[300px] bg-black/30 border border-gold-dark/30 transition-all duration-300 ${isOverStorage ? 'is-over-storage' : ''}`}
            >
                {sortedAndFilteredStorage.map(card => (
                     <div 
                        key={card.id} 
                        draggable={gameState.activeEvolution?.cardId !== card.id}
                        onDragStart={(e) => handleDragStart(e, card, 'storage')} 
                        onTouchStart={(e) => handleTouchStart(e, card, 'storage')}
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