import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TranslationKey } from '../../utils/translations';
import { GameState, Card as CardType, FBCChallenge, Rarity } from '../../types';
import { fbcData, allCards } from '../../data/gameData';
import Button from '../Button';
import Card from '../Card';
import { sfx } from '../../data/sounds';

interface FBCProps {
    gameState: GameState;
    onFbcSubmit: (challengeId: string, submittedCards: CardType[]) => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
    playSfx: (soundKey: keyof typeof sfx) => void;
}

const checkRequirements = (submission: CardType[], requirements: FBCChallenge['requirements']) => {
    const checks: Record<string, boolean> = {};

    // Card count
    checks.cardCount = submission.length === requirements.cardCount;

    // Min Avg OVR
    if (requirements.minAvgOvr) {
        const totalOvr = submission.reduce((sum, card) => sum + card.ovr, 0);
        const avgOvr = submission.length > 0 ? totalOvr / submission.length : 0;
        checks.minAvgOvr = avgOvr >= requirements.minAvgOvr;
    }

    // Min Total Value
    if (requirements.minTotalValue) {
        const totalValue = submission.reduce((sum, card) => sum + card.value, 0);
        checks.minTotalValue = totalValue >= requirements.minTotalValue;
    }

    // Exact Rarity Count
    if (requirements.exactRarityCount) {
        for (const rarity in requirements.exactRarityCount) {
            const count = submission.filter(c => c.rarity === rarity).length;
            checks[`exact_${rarity}`] = count === requirements.exactRarityCount[rarity as Rarity];
        }
    }

    // Min Rarity Count
    if (requirements.minRarityCount) {
        for (const rarity in requirements.minRarityCount) {
            const count = submission.filter(c => c.rarity === rarity).length;
            checks[`min_${rarity}`] = count >= requirements.minRarityCount[rarity as Rarity];
        }
    }

    return { checks, allMet: Object.values(checks).every(Boolean) };
};


