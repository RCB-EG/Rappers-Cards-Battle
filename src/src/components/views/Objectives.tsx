import React, { useState, useEffect } from 'react';
import { GameState, Objective } from '../../types';
import { objectivesData, allCards } from '../../data/gameData';
import Button from '../Button';
import Card from '../Card';
import { TranslationKey } from '../../utils/translations';

interface ObjectivesProps {
    gameState: GameState;
    onClaimReward: (objectiveId: string) => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const formatTimeLeft = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const renderReward = (objective: Objective, t: ObjectivesProps['t']) => {
    const { reward } = objective;
    if (reward.type === 'coins') {
        return `${reward.amount} ${t('coins')}`;
    }
    if (reward.type === 'pack' && reward.packType) {
        return t(`pack_${reward.packType}` as TranslationKey);
    }
    if (reward.type === 'card' && reward.cardId) {
        const card = allCards.find(c => c.id === reward.cardId);
        return card ? card.name : 'Card Reward';
    }
    return 'Reward';
};

const ObjectiveGroup: React.FC<{
    titleKey: TranslationKey;
    objectives: Objective[];
    gameState: GameState;
    onClaimReward: (objectiveId: string) => void;
    t: ObjectivesProps['t'];
    timerMs?: number;
}> = ({ titleKey, objectives, gameState, onClaimReward, t, timerMs }) => (
    <div className="mb-8">
        <div className="flex justify-between items-baseline mb-3">
            <h3 className="font-header text-3xl text-gold-light">{t(titleKey)}</h3>
            {timerMs !== undefined && (
                <p className="text-gray-400">{t('resets_in', { time: formatTimeLeft(timerMs) })}</p>
            )}
        </div>
        <div className="space-y-4">
            {objectives.map(obj => {
                const progress = gameState.objectiveProgress[obj.id] || { tasks: {}, claimed: false };
                const allTasksComplete = obj.tasks.every(task => (progress.tasks?.[task.id] || 0) >= task.target);
                const rewardCard = obj.reward.type === 'card' ? allCards.find(c => c.id === obj.reward.cardId) : null;

                return (
                    <div key={obj.id} className="bg-darker-gray/50 p-4 rounded-lg border border-gold-dark/20">
                        <h4 className="font-header text-2xl text-white mb-2">{t(obj.titleKey as TranslationKey)}</h4>
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <div className="flex-grow w-full">
                                {obj.tasks.map(task => {
                                    const taskProgress = progress.tasks?.[task.id] || 0;
                                    return (
                                        <div key={task.id} className="mb-2">
                                            <p className="text-lg text-gray-300">{t(task.descriptionKey as TranslationKey)}</p>
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
                                ) : (
                                    <p className="text-gold-light font-bold text-xl">{renderReward(obj, t)}</p>
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
);


const Objectives: React.FC<ObjectivesProps> = ({ gameState, onClaimReward, t }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    
    const dailyObjectives = objectivesData.filter(obj => obj.type === 'daily');
    const weeklyObjectives = objectivesData.filter(obj => obj.type === 'weekly');
    const milestoneObjectives = objectivesData.filter(obj => obj.type === 'milestone');
    
    const nextDailyReset = (gameState.lastDailyReset || now) + 24 * 60 * 60 * 1000;
    const nextWeeklyReset = (gameState.lastWeeklyReset || now) + 7 * 24 * 60 * 60 * 1000;

    return (
        <div className="animate-fadeIn">
            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_objectives')}</h2>
            
            <ObjectiveGroup titleKey="milestone_objectives" objectives={milestoneObjectives} gameState={gameState} onClaimReward={onClaimReward} t={t} />
            <ObjectiveGroup titleKey="daily_objectives" objectives={dailyObjectives} gameState={gameState} onClaimReward={onClaimReward} t={t} timerMs={nextDailyReset - now} />
            <ObjectiveGroup titleKey="weekly_objectives" objectives={weeklyObjectives} gameState={gameState} onClaimReward={onClaimReward} t={t} timerMs={nextWeeklyReset - now} />

        </div>
    );
};

export default Objectives;