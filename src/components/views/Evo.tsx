import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TranslationKey } from '../../utils/translations';
import { GameState, Card as CardType, Evolution } from '../../types';
import { evoData, allCards } from '../../data/gameData';
import Button from '../Button';
import Card from '../Card';
import { sfx } from '../../data/sounds';

interface EvoProps {
    gameState: GameState;
    onStartEvo: (evoId: string, cardId: string) => void;
    onClaimEvo: () => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
    playSfx: (soundKey: keyof typeof sfx) => void;
}

const isCardEligible = (card: CardType, eligibility: Evolution['eligibility']) => {
    if (eligibility.rarity && card.rarity !== eligibility.rarity) return false;
    if (eligibility.maxOvr && card.ovr > eligibility.maxOvr) return false;
    if (eligibility.cardName && card.name !== eligibility.cardName) return false;
    return true;
};

const Evo: React.FC<EvoProps> = ({ gameState, onStartEvo, onClaimEvo, t, playSfx }) => {
    const [selectedEvo, setSelectedEvo] = useState<Evolution | null>(null);
    const { activeEvolution } = gameState;

    const allPlayerCards = useMemo(() => [...Object.values(gameState.formation).filter(Boolean) as CardType[], ...gameState.storage], [gameState.formation, gameState.storage]);
    
    const availableEvos = useMemo(() => {
        return evoData.filter(evo => !(gameState.completedEvoIds || []).includes(evo.id));
    }, [gameState.completedEvoIds]);

    const completedEvos = useMemo(() => {
        return evoData.filter(evo => (gameState.completedEvoIds || []).includes(evo.id));
    }, [gameState.completedEvoIds]);
    
    const activeEvoDef = useMemo(() => {
        return activeEvolution ? evoData.find(e => e.id === activeEvolution.evoId) : null;
    }, [activeEvolution]);
    
    const allTasksComplete = useMemo(() => {
        if (!activeEvolution || !activeEvoDef) return false;
        return activeEvoDef.tasks.every(task => (activeEvolution.tasks[task.id] || 0) >= task.target);
    }, [activeEvolution, activeEvoDef]);

    const prevAllTasksComplete = useRef(false);
    useEffect(() => {
        if (allTasksComplete && !prevAllTasksComplete.current) {
            playSfx('tasksComplete');
        }
        prevAllTasksComplete.current = allTasksComplete;
    }, [allTasksComplete, playSfx]);


    if (activeEvolution && activeEvoDef) {
        const evolvingCard = allPlayerCards.find(c => c.id === activeEvolution.cardId);
        const resultCardTemplate = allCards.find(c => c.id === activeEvoDef?.resultCardId);

        if (!evolvingCard || !resultCardTemplate) return null; // Should not happen

        return (
            <div className="animate-fadeIn">
                <h2 className="font-header text-4xl text-white text-center mb-6">{t('evo_active')}</h2>
                <div className="flex flex-col lg:flex-row gap-6 bg-black/30 p-6 rounded-lg border border-blue-glow/50">
                    <div className="flex-grow-[2] flex flex-col items-center">
                         <h3 className="text-xl mb-4">{activeEvoDef.title}</h3>
                         <div className="flex justify-center items-center gap-2 md:gap-4">
                            <Card card={evolvingCard} isEvolving={true} />
                            <span className="text-2xl md:text-4xl text-gold-light font-header mx-2 md:mx-4">→</span>
                            <Card card={resultCardTemplate} />
                        </div>
                    </div>
                    <div className="flex-grow-[3]">
                         <h3 className="text-xl mb-2">{t('evo_tasks')}</h3>
                         <ul className="space-y-2 mb-6">
                            {activeEvoDef.tasks.map(task => {
                                const progress = activeEvolution.tasks[task.id] || 0;
                                const isMet = progress >= task.target;
                                return (
                                    <li key={task.id} className={`${isMet ? 'text-green-400 line-through' : 'text-gray-300'}`}>
                                        {task.description} ({Math.min(progress, task.target)}/{task.target})
                                    </li>
                                )
                            })}
                         </ul>
                         <Button variant="keep" onClick={onClaimEvo} disabled={!allTasksComplete}>{t('evo_claim_rewards')}</Button>
                    </div>
                </div>
            </div>
        )
    }

    if (selectedEvo) {
        const eligibleCards = allPlayerCards.filter(card => isCardEligible(card, selectedEvo.eligibility));
        return (
             <div className="animate-fadeIn">
                <button className="text-gold-light mb-4" onClick={() => setSelectedEvo(null)}>← {t('fbc_back')}</button>
                <h2 className="font-header text-3xl text-white text-center mb-4">{selectedEvo.title}</h2>
                 <div className="flex flex-col lg:flex-row gap-6">
                     <div className="flex-grow-[3]">
                         <h3 className="text-xl mb-2">{t('evo_choose_card')}</h3>
                         {eligibleCards.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-black/20 rounded-lg max-h-[600px] overflow-y-auto">
                                {eligibleCards.map(card => (
                                    <div key={card.id} onClick={() => onStartEvo(selectedEvo.id, card.id)} className="cursor-pointer">
                                        <Card card={card} />
                                    </div>
                                ))}
                            </div>
                         ) : (
                            <div className="flex items-center justify-center h-48 bg-black/20 rounded-lg">
                                <p className="text-gray-400">{t('evo_no_eligible')}</p>
                            </div>
                         )}
                     </div>
                      <div className="flex-grow-[2] bg-black/30 p-6 rounded-lg">
                        <h3 className="text-xl mb-2">{t('evo_requirements')}</h3>
                        <ul className="space-y-1 mb-4 text-gray-400">
                           {selectedEvo.eligibility.cardName && <li>Card must be: {selectedEvo.eligibility.cardName}</li>}
                           {selectedEvo.eligibility.rarity && <li className="capitalize">{t('evo_req_rarity', {rarity: selectedEvo.eligibility.rarity})}</li>}
                           {selectedEvo.eligibility.maxOvr && <li>{t('evo_req_max_ovr', {ovr: selectedEvo.eligibility.maxOvr})}</li>}
                        </ul>
                         <h3 className="text-xl mb-2">{t('evo_tasks')}</h3>
                         <ul className="space-y-1 mb-6 text-green-400">
                            {selectedEvo.tasks.map(task => <li key={task.id}>{task.description}</li>)}
                         </ul>
                    </div>
                 </div>
             </div>
        )
    }

    return (
        <div className="animate-fadeIn">
            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_evo')}</h2>
            <div className="space-y-4">
                {availableEvos.length > 0 ? availableEvos.map(evo => {
                    const baseCardTemplate = allCards.find(c => c.name === evo.eligibility.cardName && c.rarity === evo.eligibility.rarity);
                    const resultCardTemplate = allCards.find(c => c.id === evo.resultCardId);

                    if (!baseCardTemplate || !resultCardTemplate) return null;

                    return (
                        <div key={evo.id} onClick={() => setSelectedEvo(evo)} className="bg-gradient-to-br from-light-gray to-darker-gray p-5 rounded-lg border border-gold-dark/30 cursor-pointer transition-all duration-300 hover:border-gold-light hover:-translate-y-1">
                            <h3 className="font-header text-2xl text-gold-light">{evo.title}</h3>
                            <p className="text-gray-400 mb-4">{evo.description}</p>
                            <div className="flex justify-center items-center gap-2 md:gap-4 mt-4">
                                <Card card={baseCardTemplate} className="!w-[144px] !h-[216px] md:!w-[180px] md:!h-[270px]"/>
                                <span className="text-2xl md:text-4xl text-gold-light font-header mx-2 md:mx-4">→</span>
                                <Card card={resultCardTemplate} className="!w-[144px] !h-[216px] md:!w-[180px] md:!h-[270px]"/>
                            </div>
                        </div>
                    )
                }) : (
                    <p className="text-center text-gray-400 text-xl py-10">No new evolutions available.</p>
                )}
            </div>

            {completedEvos.length > 0 && (
                <div className="mt-8">
                    <h3 className="font-header text-2xl text-center mb-4">{t('evo_completed')}</h3>
                    <div className="space-y-4">
                    {completedEvos.map(evo => (
                        <div key={evo.id} className="bg-darker-gray/50 p-5 rounded-lg border border-green-500/30 opacity-60">
                            <h3 className="font-header text-2xl text-green-400 line-through">{evo.title}</h3>
                        </div>
                    ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Evo;