
import { Card, PackType, PackData, FBCChallenge, Evolution, FormationLayoutId, Stats, Objective, PlayerPickConfig, Rank, BlitzRank, Rarity } from '../types';

export const DEV_EMAILS = [
    'manualman6@gmail.com'
];

export const PROMO_RARITIES: Rarity[] = ['rotm', 'legend', 'event'];

const generateStats = (ovr: number): Stats => {
    const base = ovr > 70 ? ovr - 10 : ovr - 5;
    const deviation = 8;
    const generateStat = () => Math.min(99, Math.max(50, Math.round(base + (Math.random() * (deviation * 2) - deviation))));
    return {
        lyrc: generateStat(),
        flow: generateStat(),
        sing: generateStat(),
        live: generateStat(),
        diss: generateStat(),
        char: generateStat(),
    };
};

export interface RankConfig {
    winsToPromote: number;
    cpuOvrRange: [number, number]; // Min, Max OVR for CPU cards
    aiDifficulty: 'dumb' | 'normal' | 'smart' | 'expert';
    teamSize: number; // Number of cards in battle
    promotionReward: {
        coins: number;
        packs: PackType[];
        picks: string[]; // IDs from playerPickConfigs
    };
}

export interface BlitzRankConfig {
    winsToPromote: number;
    promotionReward: {
        coins: number;
        bp: number;
        packs: PackType[];
        picks: string[];
    };
}

export const blitzRankSystem: Record<BlitzRank, BlitzRankConfig> = {
    5: {
        winsToPromote: 5,
        promotionReward: {
            coins: 12000,
            bp: 600,
            packs: ['builder', 'builder', 'builder', 'builder'],
            picks: ['1of3_75', '1of3_75']
        }
    },
    4: {
        winsToPromote: 6,
        promotionReward: {
            coins: 35000,
            bp: 1000,
            packs: ['special', 'special', 'builder', 'builder', 'builder'],
            picks: ['1of4_80', '1of4_80']
        }
    },
    3: {
        winsToPromote: 8,
        promotionReward: {
            coins: 75000,
            bp: 1500,
            packs: ['special', 'special', 'special', 'special', 'builder', 'builder', 'builder', 'builder', 'builder'],
            picks: ['2of5_82', '2of5_82']
        }
    },
    2: {
        winsToPromote: 10,
        promotionReward: {
            coins: 100000,
            bp: 2000,
            packs: ['legendary', 'special', 'special', 'special', 'special', 'special'],
            picks: ['2of10_85', '2of10_85', '1of2_icon']
        }
    },
    1: {
        winsToPromote: 5, // Loop every 5 wins
        promotionReward: {
            coins: 150000,
            bp: 3500,
            packs: ['legendary', 'legendary', 'special', 'special', 'special', 'special', 'special'],
            picks: ['2of10_85', '2of10_85', '1of2_icon', '1of2_rotm']
        }
    }
};

export const rankSystem: Record<Rank, RankConfig> = {
    'Bronze': {
        winsToPromote: 5,
        cpuOvrRange: [58, 68], // Very Weak
        aiDifficulty: 'dumb',
        teamSize: 5,
        promotionReward: {
            coins: 6000,
            packs: ['builder', 'builder', 'builder'],
            picks: ['1of2']
        }
    },
    'Silver': {
        winsToPromote: 8,
        cpuOvrRange: [74, 84], // Moderate
        aiDifficulty: 'normal',
        teamSize: 6,
        promotionReward: {
            coins: 18000,
            packs: ['special', 'builder', 'builder'],
            picks: ['1of3_75', '1of3_75']
        }
    },
    'Gold': {
        winsToPromote: 12,
        cpuOvrRange: [85, 92], // Strong
        aiDifficulty: 'smart',
        teamSize: 7,
        promotionReward: {
            coins: 45000,
            packs: ['special', 'special', 'builder', 'builder', 'builder', 'builder', 'builder'],
            picks: ['1of5', '1of5']
        }
    },
    'Legend': {
        winsToPromote: 5, // Repeating loop
        cpuOvrRange: [93, 99], // God Tier
        aiDifficulty: 'expert',
        teamSize: 8,
        promotionReward: {
            coins: 80000,
            packs: ['legendary', 'special', 'special', 'special', 'special'],
            picks: ['2of10', '2of10']
        }
    }
};

export const superpowerIcons: Record<string, string> = {
    'Rhymes Crafter': 'https://i.imghippo.com/files/vNrv7527Vlk.png',
    'Rhyme Crafter': 'https://i.imghippo.com/files/vNrv7527Vlk.png',
    'Show Maker': 'https://i.imghippo.com/files/RQb3623EB.png',
    'ShowMaker': 'https://i.imghippo.com/files/RQb3623EB.png',
    'The Artist': 'https://i.imghippo.com/files/um8756xU.png',
    'Words Bender': 'https://i.imghippo.com/files/phdJ6111L.png',
    'Word Bender': 'https://i.imghippo.com/files/phdJ6111L.png',
    'Storyteller': 'https://i.imghippo.com/files/iCc6391Tg.png',
    'StoryTeller': 'https://i.imghippo.com/files/iCc6391Tg.png',
    'Battler': 'https://i.imghippo.com/files/KET1640s.png',
    'Career Killer': 'https://i.imghippo.com/files/tev2511DrE.png',
    'Chopper': 'https://i.imghippo.com/files/Fg5274pck.png',
    'Flow Switcher': 'https://i.imghippo.com/files/dHI7636jUs.png',
    'Freestyler': 'https://i.imghippo.com/files/Fkz1064WCk.png',
    'Notes Master': 'https://i.imghippo.com/files/em5378FZE.png',
    'Note Master': 'https://i.imghippo.com/files/em5378FZE.png',
    'Punchline Machine': 'https://i.imghippo.com/files/EFHO4474cYk.png',
};

