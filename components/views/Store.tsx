
import React, { useState } from 'react';
import { PackType } from '../../types';
import Modal from '../modals/Modal';
import Button from '../Button';
import { packs } from '../../data/gameData';
import { TranslationKey } from '../../utils/translations';

interface StoreProps {
  onOpenPack: (packType: PackType) => void;
  coins: number;
  isDevMode: boolean;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const PackItem: React.FC<{
  packType: PackType;
  imageSrc: string;
  label: string;
  cost: number;
  disabled: boolean;
  onClick: () => void;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}> = ({ packType, imageSrc, label, cost, disabled, onClick, t }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="pack-item group flex flex-col items-center max-w-[150px] transition-transform duration-300 ease-in-out disabled:filter disabled:grayscale disabled:cursor-not-allowed enabled:hover:-translate-y-1"
    >
        <img 
            src={imageSrc} 
            alt={label} 
            className="w-full rounded-md mb-2.5 transition-all duration-300 ease-in-out group-enabled:group-hover:scale-105 group-enabled:group-hover:drop-shadow-[0_0_10px_#FFD700]"
        />
        <span className="text-lg text-gold-light [text-shadow:0_0_5px_#B8860B]">{cost > 0 ? `${cost} ${t('coins')}` : label}</span>
    </button>
);


const Store: React.FC<StoreProps> = ({ onOpenPack, coins, isDevMode, t }) => {
    const [confirmingPack, setConfirmingPack] = useState<PackType | null>(null);

    const packDetails = {
        free: { src: 'https://i.postimg.cc/R0sYyFhL/Free.png', label: t('pack_free') },
        builder: { src: 'https://i.postimg.cc/1z5Tv6mz/Builder.png', label: t('pack_builder') },
        special: { src: 'https://i.postimg.cc/sxS0M4cT/Special.png', label: t('pack_special') },
        legendary: { src: 'https://i.postimg.cc/63Fm6md7/Legendary.png', label: t('pack_legendary') }
    };

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
                {(Object.keys(packs) as PackType[]).map(packType => (
                    <PackItem
                        key={packType}
                        packType={packType}
                        imageSrc={packDetails[packType].src}
                        label={packDetails[packType].label}
                        cost={packs[packType].cost}
                        disabled={!isDevMode && coins < packs[packType].cost}
                        onClick={() => setConfirmingPack(packType)}
                        t={t}
                    />
                ))}
            </div>

            <Modal isOpen={!!confirmingPack} onClose={() => setConfirmingPack(null)} title={`Confirm ${confirmingPack} Pack`}>
                {currentPackData && (
                    <div className="text-center text-white">
                        <div className="text-left my-4 p-4 bg-black/20 rounded-md">
                            <h4 className="font-header text-gold-light text-xl mb-2">Probabilities:</h4>
                            {Object.entries(currentPackData.rarityChances).map(([rarity, chance]) =>(
                                <p key={rarity} className="capitalize text-gray-300">{rarity}: {chance}%</p>
                            ))}
                        </div>
                        <p className="text-lg">Cost: <span className="text-gold-light">{currentPackData.cost} {t('coins')}</span></p>
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
