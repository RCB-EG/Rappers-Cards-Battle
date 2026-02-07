
import React, { useState, useEffect } from 'react';
import { GameState, Objective, PackType, Card as CardType } from '../../types';
import { playerPickConfigs } from '../../data/gameData';
import Button from '../Button';
import Card from '../Card';
import { TranslationKey } from '../../utils/translations';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

interface ObjectivesProps {
    gameState: GameState;
    onClaimReward: (objectiveId: string) => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
    allCards: CardType[];
    objectives: Objective[]; 
    isAdmin?: boolean;
}

const packImages: Record<PackType, string> = {
    free: 'https://i.postimg.cc/R0sYyFhL/Free.png',
    bronze: 'https://i.imghippo.com/files/KCG5562T.png',
    builder: 'https://i.postimg.cc/1z5Tv6mz/Builder.png',
    special: 'https://i.postimg.cc/sxS0M4cT/Special.png',
    legendary: 'https://i.postimg.cc/63Fm6md7/Legendary.png',
};

const formatTimeLeft = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const renderRewardText = (objective: Objective, t: ObjectivesProps['t'], allCards: CardType[]) => {
    const { reward } = objective;
    if (reward.type === 'coins') {
        return `${reward.amount} ${t('coins')}`;
    }
    if (reward.type === 'pack' && reward.packType) {
        return t(`pack_${reward.packType}` as TranslationKey) || reward.packType;
    }
    if (reward.type === 'card' && reward.cardId) {
        const card = allCards.find(c => c.id === reward.cardId);
        return card ? card.name : 'Card Reward';
    }
    if (reward.type === 'player_pick') {
        const pick = playerPickConfigs[reward.playerPickId!]
        return pick ? (pick.name || t(pick.nameKey as TranslationKey)) : 'Player Pick';
    }
    if (reward.type === 'coins_and_pick') {
        const pick = playerPickConfigs[reward.playerPickId!]
        return `${reward.amount} ${t('coins')} + ${pick ? (pick.name || t(pick.nameKey as TranslationKey)) : 'Pick'}`;
    }
    return 'Reward';
};