export const SUPERPOWER_DESC: Record<string, string> = {
    'Rhymes Crafter': '☠️ Deals damage over time for 3 turns.',
    'Rhyme Crafter': '☠️ Deals damage over time for 3 turns.',
    'Punchline Machine': '💫 Stuns target, forcing opponent to skip next turn.',
    'Words Bender': '🩸 Drains life from opponent to heal self.',
    'Word Bender': '🩸 Drains life from opponent to heal self.',
    'Chopper': '🌊 AoE Shockwave: Damages ALL enemy cards.',
    'Show Maker': '📢 Permanently increases Attack of all allies.',
    'ShowMaker': '📢 Permanently increases Attack of all allies.',
    'Flow Switcher': '⚡ Gain an extra attack action immediately.',
    'Notes Master': '🛡️ Taunt: Enemies MUST attack this card next turn.',
    'Note Master': '🛡️ Taunt: Enemies MUST attack this card next turn.',
    'Career Killer': '💀 INSTANTLY defeats target if HP is below 30%.',
    'Battler': '🤐 Silences target: Disables their Special Attacks.',
    'The Artist': '🎨 Copies stats of the strongest enemy card.',
    'Freestyler': '🎲 50% chance for 3x Damage, 50% chance to fail.',
    'Storyteller': '👻 Become Untargetable for 1 turn.',
    'StoryTeller': '👻 Become Untargetable for 1 turn.',
};

