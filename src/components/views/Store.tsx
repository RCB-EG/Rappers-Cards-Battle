
import React, { useState } from 'react';
import { PackType, GameState, PlayerPickConfig } from '../../types';
import Modal from '../modals/Modal';
import Button from '../Button';
import { packs } from '../../data/gameData';
import { TranslationKey } from '../../utils/translations';

interface StoreProps {
  onOpenPack: (packType: PackType, options?: { isReward?: boolean, bypassLimit?: boolean, fromInventory?: boolean, currency?: 'coins' | 'bp' }) => void;
  onOpenInventoryPick: (pickConfig: PlayerPickConfig) => void;
  gameState: GameState;
  isDevMode: boolean;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const Store: React.FC<StoreProps> = ({ onOpenPack, onOpenInventoryPick, gameState, isDevMode, t }) => {
    const [confirmingPack, setConfirmingPack] = useState<PackType | null>(null);
    const { coins, battlePoints, freePacksOpenedToday, lastFreePackResetTime, ownedPacks, ownedPlayerPicks } = gameState;

    const packDetails = {
        free: { src: 'https://i.postimg.cc/R0sYyFhL/Free.png', label: t('pack_free') },
        bronze: { src: 'https://i.imghippo.com/files/KCG5562T.png', label: t('pack_bronze') },
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

    const handleConfirm = (currency: 'coins' | 'bp') => {
        if (confirmingPack) {
            onOpenPack(confirmingPack, { currency });
            setConfirmingPack(null);
        }
    };
    
    // Group owned packs by type
    const ownedPacksCount = ownedPacks.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<PackType, number>);

    // Group owned picks by ID
    const ownedPicksCount = ownedPlayerPicks.reduce((acc, pick) => {
        acc[pick.id] = acc[pick.id] ? { ...acc[pick.id], count: acc[pick.id].count + 1 } : { config: pick, count: 1 };
        return acc;
    }, {} as Record<string, { config: PlayerPickConfig, count: number }>);

    const hasInventory = ownedPacks.length > 0 || ownedPlayerPicks.length > 0;
    
    const currentPackData = confirmingPack ? packs[confirmingPack] : null;

    return (
        <div className="animate-fadeIn">
            {/* Inventory Section */}
            {hasInventory && (
                <div className="mb-12 bg-black/30 p-6 rounded-xl border border-gold-dark/30">
                    <h3 className="font-header text-3xl text-gold-light mb-6 text-center shadow-gold-glow">Owned Packs & Picks</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 justify-items-center">
                        {/* Owned Packs */}
                        {Object.entries(ownedPacksCount).map(([type, count]) => (
                            <div key={`owned-${type}`} className="flex flex-col items-center">
                                <div className="relative group">
                                    <img 
                                        src={packDetails[type as PackType]?.src || packDetails['free'].src} 
                                        alt={packDetails[type as PackType]?.label || type} 
                                        className="w-32 rounded-md mb-2 transition-transform hover:scale-105"
                                    />
                                    <div className="absolute -top-2 -right-2 bg-red-600 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-white shadow-md">
                                        {count}
                                    </div>
                                </div>
                                <span className="text-sm text-gray-300 mb-2">{packDetails[type as PackType]?.label || type}</span>
                                <Button variant="keep" onClick={() => onOpenPack(type as PackType, { fromInventory: true })} className="py-1 px-4 text-sm">
                                    Open
                                </Button>
                            </div>
                        ))}

                        {/* Owned Picks */}
                        {Object.values(ownedPicksCount).map(({ config, count }) => (
                            <div key={`owned-pick-${config.id}`} className="flex flex-col items-center">
                                <div className="relative group">
                                    <div 
                                        className="w-32 h-48 bg-cover bg-center rounded-lg shadow-lg drop-shadow-[0_0_5px_#FFD700] flex flex-col items-center justify-center relative overflow-hidden transition-transform hover:scale-105"
                                        style={{ backgroundImage: 'url("https://i.imghippo.com/files/cGUh9927EWc.png")' }}
                                    >
                                        <div className="bg-black/80 w-full py-1 absolute bottom-4 border-t border-b border-gold-dark/50 backdrop-blur-[2px] text-center">
                                            <p className="text-gold-light font-header text-xs leading-tight tracking-wider">RAPPER PICK</p>
                                            <p className="text-white text-[10px] font-bold">1 of {config.totalOptions}</p>
                                            <p className="text-gold-light text-[10px] font-bold">{config.minOvr}+ OVR</p>
                                        </div>
                                    </div>
                                    <div className="absolute -top-2 -right-2 bg-red-600 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-white shadow-md">
                                        {count}
                                    </div>
                                </div>
                                <span className="text-sm text-gray-300 mb-2">{t(config.nameKey as TranslationKey)}</span>
                                <Button variant="keep" onClick={() => onOpenInventoryPick(config)} className="py-1 px-4 text-sm">
                                    Open
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_packs')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 justify-items-center">
                {(Object.keys(packs) as PackType[]).filter(p => p !== 'bronze').map(packType => {
                    const isFreePack = packType === 'free';
                    const isDisabled = isFreePack ? (packsLeft <= 0 && !isDevMode) : false; // Cost check happens on confirm

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
                            {isFreePack ? (
                                <div className="text-center">
                                    <span className="text-lg text-gold-light [text-shadow:0_0_5px_#B8860B]">{packDetails[packType].label}</span>
                                    <span className="block text-sm text-gray-400 h-5">
                                        {packsLeft > 0 ? `(${packsLeft} left)` : `(Resets later)`}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <span className="text-lg text-gold-light [text-shadow:0_0_5px_#B8860B]">
                                        {packs[packType].cost} {t('coins')}
                                    </span>
                                    <span className="text-sm text-blue-glow font-bold">
                                        {packs[packType].bpCost} BP
                                    </span>
                                </div>
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
                        
                        <div className="flex flex-col gap-3 mt-6">
                            <Button 
                                variant="keep" 
                                onClick={() => handleConfirm('coins')}
                                disabled={!isDevMode && coins < currentPackData.cost}
                                className="w-full"
                            >
                                Buy for {currentPackData.cost} {t('coins')}
                            </Button>
                            
                            <Button 
                                variant="ok" 
                                onClick={() => handleConfirm('bp')}
                                disabled={!isDevMode && (battlePoints || 0) < currentPackData.bpCost}
                                className="w-full !bg-blue-600 !border-blue-400 disabled:!bg-gray-600"
                            >
                                Buy for {currentPackData.bpCost} BP
                            </Button>

                            <Button variant="default" onClick={() => setConfirmingPack(null)}>{t('cancel')}</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Store;
