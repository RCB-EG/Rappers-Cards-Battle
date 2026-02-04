
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TranslationKey } from '../../utils/translations';
import { GameState, Card as CardType, FBCChallenge, Rarity, PackType } from '../../types';
import Button from '../Button';
import Card from '../Card';
import { sfx } from '../../data/sounds';

interface FBCProps {
    gameState: GameState;
    onFbcSubmit: (challengeId: string, submittedCards: CardType[]) => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
    playSfx: (soundKey: keyof typeof sfx) => void;
    allCards: CardType[];
    challenges: FBCChallenge[]; // Added prop
}

type FbcViewMode = 'list' | 'group' | 'submission';

const packImages: Partial<Record<PackType, string>> = {
    free: 'https://i.postimg.cc/R0sYyFhL/Free.png',
    bronze: 'https://i.imghippo.com/files/KCG5562T.png',
    builder: 'https://i.postimg.cc/1z5Tv6mz/Builder.png',
    special: 'https://i.postimg.cc/sxS0M4cT/Special.png',
    legendary: 'https://i.postimg.cc/63Fm6md7/Legendary.png',
};

const checkRequirements = (submission: CardType[], requirements: FBCChallenge['requirements']) => {
    const checks: Record<string, boolean> = {};

    checks.cardCount = submission.length === requirements.cardCount;

    if (requirements.minAvgOvr) {
        const totalOvr = submission.reduce((sum, card) => sum + card.ovr, 0);
        const avgOvr = submission.length > 0 ? totalOvr / submission.length : 0;
        checks.minAvgOvr = avgOvr >= requirements.minAvgOvr;
    }

    if (requirements.minTotalValue) {
        const totalValue = submission.reduce((sum, card) => sum + card.value, 0);
        checks.minTotalValue = totalValue >= requirements.minTotalValue;
    }

    if (requirements.exactRarityCount) {
        for (const rarity in requirements.exactRarityCount) {
            const count = submission.filter(c => c.rarity === rarity).length;
            checks[`exact_${rarity}`] = count === requirements.exactRarityCount[rarity as Rarity];
        }
    }

    if (requirements.minRarityCount) {
        for (const rarity in requirements.minRarityCount) {
            const count = submission.filter(c => c.rarity === rarity).length;
            checks[`min_${rarity}`] = count >= requirements.minRarityCount[rarity as Rarity];
        }
    }

    return { checks, allMet: Object.values(checks).every(Boolean) };
};

