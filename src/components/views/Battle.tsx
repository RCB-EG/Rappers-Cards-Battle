import React from 'react';
import { TranslationKey } from '../../utils/translations';

interface BattleProps {
    t: (key: TranslationKey) => string;
}

const Battle: React.FC<BattleProps> = ({ t }) => {
    return (
        <div className="animate-fadeIn">
            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_battle')}</h2>
            <div className="flex flex-col items-center justify-center min-h-[300px]">
                <h3 className="font-header text-5xl text-gray-400">Coming Soon...</h3>
                 <p className="text-lg text-gray-500 mt-2">Prepare your squad for upcoming battles!</p>
            </div>
        </div>
    );
};

export default Battle;