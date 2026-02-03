
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RarityDefinition } from '../types';
import { db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

// Default Hardcoded Rarities
export const DEFAULT_RARITIES: Record<string, RarityDefinition> = {
    bronze: { id: 'bronze', name: 'Bronze', rank: 1, color: '#cd7f32', baseImage: 'https://i.imghippo.com/files/TmM6820WtQ.png', animationTier: 1 },
    silver: { id: 'silver', name: 'Silver', rank: 2, color: '#c0c0c0', baseImage: 'https://i.imghippo.com/files/zC9861peQ.png', animationTier: 2 },
    gold: { id: 'gold', name: 'Gold', rank: 3, color: '#ffd700', baseImage: 'https://i.imghippo.com/files/tUt8745JBc.png', animationTier: 3 },
    rotm: { id: 'rotm', name: 'ROTM', rank: 4, color: '#e364a7', baseImage: 'https://i.imghippo.com/files/UGRy5126YM.png', animationTier: 4 },
    icon: { id: 'icon', name: 'Icon', rank: 5, color: '#00c7e2', baseImage: 'https://i.imghippo.com/files/PjIu1716584980.png', animationTier: 4 },
    event: { id: 'event', name: 'Event', rank: 6, color: '#33ffdd', baseImage: 'https://i.imghippo.com/files/jdCC2070F.png', animationTier: 4 },
    legend: { id: 'legend', name: 'Legend', rank: 7, color: '#ffffff', baseImage: 'https://i.imghippo.com/files/jdCC2070F.png', animationTier: 4 },
};

interface RarityContextType {
    rarities: Record<string, RarityDefinition>;
    sortedRarities: RarityDefinition[];
    getRarityDef: (id: string) => RarityDefinition;
}

const RarityContext = createContext<RarityContextType>({
    rarities: DEFAULT_RARITIES,
    sortedRarities: Object.values(DEFAULT_RARITIES),
    getRarityDef: (id) => DEFAULT_RARITIES[id] || DEFAULT_RARITIES['bronze'],
});

export const useRarity = () => useContext(RarityContext);

export const RarityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [customRarities, setCustomRarities] = useState<Record<string, RarityDefinition>>({});

    useEffect(() => {
        // Sync custom rarities from Firestore
        const unsub = onSnapshot(doc(db, 'settings', 'rarities'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.list && Array.isArray(data.list)) {
                    const map: Record<string, RarityDefinition> = {};
                    data.list.forEach((r: RarityDefinition) => {
                        map[r.id] = r;
                    });
                    setCustomRarities(map);
                }
            }
        });
        return () => unsub();
    }, []);

    const allRarities = { ...DEFAULT_RARITIES, ...customRarities };
    
    const sortedRarities = Object.values(allRarities).sort((a: RarityDefinition, b: RarityDefinition) => a.rank - b.rank);

    const getRarityDef = (id: string) => {
        // Fallback to bronze if rarity ID is missing or invalid
        return allRarities[id] || allRarities['bronze'];
    };

    return (
        <RarityContext.Provider value={{ rarities: allRarities, sortedRarities, getRarityDef }}>
            {children}
        </RarityContext.Provider>
    );
};
