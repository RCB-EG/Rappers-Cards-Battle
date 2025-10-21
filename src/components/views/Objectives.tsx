import React, { useState, useEffect } from 'react';
import { GameState, Objective } from '../../types';
import { objectivesData } from '../../data/gameData';
import Button from '../Button';
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

const ObjectiveItem: React.FC<{
    objective: Objective;
    progress: number;
    isClaimed: boolean;
    onClaim: () => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}> = ({ objective, progress, isClaimed, onClaim, t }) => {
    const isComplete = progress >= objective.target;
    
    const renderReward = () => {
        if (objective.reward.type === 'coins') {
            return `${objective.reward.amount} ${t('coins')}`;
        }
        if (objective.reward.type === 'pack' && objective.reward.packType) {
            return t(`pack_${objective.reward.packType}` as TranslationKey);
        }
        return 'Reward';
    };

    return (
        <div className="bg-darker-gray/50 p-4 rounded-lg border border-gold-dark/20 flex flex-col md:flex-row items-center gap-4">
            <div className="flex-grow w-full">
                <p className="text-lg text-white">{t(objective.descriptionKey as TranslationKey)}</p>
                <div className="w-full bg-black/30 rounded-full h-4 mt-1 border border-gray-600">
                    <div 
                        className="bg-gradient-to-r from-gold-dark to-gold-light h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (progress / objective.target) * 100)}%` }}
                    ></div>
                </div>
                <p className="text-sm text-gray-400 text-right">{Math.min(progress, objective.target)} / {objective.target}</p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
                 <p className="text-gold-light font-bold">{renderReward()}</p>
                 <Button 
                    variant={isClaimed || !isComplete ? 'default' : 'keep'} 
                    onClick={onClaim} 
                    disabled={!isComplete || isClaimed}
                >
                    {isClaimed ? t('completed') : t('claim')}
                </Button>
            </div>
        </div>
    );
};


const Objectives: React.FC<ObjectivesProps> = ({ gameState, onClaimReward, t }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    
    const dailyObjectives = objectivesData.filter(obj => obj.type === 'daily');
    const weeklyObjectives = objectivesData.filter(obj => obj.type === 'weekly');
    
    const nextDailyReset = (gameState.lastDailyReset || now) + 24 * 60 * 60 * 1000;
    const nextWeeklyReset = (gameState.lastWeeklyReset || now) + 7 * 24 * 60 * 60 * 1000;

    return (
        <div className="animate-fadeIn">
            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_objectives')}</h2>

            {/* Daily Objectives */}
            <div className="mb-8">
                <div className="flex justify-between items-baseline mb-3">
                    <h3 className="font-header text-3xl text-gold-light">{t('daily_objectives')}</h3>
                    <p className="text-gray-400">{t('resets_in', { time: formatTimeLeft(nextDailyReset - now) })}</p>
                </div>
                <div className="space-y-3">
                    {dailyObjectives.map(obj => {
                        const currentProgress = gameState.objectiveProgress[obj.id] || { progress: 0, claimed: false };
                        return (
                             <ObjectiveItem
                                key={obj.id}
                                objective={obj}
                                progress={currentProgress.progress}
                                isClaimed={currentProgress.claimed}
                                onClaim={() => onClaimReward(obj.id)}
                                t={t}
                            />
                        )
                    })}
                </div>
            </div>

            {/* Weekly Objectives */}
            <div>
                <div className="flex justify-between items-baseline mb-3">
                    <h3 className="font-header text-3xl text-gold-light">{t('weekly_objectives')}</h3>
                    <p className="text-gray-400">{t('resets_in', { time: formatTimeLeft(nextWeeklyReset - now) })}</p>
                </div>
                <div className="space-y-3">
                    {weeklyObjectives.map(obj => {
                         const currentProgress = gameState.objectiveProgress[obj.id] || { progress: 0, claimed: false };
                         return (
                              <ObjectiveItem
                                 key={obj.id}
                                 objective={obj}
                                 progress={currentProgress.progress}
                                 isClaimed={currentProgress.claimed}
                                 onClaim={() => onClaimReward(obj.id)}
                                 t={t}
                             />
                         )
                    })}
                </div>
            </div>
        </div>
    );
};

export default Objectives;