const ObjectiveGroup: React.FC<{
    titleKey: TranslationKey;
    titleOverride?: string;
    objectives: Objective[];
    gameState: GameState;
    onClaimReward: (objectiveId: string) => void;
    t: ObjectivesProps['t'];
    timerMs?: number;
    allCards: CardType[];
    isAdmin?: boolean;
    onToggle: (id: string, active: boolean) => void;
}> = ({ titleKey, titleOverride, objectives, gameState, onClaimReward, t, timerMs, allCards, isAdmin, onToggle }) => {
    // If not admin, only show active. If admin, show all.
    const visibleObjectives = isAdmin ? objectives : objectives.filter(o => o.active !== false);
    
    if (visibleObjectives.length === 0) return null;
    
    return (
    <div className="mb-8">
        <div className="flex justify-between items-baseline mb-3">
            <h3 className="font-header text-3xl text-gold-light">{titleOverride || t(titleKey)}</h3>
            {timerMs !== undefined && (
                <p className="text-gray-400">{t('resets_in', { time: formatTimeLeft(timerMs) })}</p>
            )}
        </div>
        <div className="space-y-4">
            {visibleObjectives.map(obj => {
                const isActive = obj.active !== false;
                const progress = gameState.objectiveProgress[obj.id] || { tasks: {}, claimed: false };
                const allTasksComplete = obj.tasks.every(task => (progress.tasks?.[task.id] || 0) >= task.target);
                const rewardCard = obj.reward.type === 'card' ? allCards.find(c => c.id === obj.reward.cardId) : null;
                const isPlayerPick = obj.reward.type === 'player_pick' || obj.reward.type === 'coins_and_pick';
                const pickConfig = isPlayerPick && obj.reward.playerPickId ? playerPickConfigs[obj.reward.playerPickId] : null;
                const isPackReward = obj.reward.type === 'pack' && obj.reward.packType;

                return (
                    <div key={obj.id} className={`relative bg-darker-gray/50 p-4 rounded-lg border border-gold-dark/20 ${!isActive ? 'opacity-60 border-red-900 bg-red-900/10' : ''}`}>
                        
                        {isAdmin && (
                            <button 
                                onClick={() => onToggle(obj.id, isActive)} 
                                className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold z-10 ${isActive ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                            >
                                {isActive ? 'Active' : 'Inactive'}
                            </button>
                        )}

                        <h4 className="font-header text-2xl text-white mb-2">{t(obj.titleKey as TranslationKey) || obj.titleKey}</h4>
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <div className="flex-grow w-full">
                                {obj.tasks.map(task => {
                                    const taskProgress = progress.tasks?.[task.id] || 0;
                                    return (
                                        <div key={task.id} className="mb-2">
                                            <p className="text-lg text-gray-300">{t(task.descriptionKey as TranslationKey) || task.descriptionKey}</p>
                                            <div className="w-full bg-black/30 rounded-full h-4 mt-1 border border-gray-600">
                                                <div className="bg-gradient-to-r from-gold-dark to-gold-light h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (taskProgress / task.target) * 100)}%` }} />
                                            </div>
                                            <p className="text-sm text-gray-400 text-right">{Math.min(taskProgress, task.target)} / {task.target}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex-shrink-0 flex flex-col items-center gap-2 text-center">
                                {rewardCard ? (
                                    <div className="w-[120px] h-[180px]">
                                        <Card card={rewardCard} className="!w-full !h-full" />
                                    </div>
                                ) : isPlayerPick ? (
                                    <div className="flex flex-col items-center">
                                        <div 
                                            className="w-[120px] h-[180px] bg-cover bg-center rounded-lg shadow-lg drop-shadow-[0_0_5px_#FFD700] flex flex-col items-center justify-center relative overflow-hidden"
                                            style={{ backgroundImage: 'url("https://i.imghippo.com/files/cGUh9927EWc.png")' }}
                                        >
                                            {pickConfig && (
                                                <div className="bg-black/80 w-full py-2 absolute bottom-6 border-t border-b border-gold-dark/50 backdrop-blur-[2px]">
                                                    <p className="text-gold-light font-header text-sm leading-tight tracking-wider">RAPPER PICK</p>
                                                    <p className="text-white text-xs font-bold">1 of {pickConfig.totalOptions}</p>
                                                    <p className="text-gold-light text-xs font-bold">{pickConfig.minOvr}+ OVR</p>
                                                </div>
                                            )}
                                        </div>
                                        {obj.reward.type === 'coins_and_pick' && (
                                            <span className="text-gold-light font-bold text-sm mt-1">
                                                + {obj.reward.amount} Coins
                                            </span>
                                        )}
                                    </div>
                                ) : isPackReward ? (
                                    <div className="flex flex-col items-center">
                                        <img src={packImages[obj.reward.packType!] || 'https://i.imghippo.com/files/cGUh9927EWc.png'} alt={obj.reward.packType} className="w-24 h-auto object-contain drop-shadow-md mb-2 hover:scale-105 transition-transform" />
                                        <p className="text-gold-light font-bold text-lg">{renderRewardText(obj, t, allCards)}</p>
                                    </div>
                                ) : (
                                    <p className="text-gold-light font-bold text-xl">{renderRewardText(obj, t, allCards)}</p>
                                )}
                                <Button variant={progress.claimed || !allTasksComplete ? 'default' : 'keep'} onClick={() => onClaimReward(obj.id)} disabled={!allTasksComplete || progress.claimed}>
                                    {progress.claimed ? t('completed') : t('claim')}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
)};


const Objectives: React.FC<ObjectivesProps> = ({ gameState, onClaimReward, t, allCards, objectives, isAdmin }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    
    // Group by Type
    const dailyObjectives = objectives.filter(obj => obj.type === 'daily');
    const weeklyObjectives = objectives.filter(obj => obj.type === 'weekly');
    const milestoneObjectives = objectives.filter(obj => obj.type === 'milestone');
    
    // Fallback if type is missing or custom
    const otherObjectives = objectives.filter(obj => !['daily', 'weekly', 'milestone'].includes(obj.type));
    
    const nextDailyReset = (gameState.lastDailyReset || now) + 24 * 60 * 60 * 1000;
    const nextWeeklyReset = (gameState.lastWeeklyReset || now) + 7 * 24 * 60 * 60 * 1000;

    const handleToggle = async (objId: string, currentActive: boolean) => {
        try {
            const newList = objectives.map(o => o.id === objId ? { ...o, active: !currentActive } : o);
            await setDoc(doc(db, 'settings', 'objectives'), { list: newList }, { merge: true });
        } catch(e) { console.error(e); }
    };

    return (
        <div className="animate-fadeIn">
            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_objectives')}</h2>
            
            <ObjectiveGroup titleKey="milestone_objectives" objectives={milestoneObjectives} gameState={gameState} onClaimReward={onClaimReward} t={t} allCards={allCards} isAdmin={isAdmin} onToggle={handleToggle} />
            <ObjectiveGroup titleKey="daily_objectives" objectives={dailyObjectives} gameState={gameState} onClaimReward={onClaimReward} t={t} timerMs={nextDailyReset - now} allCards={allCards} isAdmin={isAdmin} onToggle={handleToggle} />
            <ObjectiveGroup titleKey="weekly_objectives" objectives={weeklyObjectives} gameState={gameState} onClaimReward={onClaimReward} t={t} timerMs={nextWeeklyReset - now} allCards={allCards} isAdmin={isAdmin} onToggle={handleToggle} />
            
            {otherObjectives.length > 0 && (
                <ObjectiveGroup titleKey="milestone_objectives" titleOverride="Special Events" objectives={otherObjectives} gameState={gameState} onClaimReward={onClaimReward} t={t} allCards={allCards} isAdmin={isAdmin} onToggle={handleToggle} />
            )}

        </div>
    );
};

export default Objectives;
