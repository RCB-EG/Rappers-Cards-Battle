
import React from 'react';
import Modal from './Modal';
import Button from '../Button';
import { PackType, Rank } from '../../types';
import { playerPickConfigs } from '../../data/gameData';
import { TranslationKey } from '../../utils/translations';

interface RankUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    newRank: Rank;
    rewards: {
        coins: number;
        packs: PackType[];
        picks: string[];
    };
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const packImages: Record<PackType, string> = {
    free: 'https://i.postimg.cc/R0sYyFhL/Free.png',
    bronze: 'https://i.imghippo.com/files/KCG5562T.png',
    builder: 'https://i.postimg.cc/1z5Tv6mz/Builder.png',
    special: 'https://i.postimg.cc/sxS0M4cT/Special.png',
    legendary: 'https://i.postimg.cc/63Fm6md7/Legendary.png',
};

const RankUpModal: React.FC<RankUpModalProps> = ({ isOpen, onClose, newRank, rewards, t }) => {
    if (!isOpen) return null;

    const packCounts = rewards.packs.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {} as Record<PackType, number>);
    const pickCounts = rewards.picks.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {} as Record<string, number>);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="RANK UP REWARDS!" size="lg">
            <div className="flex flex-col items-center gap-6 my-4">
                <div className="text-center">
                    <h3 className="text-2xl text-white mb-2">CONGRATULATIONS!</h3>
                    <p className="text-gold-light text-xl">You have reached <span className="font-header text-3xl">{newRank}</span> Division</p>
                </div>

                <div className="flex flex-wrap justify-center gap-6 p-4 bg-black/30 rounded-xl border border-gold-dark/30 w-full">
                    {/* Coins */}
                    <div className="flex flex-col items-center w-28">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-yellow-200 flex items-center justify-center text-4xl shadow-lg mb-2">💰</div>
                        <span className="text-gold-light font-bold text-lg">{rewards.coins.toLocaleString()}</span>
                        <span className="text-gray-400 text-xs uppercase tracking-wider">{t('coins')}</span>
                    </div>

                    {/* Packs */}
                    {Object.entries(packCounts).map(([type, count]) => {
                        const countNum = count as number;
                        return (
                            <div key={type} className="flex flex-col items-center w-28">
                                <div className="relative group">
                                    <img src={packImages[type as PackType]} alt={type} className="w-20 h-auto object-contain drop-shadow-md transition-transform group-hover:scale-110" />
                                    {countNum > 1 && <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-darker-gray shadow-sm">{countNum}</div>}
                                </div>
                                <span className="text-white font-bold text-sm mt-2">{countNum}x</span>
                                <span className="text-gray-400 text-xs text-center leading-tight h-6 flex items-center capitalize">{t(`pack_${type}` as TranslationKey).replace(' Pack', '')}</span>
                            </div>
                        );
                    })}

                    {/* Picks */}
                    {Object.entries(pickCounts).map(([pickId, count]) => {
                        const pickConfig = playerPickConfigs[pickId];
                        const countNum = count as number;
                        return (
                            <div key={pickId} className="flex flex-col items-center w-28">
                                <div className="relative group">
                                    <div className="w-20 h-28 bg-cover bg-center rounded-lg shadow-md border border-gray-600 group-hover:border-gold-light transition-all duration-300 group-hover:scale-105" style={{ backgroundImage: 'url("https://i.imghippo.com/files/cGUh9927EWc.png")' }}>
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-3xl">❓</span></div>
                                    </div>
                                    {countNum > 1 && <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-darker-gray shadow-sm">{countNum}</div>}
                                </div>
                                <span className="text-white font-bold text-sm mt-2">{countNum}x</span>
                                <span className="text-gray-400 text-xs text-center leading-tight h-6 flex items-center">{pickConfig ? (pickConfig.name || t(pickConfig.nameKey as TranslationKey).replace(' Pick', '')) : pickId}</span>
                            </div>
                        );
                    })}
                </div>

                <Button variant="cta" onClick={onClose} className="w-full max-w-xs text-xl py-3 shadow-lg animate-pulse">Claim Rewards</Button>
            </div>
        </Modal>
    );
};

export default RankUpModal;