// A collection of all possible cards in the game.
// Old cards are marked with legacy: true to preserve their original unscaled appearance.
export const allCards: Card[] = [
  // Bronze
  { id: 'b1', name: 'Bebo', ovr: 62, rarity: 'bronze', image: 'https://i.imghippo.com/files/GJZ1767yhY.png', value: 200, superpowers: [], stats: { lyrc: 43, flow: 51, sing: 60, live: 68, diss: 42, char: 65 }, legacy: true },
  { id: 'b2', name: 'Casper', ovr: 60, rarity: 'bronze', image: 'https://i.imghippo.com/files/mVch9821OnQ.png', value: 200, superpowers: [], stats: { lyrc: 39, flow: 53, sing: 55, live: 61, diss: 44, char: 70 }, legacy: true },
  { id: 'b3', name: 'Dena Phantom', ovr: 69, rarity: 'bronze', image: 'https://i.imghippo.com/files/LEY2430zeo.png', value: 200, superpowers: [], stats: { lyrc: 47, flow: 61, sing: 76, live: 73, diss: 52, char: 82 }, legacy: true },
  { id: 'b4', name: 'Sagy', ovr: 66, rarity: 'bronze', image: 'https://i.imghippo.com/files/zuiU4805CSk.png', value: 450, superpowers: [], stats: { lyrc: 50, flow: 59, sing: 77, live: 80, diss: 41, char: 78 }, legacy: true },
  { id: 'b5', name: 'Xander Ghost', ovr: 69, rarity: 'bronze', image: 'https://i.imghippo.com/files/Shjt4610vb.png', value: 600, superpowers: [], stats: { lyrc: 60, flow: 70, sing: 76, live: 60, diss: 43, char: 50 }, legacy: true },
  { id: 'b6', name: 'Xena', ovr: 68, rarity: 'bronze', image: 'https://i.imghippo.com/files/Hyu6300uKc.png', value: 400, superpowers: [], stats: { lyrc: 42, flow: 50, sing: 90, live: 80, diss: 41, char: 60 }, legacy: true },
  { id: 'b7', name: 'K-Vibe', ovr: 64, rarity: 'bronze', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855870/K-Vibe_Bronze_64_jbqgw7.webp', value: 200, superpowers: [], stats: { lyrc: 52, flow: 60, sing: 55, live: 68, diss: 45, char: 62 }, legacy: true },
  { id: 'b8', name: 'Luna', ovr: 67, rarity: 'bronze', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855871/Luna_Bronze_67_mxk98l.webp', value: 200, superpowers: [], stats: { lyrc: 58, flow: 54, sing: 65, live: 70, diss: 50, char: 68 }, legacy: true },
  { id: 'b9', name: 'Big Tone', ovr: 61, rarity: 'bronze', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855869/Big_Tone_Bronze_61_m4oxte.webp', value: 200, superpowers: [], stats: { lyrc: 48, flow: 50, sing: 40, live: 65, diss: 55, char: 58 }, legacy: true },
  { id: 'b10', name: 'Jinx', ovr: 65, rarity: 'bronze', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855869/Jinx_Bronze_65_pqabgg.webp', value: 200, superpowers: [], stats: { lyrc: 60, flow: 62, sing: 45, live: 58, diss: 60, char: 50 }, legacy: true },
  { id: 'b11', name: 'Rhyme-Z', ovr: 63, rarity: 'bronze', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855872/Rhyme-Z_Bronze_63_ccjagi.webp', value: 200, superpowers: [], stats: { lyrc: 55, flow: 58, sing: 42, live: 60, diss: 52, char: 65 }, legacy: true },
  
  // New Bronze (Default scaling applies)
  { id: 'b12', name: 'Kimo B', ovr: 63, rarity: 'bronze', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855870/KIMO_B_BRONZE_63_eijayb.webp', value: 200, superpowers: [], stats: { lyrc: 51, flow: 59, sing: 56, live: 67, diss: 44, char: 61 } },
  { id: 'b13', name: 'UglyMoss', ovr: 62, rarity: 'bronze', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855873/Uglymoss_BRONZE_62_iv4pzo.webp', value: 200, superpowers: [], stats: { lyrc: 49, flow: 56, sing: 54, live: 65, diss: 44, char: 64 } },
  { id: 'b14', name: 'Xaytog', ovr: 69, rarity: 'bronze', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855874/XAYTOG_BRONZE_69_bdoix1.webp', value: 400, superpowers: [], stats: { lyrc: 44, flow: 72, sing: 70, live: 45, diss: 44, char: 82 } },
  
  // Silver
  { id: 's1', name: 'Flex', ovr: 78, rarity: 'silver', image: 'https://i.imghippo.com/files/pSrm7343Sg.png', value: 900, superpowers: [], stats: { lyrc: 72, flow: 75, sing: 53, live: 85, diss: 74, char: 86 }, legacy: true },
  { id: 's2', name: 'Lella Fadda', ovr: 79, rarity: 'silver', image: 'https://i.imghippo.com/files/cEG8980udU.png', value: 900, superpowers: [], stats: { lyrc: 73, flow: 80, sing: 84, live: 82, diss: 68, char: 82 }, legacy: true },
  { id: 's3', name: 'Lil Baba', ovr: 77, rarity: 'silver', image: 'https://i.imghippo.com/files/WpD5955mtw.png', value: 750, superpowers: [], stats: { lyrc: 78, flow: 82, sing: 77, live: 70, diss: 69, char: 77 }, legacy: true },
  { id: 's4', name: 'Perrie', ovr: 79, rarity: 'silver', image: 'https://i.imghippo.com/files/wzuu2721XxY.png', value: 650, superpowers: [], stats: { lyrc: 75, flow: 80, sing: 80, live: 79, diss: 74, char: 80 }, legacy: true },
  
  // New Silver (Default scaling applies)
  { id: 's5', name: 'Qetoo', ovr: 75, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855506/Qetoo_SILVER_75_cdju4q.webp', value: 600, superpowers: [], stats: { lyrc: 77, flow: 79, sing: 78, live: 70, diss: 66, char: 67 } },
  { id: 's6', name: 'Farghly', ovr: 79, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855505/Farghly_SILVER_79_xvaqaa.webp', value: 850, superpowers: [], stats: { lyrc: 73, flow: 77, sing: 78, live: 84, diss: 79, char: 83 } },
  { id: 's7', name: 'Turk', ovr: 73, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855508/TURK_SILVER_73_kol9aj.webp', value: 500, superpowers: [], stats: { lyrc: 73, flow: 74, sing: 72, live: 68, diss: 66, char: 72 } },
  { id: 's8', name: 'Begad Osama', ovr: 79, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855504/Begad_Osama_SILVER_79_wmgro0.webp', value: 850, superpowers: [], stats: { lyrc: 80, flow: 80, sing: 76, live: 68, diss: 66, char: 72 } },
  { id: 's9', name: 'TaffyRaps', ovr: 77, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855508/TAFFYRAPS_SILVER_77_pbee4a.webp', value: 700, superpowers: [], stats: { lyrc: 76, flow: 79, sing: 77, live: 70, diss: 65, char: 73 } },
  { id: 's10', name: 'Uzu', ovr: 74, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855509/Uzu_SILVER_74_bap5bi.webp', value: 550, superpowers: [], stats: { lyrc: 74, flow: 76, sing: 75, live: 60, diss: 62, char: 71 } },
  { id: 's11', name: 'Young Giza', ovr: 76, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855510/YOUNG_GIZA_SILVER_76_p8oumj.webp', value: 650, superpowers: [], stats: { lyrc: 76, flow: 82, sing: 79, live: 67, diss: 65, char: 76 } },
  { id: 's12', name: 'Seif Kix', ovr: 79, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855507/SEIF_KIX_SILVER_79_rm63qj.webp', value: 850, superpowers: [], stats: { lyrc: 76, flow: 80, sing: 80, live: 75, diss: 72, char: 78 } },
  { id: 's13', name: 'Kingoo', ovr: 79, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855505/Kingoo_SILVER_79_yiangb.webp', value: 850, superpowers: [], stats: { lyrc: 76, flow: 80, sing: 80, live: 75, diss: 72, char: 78 } },
  { id: 's14', name: 'KareemG', ovr: 77, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855505/KareemG_SILVER_77_qtgwhh.webp', value: 750, superpowers: [], stats: { lyrc: 81, flow: 79, sing: 75, live: 68, diss: 71, char: 72 } },
  { id: 's15', name: 'Youssef Rousse', ovr: 76, rarity: 'silver', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855504/Youssef_Rousse_SILVER_76_xpktag.webp', value: 650, superpowers: [], stats: { lyrc: 78, flow: 82, sing: 79, live: 68, diss: 66, char: 76 } },

  // Gold
  { id: 'g1', name: 'Abo El Anwar', ovr: 86, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854277/Abo_El_Anwar_Gold_86_tmb4mb.webp', value: 20000, superpowers: [], stats: { lyrc: 85, flow: 86, sing: 83, live: 84, diss: 83, char: 81 }, legacy: true },
  { id: 'g2', name: 'Abyusif', ovr: 91, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854277/Abyusif_Gold_91_Rhymes_Crafter_pzduon.webp', value: 200000, superpowers: ['Rhymes Crafter'], stats: { lyrc: 93, flow: 91, sing: 86, live: 89, diss: 87, char: 92 }, legacy: true },
  { id: 'g3', name: 'Afroto', ovr: 89, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854277/Afroto_Gold_89_Notes_Master_ivfbco.webp', value: 92000, superpowers: ['Notes Master'], stats: { lyrc: 88, flow: 88, sing: 94, live: 89, diss: 84, char: 88 }, legacy: true },
  { id: 'g4', name: 'Arsenik', ovr: 88, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854277/Arsenik_Gold_88_Flow_Switcher_qcc1ar.webp', value: 57000, superpowers: ['Flow Switcher'], stats: { lyrc: 90, flow: 90, sing: 86, live: 83, diss: 86, char: 84 }, legacy: true },
  { id: 'g5', name: 'Batistuta', ovr: 86, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854277/Batistuta_Gold_86_Notes_Master_coelxa.webp', value: 14000, superpowers: ['Notes Master'], stats: { lyrc: 80, flow: 85, sing: 88, live: 84, diss: 78, char: 87 }, legacy: true },
  { id: 'g6', name: 'DizzyTooSkinny', ovr: 86, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854277/DizzyTooSkinny_Gold_86_Notes_Master_sgtkww.webp', value: 25000, superpowers: ['Notes Master'], stats: { lyrc: 84, flow: 87, sing: 87, live: 80, diss: 78, char: 82 }, legacy: true },
  { id: 'g7', name: 'El Joker', ovr: 89, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854277/El_Joker_Gold_89_Storyteller_bezgt2.webp', value: 97000, superpowers: ['Storyteller'], stats: { lyrc: 91, flow: 86, sing: 80, live: 85, diss: 89, char: 90 }, legacy: true },
  { id: 'g8', name: 'Hala', ovr: 84, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854278/Hala_Gold_84_Notes_Master_ggkayh.webp', value: 3000, superpowers: ['Notes Master'], stats: { lyrc: 82, flow: 85, sing: 88, live: 80, diss: 76, char: 80 }, legacy: true },
  { id: 'g9', name: 'Hussein', ovr: 84, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854279/Hussein_Gold_84_lruwjq.webp', value: 4500, superpowers: [], stats: { lyrc: 80, flow: 85, sing: 84, live: 87, diss: 80, char: 86 }, legacy: true },
  { id: 'g10', name: 'Kareem Ossama', ovr: 84, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854279/Kareem_Ossama_Gold_84_slozrp.webp', value: 4800, superpowers: [], stats: { lyrc: 84, flow: 85, sing: 83, live: 82, diss: 78, char: 82 }, legacy: true },
  { id: 'g11', name: 'Lege-Cy', ovr: 89, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854280/Lege-Cy_Gold_89_Notes_Master_p9dltw.webp', value: 85000, superpowers: ['Notes Master'], stats: { lyrc: 87, flow: 88, sing: 90, live: 85, diss: 82, char: 88 }, legacy: true },
  { id: 'g12', name: 'Mared Gold', ovr: 82, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854281/Mared_Gold_82_qpkm4w.webp', value: 1000, superpowers: [], stats: { lyrc: 86, flow: 86, sing: 80, live: 79, diss: 80, char: 82 }, legacy: true },
  { id: 'g13', name: 'Marwan Moussa', ovr: 90, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854281/Marwan_Moussa_Gold_90_Storyteller_pirrb8.webp', value: 120000, superpowers: ['Storyteller'], stats: { lyrc: 90, flow: 89, sing: 88, live: 86, diss: 84, char: 90 }, legacy: true },
  { id: 'g14', name: 'Marwan Pablo', ovr: 89, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854281/Marwan_Pablo_Gold_89_ShowMaker_ddaopi.webp', value: 100000, superpowers: ['Show Maker'], stats: { lyrc: 86, flow: 88, sing: 87, live: 88, diss: 82, char: 90 }, legacy: true },
  { id: 'g15', name: 'Moscow', ovr: 85, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854282/Moscow_Gold_85_cfazhf.webp', value: 6000, superpowers: [], stats: { lyrc: 86, flow: 86, sing: 84, live: 80, diss: 80, char: 82 }, legacy: true },
  { id: 'g16', name: 'Mousv', ovr: 85, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854283/Mousv_Gold_85_gfsz2j.webp', value: 9000, superpowers: [], stats: { lyrc: 80, flow: 83, sing: 86, live: 83, diss: 80, char: 86 }, legacy: true },
  { id: 'g17', name: 'Muhab', ovr: 83, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854284/Muhab_Gold_84_gswdbh.webp', value: 5100, superpowers: [], stats: { lyrc: 82, flow: 85, sing: 85, live: 82, diss: 76, char: 83 }, legacy: true },
  { id: 'g18', name: 'Nobi', ovr: 83, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854285/Nobi_Gold_83_dopbbk.webp', value: 1900, superpowers: [], stats: { lyrc: 80, flow: 84, sing: 83, live: 80, diss: 78, char: 80 }, legacy: true },
  { id: 'g19', name: 'Santa', ovr: 88, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854287/Santa_Gold_88_Word_Bender_iolquu.webp', value: 55000, superpowers: ['Word Bender'], stats: { lyrc: 90, flow: 89, sing: 82, live: 86, diss: 85, char: 86 }, legacy: true },
  { id: 'g20', name: 'Shahyn', ovr: 88, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854288/Shahyn_Gold_88_Show_Maker_gcrncw.webp', value: 70000, superpowers: ['Show Maker'], stats: { lyrc: 86, flow: 85, sing: 84, live: 87, diss: 83, char: 91 }, legacy: true },
  { id: 'g21', name: 'Wegz', ovr: 90, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854291/Wegz_Gold_90_The_Artist_hrw3e7.webp', value: 140000, superpowers: ['The Artist'], stats: { lyrc: 86, flow: 87, sing: 92, live: 90, diss: 81, char: 90 }, legacy: true },
  { id: 'g22', name: 'Young T', ovr: 83, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854292/Young_T_Gold_83_Flow_Switcher_f23rlr.webp', value: 2200, superpowers: ['Flow Switcher'], stats: { lyrc: 80, flow: 87, sing: 82, live: 78, diss: 76, char: 79 }, legacy: true },
  { id: 'g23', name: 'Zap', ovr: 80, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769854292/Zap_Gold_80_StoryTeller_xyixw3.webp', value: 1200, superpowers: ['StoryTeller'], stats: { lyrc: 77, flow: 80, sing: 70, live: 88, diss: 65, char: 88 }, legacy: true },
  { id: 'g24', name: '3ab3az', ovr: 82, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855165/3ab3az_Gold_82_o4wpwg.webp', value: 2200, superpowers: [], stats: { lyrc: 83, flow: 83, sing: 82, live: 82, diss: 78, char: 82 }, legacy: true },
  { id: 'g25', name: 'Wingii', ovr: 85, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855164/Wingii_Gold_85_bysq9o.webp', value: 3000, superpowers: [], stats: { lyrc: 83, flow: 85, sing: 84, live: 84, diss: 82, char: 84 }, legacy: true },
  { id: 'g26', name: 'Dzel Uzi', ovr: 84, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855168/Dzel_Uzi_Gold_84_Rhymes_Crafter_tcl0fd.webp', value: 6000, superpowers: ['Rhymes Crafter'], stats: { lyrc: 84, flow: 85, sing: 79, live: 82, diss: 83, char: 81 }, legacy: true },
  { id: 'g27', name: 'Raptor', ovr: 84, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855172/Raptor_Gold_84_Flow_Switcher_ck8ytv.webp', value: 5100, superpowers: ['Flow Switcher'], stats: { lyrc: 83, flow: 86, sing: 83, live: 82, diss: 80, char: 81 }, legacy: true },
  { id: 'g28', name: 'Vortex', ovr: 90, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855174/Vortex_Gold_90_Words_Bender_mjgd20.webp', value: 85000, superpowers: ['Words Bender'], stats: { lyrc: 91, flow: 93, sing: 85, live: 86, diss: 85, char: 88 }, legacy: true },
  { id: 'g29', name: 'Wezza', ovr: 83, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855175/Wezza_Gold_83_bqo3il.webp', value: 3800, superpowers: [], stats: { lyrc: 78, flow: 81, sing: 85, live: 84, diss: 77, char: 84 }, legacy: true },
  { id: 'g30', name: 'Yonyo', ovr: 82, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855164/Yonyo_Gold_82_ujvjwr.webp', value: 1950, superpowers: [], stats: { lyrc: 83, flow: 82, sing: 83, live: 79, diss: 77, char: 80 }, legacy: true },
  { id: 'g31', name: 'L5VAV', ovr: 84, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855168/L5VAV_GOLD_84_h8ehl8.webp', value: 6000, superpowers: [], stats: { lyrc: 83, flow: 85, sing: 84, live: 80, diss: 78, char: 79 }, customScaleX: 1.05 },
  { id: 'g32', name: 'Ziad Zaza', ovr: 86, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855164/Ziad_ZAZA_GOLD_86_fzxrqv.webp', value: 20000, superpowers: [], stats: { lyrc: 83, flow: 86, sing: 85, live: 88, diss: 78, char: 86 }, customScaleX: 1.05 },
  { id: 'g33', name: 'Lord', ovr: 82, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855169/Lord_GOLD_82_cfqzd9.webp', value: 2000, superpowers: [], stats: { lyrc: 82, flow: 83, sing: 75, live: 81, diss: 83, char: 80 }, customScaleX: 1.05 },
  { id: 'g34', name: 'X!NE', ovr: 81, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855164/X_NE_GOLD_81_u6orua.webp', value: 1800, superpowers: [], stats: { lyrc: 82, flow: 84, sing: 79, live: 78, diss: 74, char: 83 }, customScaleX: 1.05 },
  { id: 'g35', name: 'Mosalem', ovr: 81, rarity: 'gold', image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1769855169/Mosalem_GOLD_81_tpohhy.webp', value: 1800, superpowers: [], stats: { lyrc: 85, flow: 82, sing: 81, live: 80, diss: 77, char: 80 }, customScaleX: 1.05 },

  // Icon
  { id: 'i1', name: 'Adham', ovr: 93, rarity: 'icon', image: 'https://i.imghippo.com/files/LiUR1258JAY.png', value: 218000, superpowers: ['Rhymes Crafter', 'Punchline Machine'], stats: { lyrc: 93, flow: 91, sing: 86, live: 88, diss: 90, char: 90 }, legacy: true },
  { id: 'i2', name: 'E-money', ovr: 92, rarity: 'icon', image: 'https://i.imghippo.com/files/IUf5095X.png', value: 133000, superpowers: ['Chopper', 'Flow Switcher'], stats: { lyrc: 91, flow: 94, sing: 88, live: 86, diss: 88, char: 88 }, legacy: true },
  { id: 'i3', name: 'Kordy', ovr: 92, rarity: 'icon', image: 'https://i.imghippo.com/files/pbj5403oWU.png', value: 146000, superpowers: ['Show Maker'], stats: { lyrc: 86, flow: 86, sing: 86, live: 94, diss: 90, char: 95 }, legacy: true },
  { id: 'i4', name: 'Maleka', ovr: 91, rarity: 'icon', image: 'https://i.imghippo.com/files/tBh7317eHw.png', value: 112000, superpowers: ['The Artist'], stats: { lyrc: 86, flow: 89, sing: 88, live: 91, diss: 88, char: 91 }, legacy: true },
  { id: 'i5', name: 'Mc Amin', ovr: 94, rarity: 'icon', image: 'https://i.imghippo.com/files/CX3763rMw.png', value: 240000, superpowers: ['Show Maker', 'Flow Switcher'], stats: { lyrc: 90, flow: 92, sing: 87, live: 95, diss: 94, char: 93 }, legacy: true },
  { id: 'i6', name: 'Mody Rap', ovr: 91, rarity: 'icon', image: 'https://i.imghippo.com/files/XZgc4559n.png', value: 89000, superpowers: ['StoryTeller'], stats: { lyrc: 91, flow: 89, sing: 90, live: 87, diss: 88, char: 91 }, legacy: true },
  { id: 'i7', name: 'Romel B', ovr: 90, rarity: 'icon', image: 'https://i.imghippo.com/files/G4728haA.png', value: 91000, superpowers: ['Chopper'], stats: { lyrc: 89, flow: 92, sing: 86, live: 87, diss: 90, char: 88 }, legacy: true },

  // ROTM
  { id: 'r1', name: 'Abyusif', ovr: 92, rarity: 'rotm', image: 'https://i.imghippo.com/files/QGO2832Hw.png', value: 300000, superpowers: ['Rhyme Crafter', 'Word Bender'], stats: { lyrc: 94, flow: 92, sing: 88, live: 89, diss: 88, char: 92 }, legacy: true },
  { id: 'r2', name: 'Afroto', ovr: 90, rarity: 'rotm', image: 'https://i.imghippo.com/files/wyyJ2171NvE.png', value: 210000, superpowers: ['StoryTeller'], stats: { lyrc: 89, flow: 89, sing: 94, live: 90, diss: 84, char: 88 }, legacy: true },
  { id: 'r3', name: 'Arsenik', ovr: 89, rarity: 'rotm', image: 'https://i.imghippo.com/files/NNlV2642JHg.png', value: 160000, superpowers: ['Words Bender'], stats: { lyrc: 91, flow: 91, sing: 88, live: 83, diss: 86, char: 85 }, legacy: true },
  { id: 'r4', name: 'Lege-Cy', ovr: 90, rarity: 'rotm', image: 'https://i.imghippo.com/files/MnRi3278M.png', value: 180000, superpowers: ['StoryTeller'], stats: { lyrc: 89, flow: 88, sing: 92, live: 85, diss: 83, char: 88 }, legacy: true },
  { id: 'r5', name: 'Marwan Mousa', ovr: 91, rarity: 'rotm', image: 'https://i.imghippo.com/files/QFb6085DI.png', value: 234000, superpowers: ['StoryTeller', 'Word Bender'], stats: { lyrc: 91, flow: 90, sing: 90, live: 86, diss: 85, char: 90 }, legacy: true },
  { id: 'r6', name: 'Wegz', ovr: 91, rarity: 'rotm', image: 'https://i.imghippo.com/files/cci2034ZR.png', value: 250000, superpowers: ['The Artist', 'Notes Master'], stats: { lyrc: 88, flow: 88, sing: 93, live: 90, diss: 83, char: 90 }, legacy: true },
  
  // Legend
  {
    id: 'l1', name: 'The GOAT', ovr: 98, rarity: 'legend', image: 'https://api.dicebear.com/8.x/bottts/svg?seed=TheGOAT',
    stats: { lyrc: 99, flow: 99, sing: 98, live: 98, diss: 98, char: 99 },
    superpowers: ['Career Killer', 'The Artist', 'Words Bender', 'Flow Switcher'], value: 800000
  },
  
  // Evo Cards
  { 
    id: 'evo_abo_1', 
    name: 'Abo El Anwar', 
    ovr: 87, 
    rarity: 'event',
    image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1770119243/Abo_El_Anwar_Evo_87_Rhyme_Crafter_x1xj7f.webp', 
    value: 32000, 
    isPackable: false,
    superpowers: ['Rhyme Crafter'], 
    stats: { lyrc: 88, flow: 86, sing: 85, live: 90, diss: 84, char: 89 },
    legacy: true
  },
   { 
    id: 'evo_tommy_gun_1', 
    name: 'Tommy Gun', 
    ovr: 84, 
    rarity: 'event',
    image: 'https://res.cloudinary.com/dajbohgkl/image/upload/v1770119243/Tommy_Gun_Evo_84_t1wn9r.webp', 
    value: 7800, 
    isPackable: false,
    superpowers: ['Flow Switcher'], 
    stats: { lyrc: 85, flow: 88, sing: 82, live: 86, diss: 83, char: 85 },
    legacy: true
  },
  
  // FBC Cards
  {
    id: 'fbc_shehab_1',
    name: 'Shehab',
    ovr: 87,
    rarity: 'gold',
    image: 'https://i.imghippo.com/files/of4978Axs.png',
    value: 44000,
    isPackable: false,
    superpowers: ['Note Master'],
    stats: { lyrc: 86, flow: 87, sing: 85, live: 88, diss: 84, char: 86 },
    legacy: true
  },
  {
    id: 'fbc_tommy_gun_1',
    name: 'Tommy Gun',
    ovr: 83,
    rarity: 'gold',
    image: 'https://i.imghippo.com/files/vEc7611qrg.png',
    value: 4500,
    isPackable: false,
    superpowers: [],
    stats: { lyrc: 82, flow: 84, sing: 80, live: 85, diss: 81, char: 83 },
    legacy: true
  },
  {
    id: 'fbc_shabjdeed_1',
    name: 'Shabjdeed',
    ovr: 85,
    rarity: 'gold',
    image: 'https://i.imghippo.com/files/wgqS8075ng.png',
    value: 39500,
    isPackable: false,
    superpowers: [],
    stats: { lyrc: 85, flow: 86, sing: 84, live: 87, diss: 83, char: 85 },
    legacy: true
  },
  
  // Objective Cards
  {
    id: 'obj_ra3_1',
    name: 'Ra3',
    ovr: 85,
    rarity: 'gold',
    image: 'https://i.imghippo.com/files/iH4359ueo.png',
    value: 34000,
    isPackable: false,
    superpowers: ['Rhyme Crafter'],
    stats: { lyrc: 84, flow: 85, sing: 82, live: 86, diss: 88, char: 84 },
    legacy: true
  },
];


// Defines the properties of each pack type.
export const packs: Record<PackType, PackData> = {
  free: {
    cost: 0,
    bpCost: 0,
    rarityChances: {
      bronze: 70,
      silver: 25,
      gold: 5,
    },
  },
  bronze: {
    cost: 0,
    bpCost: 0,
    rarityChances: {
      bronze: 100,
    },
  },
  builder: {
    cost: 1200,
    bpCost: 200,
    rarityChances: {
      bronze: 50,
      silver: 40,
      gold: 10,
    },
  },
  special: {
    cost: 4000,
    bpCost: 650,
    rarityChances: {
      silver: 25,
      gold: 73,
      rotm: 1.5,
      icon: 0.5,
    },
  },
  legendary: {
    cost: 40000,
    bpCost: 6500,
    rarityChances: {
      gold: 75,
      rotm: 12,
      icon: 12,
      legend: 1,
    },
  },
};

export const fbcData: FBCChallenge[] = [
    {
        id: 'shehab_debut',
        title: 'shehab_debut_title',
        description: 'shehab_debut_desc',
        requirements: {
            cardCount: 11,
            exactRarityCount: { gold: 11 },
            minAvgOvr: 84
        },
        reward: { type: 'card', cardId: 'fbc_shehab_1' }
    },
    {
        id: 'tommy_gun_intro',
        title: 'tommy_gun_arrival_title',
        description: 'tommy_gun_arrival_desc',
        requirements: {
            cardCount: 7,
            exactRarityCount: { bronze: 3, silver: 3, gold: 1 },
        },
        reward: { type: 'card', cardId: 'fbc_tommy_gun_1' }
    },
    {
        id: 'shabjdeed_foundation',
        groupId: 'shabjdeed_main',
        groupFinalRewardCardId: 'fbc_shabjdeed_1',
        title: 'shabjdeed_foundation_title',
        description: 'shabjdeed_foundation_desc',
        requirements: {
            cardCount: 6,
            exactRarityCount: { bronze: 3, silver: 3 },
        },
        reward: { type: 'pack', details: 'free', bypassLimit: true }
    },
    {
        id: 'shabjdeed_golden_era',
        groupId: 'shabjdeed_main',
        title: 'shabjdeed_golden_era_title',
        description: 'shabjdeed_golden_era_desc',
        prerequisiteId: 'shabjdeed_foundation',
        requirements: {
            cardCount: 7,
            exactRarityCount: { gold: 7 },
        },
        reward: { type: 'card', cardId: 'fbc_shabjdeed_1' }
    }
];

export const evoData: Evolution[] = [
    {
        id: 'light_up_the_beginning',
        title: 'Light up the Beginning',
        description: 'Elevate Abo El Anwar by making moves in the market and opening packs.',
        eligibility: {
            cardName: 'Abo El Anwar',
            rarity: 'gold',
        },
        tasks: [
            { id: 'open_special_packs', description: 'Open 2 Special Packs', target: 2 },
            { id: 'list_cards_market', description: 'List 2 cards on the market', target: 2 },
            { id: 'quicksell_gold_card', description: 'Quick sell a Gold card', target: 1 }
        ],
        resultCardId: 'evo_abo_1'
    },
    {
        id: 'tommy_gun_upgrade',
        title: 'Lock and Load',
        description: "Improve Tommy Gun's performance by making him a key part of a high-rated squad.",
        eligibility: {
            cardName: 'Tommy Gun',
            rarity: 'gold',
        },
        tasks: [
            { id: 'tommy_gun_in_formation', description: 'Add Tommy Gun to your starting formation', target: 1 },
            { id: 'formation_rating_82', description: 'Achieve a squad rating of 82+ with Tommy Gun in the formation', target: 1 }
        ],
        resultCardId: 'evo_tommy_gun_1'
    }
];

export const objectivesData: Objective[] = [
    // Daily
    { id: 'd1', type: 'daily', titleKey: 'obj_open_free_pack_title', tasks: [{ id: 'open_free_packs', descriptionKey: 'obj_open_free_pack_task', target: 1 }], reward: { type: 'coins', amount: 250 } },
    { id: 'd2', type: 'daily', titleKey: 'obj_list_card_title', tasks: [{ id: 'list_market_cards', descriptionKey: 'obj_list_card_task', target: 1 }], reward: { type: 'coins', amount: 500 } },
    // Weekly
    { id: 'w1', type: 'weekly', titleKey: 'obj_open_builder_packs_title', tasks: [{ id: 'open_builder_packs', descriptionKey: 'obj_open_builder_packs_task', target: 5 }], reward: { type: 'pack', packType: 'builder' } },
    { id: 'w2', type: 'weekly', titleKey: 'obj_complete_fbc_title', tasks: [{ id: 'complete_fbcs', descriptionKey: 'obj_complete_fbc_task', target: 1 }], reward: { type: 'coins', amount: 2000 } },
    // Milestone
    {
        id: 'milestone_a_step_ahead',
        type: 'milestone',
        titleKey: 'obj_a_step_ahead_title',
        tasks: [
            { id: 'complete_evos', descriptionKey: 'obj_task_complete_evo', target: 1 },
            { id: 'complete_fbcs', descriptionKey: 'obj_task_complete_fbc', target: 1 },
            { id: 'formation_11_gold', descriptionKey: 'obj_task_formation_11_gold', target: 1 }
        ],
        reward: { type: 'card', cardId: 'obj_ra3_1' }
    }
];

export const playerPickConfigs: Record<string, PlayerPickConfig> = {
    '1of2': { id: '1of2', nameKey: 'pp_1of2', pickCount: 1, totalOptions: 2, minOvr: 70 },
    '1of3_75': { id: '1of3_75', nameKey: 'pp_1of3_75', pickCount: 1, totalOptions: 3, minOvr: 75 },
    '1of3_78': { id: '1of3_78', nameKey: 'pp_1of3_78', pickCount: 1, totalOptions: 3, minOvr: 78 },
    '1of5': { id: '1of5', nameKey: 'pp_1of5', pickCount: 1, totalOptions: 5, minOvr: 80 },
    '1of4_80': { id: '1of4_80', nameKey: 'pp_1of4_80', pickCount: 1, totalOptions: 4, minOvr: 80 },
    '2of5_82': { id: '2of5_82', nameKey: 'pp_2of5_82', pickCount: 2, totalOptions: 5, minOvr: 82 },
    '2of10': { id: '2of10', nameKey: 'pp_2of10', pickCount: 2, totalOptions: 10, minOvr: 85 },
    '2of10_85': { id: '2of10_85', nameKey: 'pp_2of10_85', pickCount: 2, totalOptions: 10, minOvr: 85 },
    '1of2_icon': { id: '1of2_icon', nameKey: 'pp_1of2_icon', pickCount: 1, totalOptions: 2, minOvr: 88, rarityGuarantee: 'icon' },
    '1of2_rotm': { id: '1of2_rotm', nameKey: 'pp_1of2_rotm', pickCount: 1, totalOptions: 2, minOvr: 88, rarityGuarantee: 'rotm' },
};

interface Position {
  id: string;
  label: string;
}

interface FormationStructure {
  name: string;
  positions: {
    attackers: Position[];
    midfielders: Position[];
    defenders: Position[];
    goalkeeper: Position[];
  };
  allPositions: string[];
}

export const formationLayouts: Record<FormationLayoutId, FormationStructure> = {
  '4-4-2': {
    name: '4-4-2',
    positions: {
      attackers: [{ id: 'st1', label: 'ST' }, { id: 'st2', label: 'ST' }],
      midfielders: [{ id: 'lm', label: 'LM' }, { id: 'cm1', label: 'CM' }, { id: 'cm2', label: 'CM' }, { id: 'rm', label: 'RM' }],
      defenders: [{ id: 'lb', label: 'LB' }, { id: 'cb1', label: 'CB' }, { id: 'cb2', label: 'CB' }, { id: 'rb', label: 'RB' }],
      goalkeeper: [{ id: 'gk', label: 'GK' }],
    },
    allPositions: ['st1', 'st2', 'lm', 'cm1', 'cm2', 'rm', 'lb', 'cb1', 'cb2', 'rb', 'gk'],
  },
  '4-3-3': {
    name: '4-3-3',
    positions: {
      attackers: [{ id: 'lw', label: 'LW' }, { id: 'st', label: 'ST' }, { id: 'rw', label: 'RW' }],
      midfielders: [{ id: 'cm1', label: 'CM' }, { id: 'cm2', label: 'CM' }, { id: 'cm3', label: 'CM' }],
      defenders: [{ id: 'lb', label: 'LB' }, { id: 'cb1', label: 'CB' }, { id: 'cb2', label: 'CB' }, { id: 'rb', label: 'RB' }],
      goalkeeper: [{ id: 'gk', label: 'GK' }],
    },
    allPositions: ['lw', 'st', 'rw', 'cm1', 'cm2', 'cm3', 'lb', 'cb1', 'cb2', 'rb', 'gk'],
  },
  '5-3-2': {
    name: '5-3-2',
    positions: {
        attackers: [{ id: 'st1', label: 'ST' }, { id: 'st2', label: 'ST' }],
        midfielders: [{ id: 'cm1', label: 'CM' }, { id: 'cm2', label: 'CM' }, { id: 'cm3', label: 'CM' }],
        defenders: [{ id: 'lwb', label: 'LWB' }, { id: 'cb1', label: 'CB' }, { id: 'cb2', label: 'CB' }, { id: 'cb3', label: 'CB' }, { id: 'rwb', label: 'RWB' }],
        goalkeeper: [{ id: 'gk', label: 'GK' }],
    },
    allPositions: ['st1', 'st2', 'cm1', 'cm2', 'cm3', 'lwb', 'cb1', 'cb2', 'cb3', 'rwb', 'gk'],
  },
  '3-4-3': {
      name: '3-4-3',
      positions: {
          attackers: [{ id: 'lw', label: 'LW' }, { id: 'st', label: 'ST' }, { id: 'rw', label: 'RW' }],
          midfielders: [{ id: 'lm', label: 'LM' }, { id: 'cm1', label: 'CM' }, { id: 'cm2', label: 'CM' }, { id: 'rm', label: 'RM' }],
          defenders: [{ id: 'cb1', label: 'CB' }, { id: 'cb2', label: 'CB' }, { id: 'cb3', 'label': 'CB' }],
          goalkeeper: [{ id: 'gk', label: 'GK' }],
      },
      allPositions: ['lw', 'st', 'rw', 'lm', 'cm1', 'cm2', 'rm', 'cb1', 'cb2', 'cb3', 'gk'],
  }
};

export const avatars: string[] = [
    'https://i.imghippo.com/files/TJIH8608wZk.png',
    'https://i.imghippo.com/files/XrUB6208Bo.png',
    'https://i.imghippo.com/files/xJZ6974gJo.png',
    'https://i.imghippo.com/files/KhA8194TQM.png',
    'https://i.imghippo.com/files/pri9634jY.png',
    'https://i.imghippo.com/files/MMSE8115wr.png',
    'https://i.imghippo.com/files/tvk2942qe.png',
    'https://i.imghippo.com/files/NY2664HFI.png',
    'https://i.imghippo.com/files/Xq2208pkM.png',
];
