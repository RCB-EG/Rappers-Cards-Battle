import React, { useState } from 'react';
import { GameState, Objective } from '../../types';
import { objectiveData } from '../../data/objectiveData';
import Button from '../Button';
import { TranslationKey } from '../../utils/translations';

interface ObjectivesProps {
    gameState: GameState;
    onClaimReward: (objectiveId: string) => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const ObjectiveItem: React.FC<{
    objective: Objective;
    progress: number;
    claimed: boolean;
    onClaim: () => void;
    t: (key: TranslationKey) => string;
}> = ({ objective, progress, claimed, onClaim, t }) => {
    const isComplete = progress >= objective.target;
    const progressPercentage = Math.min(100, (progress / objective.target) * 100);

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
        <div className={`bg-black/20 p-4 rounded-lg border-l-4 ${isComplete && !claimed ? 'border-gold-light' : 'border-gray-600'} flex flex-col md:flex-row items-center justify-between gap-4`}>
            <div className="flex-grow w-full">
                <p className="text-white text-lg">{objective.description}</p>
                <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                    <div className="bg-gold-light h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
                </div>
                 <p className="text-sm text-gray-400 mt-1">{Math.min(progress, objective.target)} / {objective.target}</p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
                 <p className="font-bold text-gold-light">{renderReward()}</p>
                {claimed ? (
                    <Button disabled>{t('objectives_completed')}</Button>
                ) : (
                    <Button variant="keep" onClick={onClaim} disabled={!isComplete}>{t('objectives_claim')}</Button>
                )}
            </div>
        </div>
    );
};


const Objectives: React.FC<ObjectivesProps> = ({ gameState, onClaimReward, t }) => {
    const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');

    const renderObjectives = (type: 'daily' | 'weekly') => {
        const objectives = objectiveData[type];
        return objectives.map(obj => {
            const progress = gameState.objectives[obj.id] || { progress: 0, claimed: false };
            return (
                <ObjectiveItem 
                    key={obj.id}
                    objective={obj}
                    progress={progress.progress}
                    claimed={progress.claimed}
                    onClaim={() => onClaimReward(obj.id)}
                    t={t}
                />
            );
        });
    };

    return (
        <div className="animate-fadeIn">
            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_objectives')}</h2>
            
            <div className="flex justify-center mb-6 border-b-2 border-gold-dark/30">
                <button 
                    onClick={() => setActiveTab('daily')}
                    className={`px-6 py-2 font-header text-2xl transition-colors duration-200 ${activeTab === 'daily' ? 'text-gold-light border-b-2 border-gold-light' : 'text-gray-500'}`}
                >
                    {t('objectives_daily')}
                </button>
                <button 
                    onClick={() => setActiveTab('weekly')}
                    className={`px-6 py-2 font-header text-2xl transition-colors duration-200 ${activeTab === 'weekly' ? 'text-gold-light border-b-2 border-gold-light' : 'text-gray-500'}`}
                >
                    {t('objectives_weekly')}
                </button>
            </div>

            <div className="space-y-4">
                {activeTab === 'daily' ? renderObjectives('daily') : renderObjectives('weekly')}
            </div>
        </div>
    );
};

export default Objectives;