const FBC: React.FC<FBCProps> = ({ gameState, onFbcSubmit, t, playSfx }) => {
    const [selectedChallenge, setSelectedChallenge] = useState<FBCChallenge | null>(null);
    const [submission, setSubmission] = useState<CardType[]>([]);

    const availableChallenges = useMemo(() => {
        return fbcData.filter(fbc => !gameState.completedFbcIds.includes(fbc.id));
    }, [gameState.completedFbcIds]);
    
    const availablePlayerCards = useMemo(() => {
        const allCards = [...Object.values(gameState.formation).filter(Boolean) as CardType[], ...gameState.storage];
        const submissionIds = new Set(submission.map(c => c.id));
        return allCards.filter(c => !submissionIds.has(c.id));
    }, [gameState.formation, gameState.storage, submission]);

    const { checks, allMet } = useMemo(() => {
        if (!selectedChallenge) return { checks: {}, allMet: false };
        return checkRequirements(submission, selectedChallenge.requirements);
    }, [submission, selectedChallenge]);

    const prevAllMet = useRef(false);
    useEffect(() => {
        if (allMet && !prevAllMet.current) {
            playSfx('tasksComplete');
        }
        prevAllMet.current = allMet;
    }, [allMet, playSfx]);

    const handleSelectChallenge = (challenge: FBCChallenge) => {
        setSelectedChallenge(challenge);
        setSubmission([]);
    };
    
    const handleCardClick = (card: CardType) => {
        const isInSubmission = submission.some(c => c.id === card.id);
        if (isInSubmission) {
            setSubmission(prev => prev.filter(c => c.id !== card.id));
        } else {
            if (selectedChallenge && submission.length < selectedChallenge.requirements.cardCount) {
                setSubmission(prev => [...prev, card]);
            }
        }
    };
    
    const handleSubmit = () => {
        if (selectedChallenge && allMet) {
            onFbcSubmit(selectedChallenge.id, submission);
            setSelectedChallenge(null);
            setSubmission([]);
        }
    };

    const renderReward = (challenge: FBCChallenge) => {
        if (challenge.reward.type === 'pack' && challenge.reward.details) {
            return <p className="text-gold-light capitalize">{challenge.reward.details} Pack</p>;
        }
        if (challenge.reward.type === 'card' && challenge.reward.cardId) {
            const cardTemplate = allCards.find(c => c.id === challenge.reward.cardId);
            if (cardTemplate) {
                return <Card card={cardTemplate} />;
            }
        }
        return null;
    };

    if (selectedChallenge) {
        const req = selectedChallenge.requirements;
        return (
            <div className="animate-fadeIn">
                <h2 className="font-header text-3xl text-white text-center mb-4">{t(selectedChallenge.title as TranslationKey)}</h2>
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Side: Submission Area */}
                    <div className="flex-grow-[3]">
                         <h3 className="text-xl mb-2">{t('fbc_submit_cards')}</h3>
                         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4 bg-black/30 rounded-lg min-h-[300px]">
                            {Array.from({ length: req.cardCount }).map((_, i) => (
                                <div key={i} className="fbc-slot">
                                    {submission[i] ? (
                                        <div onClick={() => handleCardClick(submission[i])} className="cursor-pointer">
                                            <Card card={submission[i]} />
                                        </div>
                                    ) : (
                                        <span>+</span>
                                    )}
                                </div>
                            ))}
                         </div>
                         <h3 className="text-xl mt-4 mb-2">{t('fbc_your_collection')}</h3>
                         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 p-4 bg-black/20 rounded-lg max-h-[400px] overflow-y-auto">
                            {availablePlayerCards.map(card => (
                                <div key={card.id} onClick={() => handleCardClick(card)} className="cursor-pointer">
                                    <Card card={card} />
                                </div>
                            ))}
                         </div>
                    </div>
                    {/* Right Side: Info & Actions */}
                    <div className="flex-grow-[2] bg-black/30 p-6 rounded-lg">
                        <h3 className="text-xl mb-2">{t('fbc_requirements')}</h3>
                        <ul className="space-y-2 mb-4">
                            <li className={checks.cardCount ? 'text-green-400' : 'text-gray-400'}>{t('fbc_req_card_count', {count: req.cardCount})} ({submission.length}/{req.cardCount})</li>
                            {req.minAvgOvr && <li className={checks.minAvgOvr ? 'text-green-400' : 'text-gray-400'}>{t('fbc_req_min_avg_ovr', {ovr: req.minAvgOvr})}</li>}
                             {req.minTotalValue && <li className={checks.minTotalValue ? 'text-green-400' : 'text-gray-400'}>{t('fbc_req_min_total_value', {value: req.minTotalValue})}</li>}
                            {/* FIX: Check for undefined values from optional properties before rendering to avoid type errors. */}
                            {req.exactRarityCount && Object.entries(req.exactRarityCount).map(([r, c]) => c !== undefined && <li key={r} className={checks[`exact_${r}`] ? 'text-green-400' : 'text-gray-400'}>{t('fbc_req_exact_rarity', {count: c, rarity: r})}</li>)}
                            {/* FIX: Check for undefined values from optional properties before rendering to avoid type errors. */}
                            {req.minRarityCount && Object.entries(req.minRarityCount).map(([r, c]) => c !== undefined && <li key={r} className={checks[`min_${r}`] ? 'text-green-400' : 'text-gray-400'}>{t('fbc_req_min_rarity', {count: c, rarity: r})}</li>)}
                        </ul>
                         <h3 className="text-xl mb-2">{t('fbc_reward_card')}</h3>
                         <div className="flex justify-center mb-6">
                            {renderReward(selectedChallenge)}
                         </div>
                         <div className="flex gap-4">
                            <Button variant="keep" onClick={handleSubmit} disabled={!allMet}>{t('fbc_submit')}</Button>
                            <Button variant="sell" onClick={() => setSelectedChallenge(null)}>{t('fbc_back')}</Button>
                         </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="animate-fadeIn">
            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_fbc')}</h2>
            <div className="space-y-4">
                {availableChallenges.length > 0 ? availableChallenges.map(challenge => {
                    const rewardCardTemplate = (challenge.reward.type === 'card' && challenge.reward.cardId)
                        ? allCards.find(c => c.id === challenge.reward.cardId) 
                        : null;

                    return (
                        <div 
                            key={challenge.id} 
                            onClick={() => handleSelectChallenge(challenge)} 
                            className="bg-gradient-to-br from-light-gray to-darker-gray p-5 rounded-lg border border-gold-dark/30 cursor-pointer transition-all duration-300 hover:border-gold-light hover:-translate-y-1 flex flex-col md:flex-row items-center justify-between gap-6"
                        >
                            <div className="flex-grow text-center md:text-left">
                                <h3 className="font-header text-2xl text-gold-light">{t(challenge.title as TranslationKey)}</h3>
                                <p className="text-gray-400">{t(challenge.description as TranslationKey)}</p>
                            </div>
                            {rewardCardTemplate && (
                                <div className="flex-shrink-0 mt-4 md:mt-0">
                                    <h4 className="font-main text-lg text-center mb-2">{t('fbc_reward_card')}</h4>
                                    <Card card={rewardCardTemplate} className="!w-[144px] !h-[216px] md:!w-[180px] md:!h-[270px]"/>
                                </div>
                            )}
                        </div>
                    );
                }) : (
                     <p className="text-center text-gray-400 text-xl py-10">No new challenges available.</p>
                )}
                 {gameState.completedFbcIds.length > 0 && (
                    <div className="mt-8">
                        <h3 className="font-header text-2xl text-center mb-4">{t('fbc_completed')}</h3>
                        <div className="space-y-4">
                        {fbcData.filter(f => gameState.completedFbcIds.includes(f.id)).map(challenge => (
                            <div key={challenge.id} className="bg-darker-gray/50 p-5 rounded-lg border border-green-500/30 opacity-60">
                                <h3 className="font-header text-2xl text-green-400 line-through">{t(challenge.title as TranslationKey)}</h3>
                            </div>
                        ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FBC;
