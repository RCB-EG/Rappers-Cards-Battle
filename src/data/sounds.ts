
import { Card } from '../types';

/**
 * A centralized object containing URLs for all sound effects in the game.
 * Sound effects have been removed.
 */
export const sfx = {
    // --- UI & Interactions ---
    buttonClick: '', 
    purchase: '', 
    
    // --- Rewards & Objectives ---
    tasksComplete: '', 
    rewardClaimed: '', 
    success: '', 
    
    // --- Pack Opening (Cinematic) ---
    packBuildup: '', 
    revealBronzeSilver: '', 
    revealGold: '', 
    revealIcon: '', 
    revealRotm: '', 
    
    // --- Epic Battle Sounds ---
    battleAttackLight: '', 
    battleAttackMedium: '', 
    battleAttackHeavy: '', 
    battleAttackUltimate: '', 
    battleBuff: '', 
    battleDebuff: '', 
    battleHeal: '', 
    battleStun: '', 
    battleShot: '', 
};

/**
 * Selects the correct card reveal sound based on its rarity.
 * @param rarity The rarity of the card.
 * @returns The key for the corresponding sound effect in the `sfx` object.
 */
export const getRevealSfxKey = (rarity: Card['rarity']): keyof typeof sfx => {
    switch (rarity) {
        case 'bronze':
        case 'silver':
            return 'revealBronzeSilver';
        case 'gold':
            return 'revealGold';
        case 'icon':
            return 'revealIcon';
        case 'rotm':
            return 'revealRotm';
        case 'legend':
        case 'event':
        default:
            return 'revealIcon';
    }
};
