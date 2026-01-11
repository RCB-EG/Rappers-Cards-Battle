import { Card } from '../types';

/**
 * A centralized object containing URLs for all sound effects in the game.
 */
export const sfx = {
    buttonClick: 'https://od.lk/s/NTdfMTAxMjM1MjAyXw/Button.mp3',
    tasksComplete: 'https://od.lk/s/NTdfMTAxMTE0OTgzXw/skill-attack-combo-music-note-5-384965.mp3',
    rewardClaimed: 'https://od.lk/s/NTdfMTAxMjM1MTk5Xw/Reward%20Claimed.mp3',
    packBuildup: 'https://od.lk/s/NTdfMTAxMjM1MjAxXw/Build%20up.mp3',
    revealBronzeSilver: 'https://od.lk/s/NTdfMTAxMjM1MjAwXw/Bronze%20and%20Silver.mp3',
    revealGold: 'https://od.lk/s/NTdfMTAxMjM1MjA0Xw/Gold.mp3',
    revealIcon: 'https://od.lk/s/NTdfMTAxMjM1MjA1Xw/Icon.mp3',
    revealRotm: 'https://od.lk/s/NTdfMTAxMjM1MjA2Xw/ROTM%20Packed.mp3',
    purchase: 'https://archive.org/download/cash-register-sound/cash-register-sound.mp3',
    success: 'https://archive.org/download/wind-chime-1/wind-chime-1.mp3',
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
            // Fallback for other high-tier rarities
            return 'revealGold';
    }
};