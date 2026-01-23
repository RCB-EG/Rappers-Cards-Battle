
import { Card } from '../types';

/**
 * A centralized object containing URLs for all sound effects in the game.
 */
export const sfx = {
    // --- UI & Interactions ---
    buttonClick: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8b8495374.mp3',
    purchase: 'https://cdn.pixabay.com/audio/2024/09/13/audio_7a60c070f7.mp3',
    notification: 'https://od.lk/s/NTdfMTAyMDczMzI2Xw/Notification.wav',

    // --- Rewards & Objectives ---
    tasksComplete: 'https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3',
    rewardClaimed: 'https://od.lk/s/NTdfMTAyMDczMzIzXw/Claim%20reward.wav',
    success: 'https://cdn.pixabay.com/audio/2021/08/09/audio_0ac432d435.mp3', // Generic Victory
    rankUp: 'https://od.lk/s/NTdfMTAyMDczMzMxXw/PvE%20Rank%20up.mp3',

    // --- Pack Opening (Cinematic) ---
    packBuildup: 'https://od.lk/s/NTdfMTAxMjM1MjAxXw/Build%20up.mp3',
    revealBronzeSilver: 'https://od.lk/s/NTdfMTAxMjM1MjAwXw/Bronze%20and%20Silver.mp3',
    revealGold: 'https://cdn.pixabay.com/audio/2022/01/18/audio_82335f9923.mp3', // Default Gold Sparkle
    revealIcon: 'https://od.lk/s/NTdfMTAxMjM1MjA1Xw/Icon.mp3',
    revealRotm: 'https://od.lk/s/NTdfMTAxMjM1MjA2Xw/ROTM%20Packed.mp3',

    // --- Rarity-Based Attacks ---
    attackBronzeSilver: 'https://od.lk/s/NTdfMTAyMDczMzI5Xw/Bronze%2CSilver%20Attack.mp3',
    attackGold: 'https://od.lk/s/NTdfMTAyMDczMzM0Xw/Gold%20Attack.mp3',
    attackIcon: 'https://od.lk/s/NTdfMTAyMDczMzMzXw/Icon%20Attack.mp3',
    attackRotm: 'https://od.lk/s/NTdfMTAyMDczMzI4Xw/ROTM%20Attack.wav',

    // --- Superpowers ---
    spCareerKiller: 'https://od.lk/s/NTdfMTAyMDczMzIxXw/Career%20Killer.mp3',
    spChopper: 'https://od.lk/s/NTdfMTAyMDczMzIyXw/Chopper.mp3',
    spFlowSwitcher: 'https://od.lk/s/NTdfMTAyMDczMzI0Xw/Flow%20Switcher.wav',
    spFreestyler: 'https://od.lk/s/NTdfMTAyMDczMzI1Xw/Freestyler.mp3',
    spPunchline: 'https://od.lk/s/NTdfMTAyMDczMzI3Xw/Punchline.mp3',
    spRhymesCrafter: 'https://od.lk/s/NTdfMTAyMDczMzMyXw/Rhymes%20Crafter.mp3',
    spShowMaker: 'https://od.lk/s/NTdfMTAyMDczMzE4Xw/ShowMaker.mp3',
    spTheArtist: 'https://od.lk/s/NTdfMTAyMDczMzE5Xw/The%20Artist.mp3',
    spWordsBender: 'https://od.lk/s/NTdfMTAyMDczMzIwXw/Words%20Bender.mp3',

    // --- Generic Effects ---
    battleBuff: 'https://cdn.pixabay.com/audio/2024/05/20/audio_5cc7526735.mp3',
    battleDebuff: 'https://cdn.pixabay.com/audio/2022/03/15/audio_a9a4732057.mp3',
    battleHeal: 'https://cdn.pixabay.com/audio/2022/03/24/audio_c3963205c0.mp3',
    battleStun: 'https://cdn.pixabay.com/audio/2022/03/15/audio_de3622272e.mp3',
    battleShot: 'https://cdn.pixabay.com/audio/2022/03/10/audio_1e309e5192.mp3',
    battleAttackUltimate: 'https://cdn.pixabay.com/audio/2022/03/10/audio_7250269f24.mp3',
};

export const battleMusicTracks = [
    'https://od.lk/s/NTdfMTAxMTA3MDY2Xw/Game%20Music%2002.mp3',
    'https://od.lk/s/NTdfMTAxMTA3MDY3Xw/Game%20Music%2003.mp3',
    'https://od.lk/s/NTdfMTAxMTA3MDY4Xw/Game%20Music%2004.mp3',
    'https://od.lk/s/NTdfMTAyMDQ4NTk4Xw/New%20Game%20Music%20.mp3',
    'https://od.lk/s/NTdfMTAyMDQ4NTk3Xw/New%20Game%20Music%2010.mp3',
    'https://od.lk/s/NTdfMTAyMDQ4NTk5Xw/New%20Game%20Music%202.mp3',
    'https://od.lk/s/NTdfMTAyMDQ4NjAxXw/New%20Game%20Music%204.mp3',
    'https://od.lk/s/NTdfMTAyMDQ4NjAyXw/New%20Game%20Music%205.mp3',
    'https://od.lk/s/NTdfMTAyMDQ4NTkzXw/New%20Game%20Music%206.mp3',
    'https://od.lk/s/NTdfMTAyMDQ4NTk0Xw/New%20Game%20Music%207.mp3',
    'https://od.lk/s/NTdfMTAyMDQ4NTk1Xw/New%20Game%20Music%208.mp3',
    'https://od.lk/s/NTdfMTAyMDQ4NTk2Xw/New%20Game%20Music%209.mp3',
];

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
