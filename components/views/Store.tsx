

import React, { useState } from 'react';
import { PackType, GameState } from '../../types';
import Modal from '../modals/Modal';
import Button from '../Button';
import { packs } from '../../data/gameData';
import { TranslationKey } from '../../utils/translations';

interface StoreProps {
  onOpenPack: (packType: PackType) => void;
  gameState: GameState;
  isDevMode: boolean;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const Store: React.FC<StoreProps> = ({ onOpenPack, gameState, isDevMode, t }) => {
    const [confirmingPack, setConfirmingPack] = useState<PackType | null>(null);
    const { coins, freePacksOpenedToday, lastFreePackResetTime } = gameState;

    const packDetails = {
        free: { src: 'https://i.postimg.cc/R0sYyFhL/Free.png', label: t('pack_free') },
        builder: { src: 'https://i.postimg.cc/1z5Tv6mz/Builder.png', label: t('pack_builder') },
        special: { src: 'https://i.postimg.cc/sxS0M4cT/Special.png', label: t('pack_special') },
        legendary: { src: 'https://i.postimg.cc/63Fm6md7/Legendary.png', label: t('pack_legendary') }
    };

    const twelveHours = 12 * 60 * 60 * 1000;
    const now = Date.now();
    let packsLeftToday = 3;

    if (lastFreePackResetTime && (now - lastFreePackResetTime < twelveHours)) {
        packsLeftToday = 3 - freePacksOpenedToday;
    }
    const packsLeft = Math.max(0, packsLeftToday);

    const handleConfirm = () => {
        if (confirmingPack) {
            onOpenPack(confirmingPack);
            setConfirmingPack(null);
        }
    };
    
    const currentPackData = confirmingPack ? packs[confirmingPack] : null;

    return (
        <div className="animate-fadeIn">
            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_packs')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 justify-items-center">
                {(Object.keys(packs) as PackType[]).map(packType => {
                    const isFreePack = packType === 'free';
                    const isDisabled = isFreePack ? (packsLeft <= 0 && !isDevMode) : (!isDevMode && coins < packs[packType].cost);

                    return (
                        <div key={packType} className="flex flex-col items-center">
                            <button
                                onClick={() => isFreePack ? onOpenPack('free') : setConfirmingPack(packType)}
                                disabled={isDisabled}
                                className="pack-item group flex flex-col items-center max-w-[150px] transition-transform duration-300 ease-in-out disabled:filter disabled:grayscale disabled:cursor-not-allowed enabled:hover:-translate-y-1"
                            >
                                <img 
                                    src={packDetails[packType].src} 
                                    alt={packDetails[packType].label} 
                                    className="w-full rounded-md mb-1 transition-all duration-300 ease-in-out group-enabled:group-hover:scale-105 group-enabled:group-hover:drop-shadow-[0_0_10px_#FFD700]"
                                />
                            </button>
                            <span className="text-lg text-gold-light mt-1.5 [text-shadow:0_0_5px_#B8860B]">
                                {isFreePack ? packDetails[packType].label : `${packs[packType].cost} ${t('coins')}`}
                            </span>
                            {isFreePack && (
                                <span className="text-sm text-gray-400 h-5">
                                    {packsLeft > 0 ? `(${packsLeft} left)` : `(Resets later)`}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            <Modal isOpen={!!confirmingPack} onClose={() => setConfirmingPack(null)} title={`Confirm ${confirmingPack} Pack`}>
                {currentPackData && (
                    <div className="text-center text-white">
                        <div className="text-left my-4 p-4 bg-black/20 rounded-md">
                            <h4 className="font-header text-gold-light text-xl mb-2">Probabilities:</h4>
                            {Object.entries(currentPackData.rarityChances)
                                .filter(([, chance]) => typeof chance === 'number' && chance > 0)
                                .map(([rarity, chance]) =>(
                                <p key={rarity} className="capitalize text-gray-300">{rarity}: {chance}%</p>
                            ))}
                        </div>
                        {currentPackData.cost > 0 && (
                          <p className="text-lg">Cost: <span className="text-gold-light">{currentPackData.cost} {t('coins')}</span></p>
                        )}
                        <div className="flex justify-center gap-4 mt-6">
                            <Button variant="keep" onClick={handleConfirm}>Open</Button>
                            <Button variant="sell" onClick={() => setConfirmingPack(null)}>{t('cancel')}</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Store;