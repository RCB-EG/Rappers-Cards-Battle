
import React from 'react';
import Modal from './Modal';
import Button from '../Button';
import Card from '../Card';
import { Card as CardType, PackType, PlayerPickConfig } from '../../types';
import { playerPickConfigs } from '../../data/gameData';
import { TranslationKey } from '../../utils/translations';

export interface RewardData {
    type: 'coins' | 'pack' | 'card' | 'player_pick' | 'coins_and_pick';
    amount?: number;
    packType?: PackType;
    cardId?: string;
    playerPickId?: string;
}

interface RewardModalProps {
    isOpen: boolean;
    onClose: () => void;
    reward: RewardData | null;
    title?: string;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
    allCards: CardType[];
}

const packImages: Record<PackType, string> = {
    free: 'https://i.postimg.cc/R0sYyFhL/Free.png',
    bronze: 'https://i.imghippo.com/files/KCG5562T.png',
    builder: 'https://i.postimg.cc/1z5Tv6mz/Builder.png',
    special: 'https://i.postimg.cc/sxS0M4cT/Special.png',
    legendary: 'https://i.postimg.cc/63Fm6md7/Legendary.png',
};

const RewardModal: React.FC<RewardModalProps> = ({ isOpen, onClose, reward, title = "Reward Claimed!", t, allCards }) => {
    if (!isOpen || !reward) return null;

    const renderContent = () => {
        switch (reward.type) {
            case 'coins':
                return (
                    <div className="flex flex-col items-center animate-fadeIn">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-4 border-yellow-200 flex items-center justify-center text-6xl shadow-[0_0_20px_#FFD700] mb-6 animate-bounce">💰</div>
                        <span className="text-gold-light font-header text-5xl drop-shadow-md">{reward.amount?.toLocaleString()}</span>
                        <span className="text-gray-400 text-lg uppercase tracking-widest mt-2">{t('coins')}</span>
                    </div>
                );
            case 'pack':
                if (!reward.packType) return null;
                return (
                    <div className="flex flex-col items-center animate-fadeIn">
                        <div className="relative group mb-6 transform hover:scale-110 transition-transform duration-300">
                            <img src={packImages[reward.packType]} alt={reward.packType} className="w-48 h-auto object-contain drop-shadow-[0_0_25px_rgba(255,215,0,0.6)] animate-shake-subtle" />
                        </div>
                        <span className="text-white font-header text-3xl capitalize drop-shadow-md">{t(`pack_${reward.packType}` as TranslationKey)}</span>
                    </div>
                );
            case 'card':
                if (!reward.cardId) return null;
                const card = allCards.find(c => c.id === reward.cardId);
                if (!card) return null;
                return (
                    <div className="flex flex-col items-center animate-fadeIn">
                        <div className="transform scale-125 mb-8 hover:scale-135 transition-transform duration-300 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                            <Card card={card} />
                        </div>
                        <span className="text-white font-header text-3xl">{card.name}</span>
                        <span className={`font-bold capitalize text-lg mt-1 text-rarity-${card.rarity}`}>{card.rarity} Card</span>
                    </div>
                );
            case 'player_pick':
                if (!reward.playerPickId) return null;
                const pickConfig = playerPickConfigs[reward.playerPickId];
                return (
                    <div className="flex flex-col items-center animate-fadeIn">
                        <div 
                            className="w-40 h-60 bg-cover bg-center rounded-lg shadow-lg drop-shadow-[0_0_15px_#FFD700] flex flex-col items-center justify-center relative overflow-hidden mb-6 animate-pulse transform hover:scale-105 transition-transform"
                            style={{ backgroundImage: 'url("https://i.imghippo.com/files/cGUh9927EWc.png")' }}
                        >
                            <div className="bg-black/80 w-full py-3 absolute bottom-8 border-t border-b border-gold-dark/50 backdrop-blur-[2px] text-center">
                                <p className="text-gold-light font-header text-lg leading-tight tracking-wider">RAPPER PICK</p>
                                <p className="text-white text-sm font-bold">1 of {pickConfig?.totalOptions}</p>
                            </div>
                        </div>
                        <span className="text-white font-header text-2xl">{pickConfig ? (pickConfig.name || t(pickConfig.nameKey as TranslationKey)) : 'Player Pick'}</span>
                    </div>
                );
            case 'coins_and_pick':
                if (!reward.playerPickId) return null;
                const comboPickConfig = playerPickConfigs[reward.playerPickId];
                return (
                    <div className="flex flex-col items-center gap-8 animate-fadeIn">
                        <div className="flex items-center gap-8 md:gap-12">
                             {/* Coins */}
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-4 border-yellow-200 flex items-center justify-center text-4xl shadow-lg mb-2 animate-bounce">💰</div>
                                <span className="text-gold-light font-header text-2xl">{reward.amount?.toLocaleString()}</span>
                                <span className="text-gray-400 text-xs uppercase">{t('coins')}</span>
                            </div>
                            <div className="text-5xl text-white font-header opacity-50">+</div>
                            {/* Pick */}
                            <div className="flex flex-col items-center">
                                <div 
                                    className="w-24 h-36 bg-cover bg-center rounded-lg shadow-lg drop-shadow-[0_0_10px_#FFD700] flex flex-col items-center justify-center relative overflow-hidden mb-2 animate-pulse"
                                    style={{ backgroundImage: 'url("https://i.imghippo.com/files/cGUh9927EWc.png")' }}
                                >
                                    <div className="absolute inset-0 bg-black/20" />
                                    <span className="text-4xl z-10">❓</span>
                                </div>
                                <span className="text-white font-header text-lg text-center max-w-[120px] leading-tight">{comboPickConfig ? (comboPickConfig.name || t(comboPickConfig.nameKey as TranslationKey)) : 'Pick'}</span>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
            <div className="my-8">
                {renderContent()}
            </div>
            <div className="flex justify-center">
                <Button variant="cta" onClick={onClose} className="w-48 shadow-lg text-xl py-3 animate-pulse">{t('collect')}</Button>
            </div>
        </Modal>
    );
};

export default RewardModal;
