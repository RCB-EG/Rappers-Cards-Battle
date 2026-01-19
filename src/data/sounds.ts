
import { Card } from '../types';

/**
 * A centralized object containing URLs for all sound effects in the game.
 */
export const sfx = {
    // --- UI & Interactions ---
    buttonClick: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8b8495374.mp3', // Short UI Click
    purchase: 'https://cdn.pixabay.com/audio/2024/09/13/audio_7a60c070f7.mp3', // Cash Register Cha-Ching

    // --- Rewards & Objectives ---
    tasksComplete: 'https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3', // Success Chime
    rewardClaimed: 'https://cdn.pixabay.com/audio/2024/08/29/audio_220963236e.mp3', // Coin Collect
    success: 'https://cdn.pixabay.com/audio/2021/08/09/audio_0ac432d435.mp3', // Victory Fanfare

    // --- Pack Opening (Cinematic) ---
    packBuildup: 'https://cdn.pixabay.com/audio/2022/03/10/audio_55a2933083.mp3', // Drum Roll Tension
    revealBronzeSilver: 'https://cdn.pixabay.com/audio/2022/03/15/audio_2b292c3006.mp3', // Swoosh
    revealGold: 'https://cdn.pixabay.com/audio/2022/01/18/audio_82335f9923.mp3', // Magical Sparkle
    revealIcon: 'https://cdn.pixabay.com/audio/2022/03/24/audio_32c25c6c2b.mp3', // Epic Boom
    revealRotm: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3', // Sci-Fi Reveal

    // --- Epic Battle Sounds ---
    battleAttackLight: 'https://cdn.pixabay.com/audio/2022/03/15/audio_731473624e.mp3', // Quick Punch
    battleAttackMedium: 'https://cdn.pixabay.com/audio/2022/03/15/audio_59357425f8.mp3', // Heavy Hit
    battleAttackHeavy: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c233150537.mp3', // Explosion Impact
    battleAttackUltimate: 'https://cdn.pixabay.com/audio/2022/03/10/audio_7250269f24.mp3', // Large Beam/Blast
    battleBuff: 'https://cdn.pixabay.com/audio/2024/05/20/audio_5cc7526735.mp3', // Power Up
    battleDebuff: 'https://cdn.pixabay.com/audio/2022/03/15/audio_a9a4732057.mp3', // Glitch/Negative
    battleHeal: 'https://cdn.pixabay.com/audio/2022/03/24/audio_c3963205c0.mp3', // Magical Heal
    battleStun: 'https://cdn.pixabay.com/audio/2022/03/15/audio_de3622272e.mp3', // Electric Zap
    battleShot: 'https://cdn.pixabay.com/audio/2022/03/10/audio_1e309e5192.mp3', // Laser Shot
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