const FBC: React.FC<FBCProps> = ({ gameState, onFbcSubmit, t, playSfx, allCards, challenges }) => {
    const [viewMode, setViewMode] = useState<FbcViewMode>('list');
    const [selectedChallenge, setSelectedChallenge] = useState<FBCChallenge | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [submission, setSubmission] = useState<CardType[]>([]);

    const availableChallenges = useMemo(() => {
        return challenges.filter(fbc => {
            if (gameState.completedFbcIds.includes(fbc.id)) return false;
            if (fbc.prerequisiteId && !gameState.completedFbcIds.includes(fbc.prerequisiteId)) return false;
            return true;
        });
    }, [gameState.completedFbcIds, challenges]);

    const fbcListItems = useMemo(() => {
        const groups: Record<string, FBCChallenge[]> = {};
        const singleChallenges: FBCChallenge[] = [];

        availableChallenges.forEach(c => {
            if (c.groupId) {
                if (!groups[c.groupId]) groups[c.groupId] = [];
                groups[c.groupId].push(c);
            } else {
                singleChallenges.push(c);
            }
        });

        const groupHeaders = Object.values(groups).map(group => group[0]);
        return [...singleChallenges, ...groupHeaders];
    }, [availableChallenges]);

    const availablePlayerCards = useMemo(() => {
        const playerCards = [...Object.values(gameState.formation).filter(Boolean) as CardType[], ...gameState.storage];
        const submissionIds = new Set(submission.map(c => c.id));
        return playerCards.filter(c => !submissionIds.has(c.id));
    }, [gameState.formation, gameState.storage, submission]);

    const { checks, allMet } = useMemo(() => {
        if (!selectedChallenge) return { checks: {}, allMet: false };
        return checkRequirements(submission, selectedChallenge.requirements);
    }, [submission, selectedChallenge]);

    const prevAllMet = useRef(false);
    useEffect(() => {
        if (allMet && !prevAllMet.current) playSfx('tasksComplete');
        prevAllMet.current = allMet;
    }, [allMet, playSfx]);

    const handleSelectChallenge = (challenge: FBCChallenge) => {
        if (challenge.groupId) {
            setSelectedGroupId(challenge.groupId);
            setViewMode('group');
        } else {
            setSelectedChallenge(challenge);
            setSubmission([]);
            setViewMode('submission');
        }
    };

    const handleCardClick = (card: CardType) => {
        const isInSubmission = submission.some(c => c.id === card.id);
        if (isInSubmission) {
            setSubmission(prev => prev.filter(c => c.id !== card.id));
        } else if (selectedChallenge && submission.length < selectedChallenge.requirements.cardCount) {
            setSubmission(prev => [...prev, card]);
        }
    };

    const handleSubmit = () => {
        if (selectedChallenge && allMet) {
            onFbcSubmit(selectedChallenge.id, submission);
            setSelectedChallenge(null);
            setSubmission([]);
            setViewMode('list');
            setSelectedGroupId(null);
        }
    };

    const renderReward = (challenge: FBCChallenge) => {
        const { reward } = challenge;
        if (reward.type === 'pack' && reward.details) {
            const packImg = packImages[reward.details];
            if (packImg) {
                return <img src={packImg} alt={reward.details} className="w-16 h-auto object-contain" />;
            }
            return <p className="text-gold-light capitalize">{t(`pack_${reward.details}` as TranslationKey)}</p>;
        }
        if (reward.type === 'card' && reward.cardId) {
            const cardTemplate = allCards.find(c => c.id === reward.cardId);
            if (cardTemplate) return <Card card={cardTemplate} className="!w-[100px] !h-[150px]" />;
        }
        return null;
    };

    if (viewMode === 'submission' && selectedChallenge) {
        const req = selectedChallenge.requirements;
        return (
            <div className="animate-fadeIn">
                <h2 className="font-header text-3xl text-white text-center mb-4">{t(selectedChallenge.title as TranslationKey) || selectedChallenge.title}</h2>
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-grow-[3]">
                         <h3 className="text-xl mb-2">{t('fbc_submit_cards')}</h3>
                         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4 bg-black/30 rounded-lg min-h-[300px]">
                            {Array.from({ length: req.cardCount }).map((_, i) => (
                                <div key={i} className="fbc-slot">{submission[i] ? <div onClick={() => handleCardClick(submission[i])} className="cursor-pointer"><Card card={submission[i]} /></div> : <span>+</span>}</div>
                            ))}
                         </div>
                         <h3 className="text-xl mt-4 mb-2">{t('fbc_your_collection')}</h3>
                         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 p-4 bg-black/20 rounded-lg max-h-[400px] overflow-y-auto">
                            {availablePlayerCards.map(card => <div key={card.id} onClick={() => handleCardClick(card)} className="cursor-pointer"><Card card={card} /></div>)}
                         </div>
                    </div>
                    <div className="flex-grow-[2] bg-black/30 p-6 rounded-lg">
                        <h3 className="text-xl mb-2">{t('fbc_requirements')}</h3>
                        <ul className="space-y-2 mb-4">
                            <li className={checks.cardCount ? 'text-green-400' : 'text-gray-400'}>{t('fbc_req_card_count', {count: req.cardCount})} ({submission.length}/{req.cardCount})</li>
                            {req.minAvgOvr && <li className={checks.minAvgOvr ? 'text-green-400' : 'text-gray-400'}>{t('fbc_req_min_avg_ovr', {ovr: req.minAvgOvr})}</li>}
                            {req.minTotalValue && <li className={checks.minTotalValue ? 'text-green-400' : 'text-gray-400'}>{t('fbc_req_min_total_value', {value: req.minTotalValue})}</li>}
                            {req.exactRarityCount && Object.entries(req.exactRarityCount).map(([r, c]) => c !== undefined && <li key={r} className={checks[`exact_${r}`] ? 'text-green-400' : 'text-gray-400'}>{t('fbc_req_exact_rarity', {count: c, rarity: r})}</li>)}
                            {req.minRarityCount && Object.entries(req.minRarityCount).map(([r, c]) => c !== undefined && <li key={r} className={checks[`min_${r}`] ? 'text-green-400' : 'text-gray-400'}>{t('fbc_req_min_rarity', {count: c, rarity: r})}</li>)}
                        </ul>
                         <h3 className="text-xl mb-2">{t('fbc_reward_card')}</h3>
                         <div className="flex justify-center mb-6">{renderReward(selectedChallenge)}</div>
                         <div className="flex gap-4">
                            <Button variant="keep" onClick={handleSubmit} disabled={!allMet}>{t('fbc_submit')}</Button>
                            <Button variant="sell" onClick={() => {
                                const cameFromGroup = selectedChallenge.groupId;
                                setSelectedChallenge(null);
                                setSubmission([]);
                                setViewMode(cameFromGroup ? 'group' : 'list');
                            }}>{t('fbc_back')}</Button>
                         </div>
                    </div>
                </div>
            </div>
        )
    }

    if (viewMode === 'group' && selectedGroupId) {
        const groupChallenges = challenges.filter(c => c.groupId === selectedGroupId);
        const finalRewardCard = allCards.find(c => c.id === groupChallenges[0].groupFinalRewardCardId);
        
        return (
            <div className="animate-fadeIn">
                <button className="text-gold-light mb-4" onClick={() => { setViewMode('list'); setSelectedGroupId(null); }}>← {t('fbc_back')}</button>
                <div className="flex flex-col items-center gap-4 mb-6">
                    <h2 className="font-header text-3xl text-white text-center">{t(groupChallenges[0].title as TranslationKey) || groupChallenges[0].title}</h2>
                    {finalRewardCard && <Card card={finalRewardCard} className="!w-[180px] !h-[270px]" />}
                </div>
                <div className="space-y-4">
                    {groupChallenges.map((challenge, index) => {
                        const isCompleted = gameState.completedFbcIds.includes(challenge.id);
                        const isLocked = challenge.prerequisiteId && !gameState.completedFbcIds.includes(challenge.prerequisiteId);
                        const statusClasses = isCompleted ? 'border-green-500/50 opacity-60' : isLocked ? 'border-red-500/50 opacity-50' : 'border-gold-dark/30 hover:border-gold-light cursor-pointer';
                        
                        return (
                            <div key={challenge.id} onClick={() => !isLocked && !isCompleted && (setSelectedChallenge(challenge), setSubmission([]), setViewMode('submission'))} className={`bg-darker-gray/60 p-4 rounded-lg border transition-all duration-300 ${statusClasses}`}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h4 className="font-header text-xl text-gold-light">Part {index + 1}: {t(challenge.title as TranslationKey) || challenge.title}</h4>
                                        <p className="text-gray-400">{t(challenge.description as TranslationKey) || challenge.description}</p>
                                    </div>
                                    <div className="text-center">
                                        <h5 className="text-sm uppercase text-gray-500">{t('fbc_reward')}</h5>
                                        {renderReward(challenge)}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="animate-fadeIn">
            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_fbc')}</h2>
            <div className="space-y-4">
                {fbcListItems.length > 0 ? fbcListItems.map(challenge => {
                    const rewardCardId = challenge.groupFinalRewardCardId || (challenge.reward.type === 'card' ? challenge.reward.cardId : null);
                    const rewardCardTemplate = rewardCardId ? allCards.find(c => c.id === rewardCardId) : null;
                    const isPackReward = challenge.reward.type === 'pack';

                    return (
                        <div key={challenge.id} onClick={() => handleSelectChallenge(challenge)} className="bg-gradient-to-br from-light-gray to-darker-gray p-5 rounded-lg border border-gold-dark/30 cursor-pointer transition-all duration-300 hover:border-gold-light hover:-translate-y-1 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex-grow text-center md:text-left">
                                <h3 className="font-header text-2xl text-gold-light">{t(challenge.title as TranslationKey) || challenge.title}</h3>
                                <p className="text-gray-400">{t(challenge.description as TranslationKey) || challenge.description}</p>
                            </div>
                            {rewardCardTemplate && (
                                <div className="flex-shrink-0 mt-4 md:mt-0">
                                    <h4 className="font-main text-lg text-center mb-2">{t('fbc_reward_card')}</h4>
                                    <Card card={rewardCardTemplate} className="!w-[144px] !h-[216px] md:!w-[180px] md:!h-[270px]"/>
                                </div>
                            )}
                            {isPackReward && challenge.reward.details && (
                                <div className="flex-shrink-0 mt-4 md:mt-0 flex flex-col items-center">
                                    <h4 className="font-main text-lg text-center mb-2">{t('fbc_reward')}</h4>
                                    {packImages[challenge.reward.details] ? 
                                        <img src={packImages[challenge.reward.details]} alt="Reward Pack" className="w-24 hover:scale-110 transition-transform"/> :
                                        <span className="text-gold-light">{challenge.reward.details}</span>
                                    }
                                </div>
                            )}
                        </div>
                    );
                }) : <p className="text-center text-gray-400 text-xl py-10">No new challenges available.</p>}
                 {gameState.completedFbcIds.length > 0 && (
                    <div className="mt-8">
                        <h3 className="font-header text-2xl text-center mb-4">{t('fbc_completed')}</h3>
                        <div className="space-y-4">
                        {challenges.filter(f => gameState.completedFbcIds.includes(f.id)).map(challenge => (
                            <div key={challenge.id} className="bg-darker-gray/50 p-5 rounded-lg border border-green-500/30 opacity-60">
                                <h3 className="font-header text-2xl text-green-400 line-through">{t(challenge.title as TranslationKey) || challenge.title}</h3>
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
