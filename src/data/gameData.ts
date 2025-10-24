import { Card, PackType, PackData, FBCChallenge, Evolution, FormationLayoutId, Stats, Objective, Rarity } from '../types';

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

// A collection of all possible cards in the game.
export const allCards: Card[] = [
  // Bronze
  { id: 'b1', name: 'Bebo', ovr: 62, rarity: 'bronze', image: 'https://i.imghippo.com/files/GJZ1767yhY.png', value: 200, superpowers: [], stats: generateStats(62) },
  { id: 'b2', name: 'Casper', ovr: 60, rarity: 'bronze', image: 'https://i.imghippo.com/files/mVch9821OnQ.png', value: 200, superpowers: [], stats: generateStats(60) },
  { id: 'b3', name: 'Dena Phantom', ovr: 69, rarity: 'bronze', image: 'https://i.imghippo.com/files/LEY2430zeo.png', value: 200, superpowers: [], stats: generateStats(69) },
  { id: 'b4', name: 'Sagy', ovr: 66, rarity: 'bronze', image: 'https://i.imghippo.com/files/zuiU4805CSk.png', value: 450, superpowers: [], stats: generateStats(66) },
  { id: 'b5', name: 'Xander Ghost', ovr: 69, rarity: 'bronze', image: 'https://i.imghippo.com/files/Shjt4610vb.png', value: 600, superpowers: [], stats: generateStats(69) },
  { id: 'b6', name: 'Xena', ovr: 68, rarity: 'bronze', image: 'https://i.imghippo.com/files/Hyu6300uKc.png', value: 400, superpowers: [], stats: generateStats(68) },
  
  // Silver
  { id: 's1', name: 'Flex', ovr: 78, rarity: 'silver', image: 'https://i.imghippo.com/files/pSrm7343Sg.png', value: 900, superpowers: [], stats: generateStats(78) },
  { id: 's2', name: 'Lella Fadda', ovr: 79, rarity: 'silver', image: 'https://i.imghippo.com/files/cEG8980udU.png', value: 900, superpowers: [], stats: generateStats(79) },
  { id: 's3', name: 'Lil Baba', ovr: 77, rarity: 'silver', image: 'https://i.imghippo.com/files/WpD5955mtw.png', value: 750, superpowers: [], stats: generateStats(77) },
  { id: 's4', name: 'Perrie', ovr: 79, rarity: 'silver', image: 'https://i.imghippo.com/files/wzuu2721XxY.png', value: 650, superpowers: [], stats: generateStats(79) },

  // Gold
  { id: 'g1', name: 'Abo El Anwar', ovr: 86, rarity: 'gold', image: 'https://i.imghippo.com/files/Ebuy1908kOY.png', value: 20000, superpowers: [], stats: generateStats(86) },
  { id: 'g2', name: 'Abyusif', ovr: 91, rarity: 'gold', image: 'https://i.imghippo.com/files/DBHf2066EU.png', value: 200000, superpowers: ['Rhymes Crafter'], stats: generateStats(91) },
  { id: 'g3', name: 'Afroto', ovr: 89, rarity: 'gold', image: 'https://i.imghippo.com/files/BbyR9672rvM.png', value: 92000, superpowers: ['Notes Master'], stats: generateStats(89) },
  { id: 'g4', name: 'Arsenik', ovr: 88, rarity: 'gold', image: 'https://i.imghippo.com/files/JXcN7953hc.png', value: 57000, superpowers: ['Flow Switcher'], stats: generateStats(88) },
  { id: 'g5', name: 'Batistuta', ovr: 86, rarity: 'gold', image: 'https://i.imghippo.com/files/uhl8456ss.png', value: 14000, superpowers: ['Notes Master'], stats: generateStats(86) },
  { id: 'g6', name: 'DizzyTooSkinny', ovr: 86, rarity: 'gold', image: 'https://i.imghippo.com/files/Lwv1112TBA.png', value: 25000, superpowers: ['Notes Master'], stats: generateStats(86) },
  { id: 'g7', name: 'El Joker', ovr: 89, rarity: 'gold', image: 'https://i.imghippo.com/files/WGr4155.png', value: 97000, superpowers: ['Storyteller'], stats: generateStats(89) },
  { id: 'g8', name: 'Hala', ovr: 84, rarity: 'gold', image: 'https://i.imghippo.com/files/sd7940oMA.png', value: 3000, superpowers: ['Notes Master'], stats: generateStats(84) },
  { id: 'g9', name: 'Hussein', ovr: 84, rarity: 'gold', image: 'https://i.imghippo.com/files/MGDy7972SbY.png', value: 4500, superpowers: [], stats: generateStats(84) },
  { id: 'g10', name: 'Kareem Ossama', ovr: 84, rarity: 'gold', image: 'https://i.imghippo.com/files/Zl7716gyY.png', value: 4800, superpowers: [], stats: generateStats(84) },
  { id: 'g11', name: 'Lege-Cy', ovr: 89, rarity: 'gold', image: 'https://i.imghippo.com/files/xNxa5803tzo.png', value: 85000, superpowers: ['Notes Master'], stats: generateStats(89) },
  { id: 'g12', name: 'Mared Gold', ovr: 82, rarity: 'gold', image: 'https://i.imghippo.com/files/DBv4039AFE.png', value: 1000, superpowers: [], stats: generateStats(82) },
  { id: 'g13', name: 'Marwan Moussa', ovr: 90, rarity: 'gold', image: 'https://i.imghippo.com/files/mGv9345dBc.png', value: 120000, superpowers: ['Storyteller'], stats: generateStats(90) },
  { id: 'g14', name: 'Marwan Pablo', ovr: 89, rarity: 'gold', image: 'https://i.imghippo.com/files/HQJ1882co.png', value: 100000, superpowers: ['Show Maker'], stats: generateStats(89) },
  { id: 'g15', name: 'Moscow', ovr: 85, rarity: 'gold', image: 'https://i.imghippo.com/files/VWNi6414Wc.png', value: 6000, superpowers: [], stats: generateStats(85) },
  { id: 'g16', name: 'Mousv', ovr: 85, rarity: 'gold', image: 'https://i.imghippo.com/files/dRwv2557nXs.png', value: 9000, superpowers: [], stats: generateStats(85) },
  { id: 'g17', name: 'Muhab', ovr: 84, rarity: 'gold', image: 'https://i.imghippo.com/files/pyk3945pSw.png', value: 5100, superpowers: [], stats: generateStats(84) },
  { id: 'g18', name: 'Nobi', ovr: 83, rarity: 'gold', image: 'https://i.imghippo.com/files/fqV2283.png', value: 1900, superpowers: [], stats: generateStats(83) },
  { id: 'g19', name: 'Santa', ovr: 88, rarity: 'gold', image: 'https://i.imghippo.com/files/ipek4854nD.png', value: 55000, superpowers: ['Word Bender'], stats: generateStats(88) },
  { id: 'g20', name: 'Shahyn', ovr: 88, rarity: 'gold', image: 'https://i.imghippo.com/files/zyTP1331Cyk.png', value: 70000, superpowers: ['Show Maker'], stats: generateStats(88) },
  { id: 'g21', name: 'Wegz', ovr: 90, rarity: 'gold', image: 'https://i.imghippo.com/files/dQzf1916msk.png', value: 140000, superpowers: ['The Artist'], stats: generateStats(90) },
  { id: 'g22', name: 'Young T', ovr: 83, rarity: 'gold', image: 'https://i.imghippo.com/files/to1403qd.png', value: 2200, superpowers: ['Flow Switcher'], stats: generateStats(83) },
  { id: 'g23', name: 'Zap', ovr: 80, rarity: 'gold', image: 'https://i.imghippo.com/files/vn2931jPA.png', value: 1200, superpowers: ['StoryTeller'], stats: generateStats(80) },

  // Icon
  { id: 'i1', name: 'Adham', ovr: 93, rarity: 'icon', image: 'https://i.imghippo.com/files/LiUR1258JAY.png', value: 218000, superpowers: ['Rhymes Crafter', 'Punchline Machine'], stats: generateStats(93) },
  { id: 'i2', name: 'E-money', ovr: 92, rarity: 'icon', image: 'https://i.imghippo.com/files/IUf5095X.png', value: 133000, superpowers: ['Chopper', 'Flow Switcher'], stats: generateStats(92) },
  { id: 'i3', name: 'Kordy', ovr: 92, rarity: 'icon', image: 'https://i.imghippo.com/files/pbj5403oWU.png', value: 146000, superpowers: ['Show Maker'], stats: generateStats(92) },
  { id: 'i4', name: 'Maleka', ovr: 91, rarity: 'icon', image: 'https://i.imghippo.com/files/tBh7317eHw.png', value: 112000, superpowers: ['The Artist'], stats: generateStats(91) },
  { id: 'i5', name: 'Mc Amin', ovr: 94, rarity: 'icon', image: 'https://i.imghippo.com/files/CX3763rMw.png', value: 240000, superpowers: ['Show Maker', 'Flow Switcher'], stats: generateStats(94) },
  { id: 'i6', name: 'Mody Rap', ovr: 91, rarity: 'icon', image: 'https://i.imghippo.com/files/XZgc4559n.png', value: 89000, superpowers: ['StoryTeller'], stats: generateStats(91) },
  { id: 'i7', name: 'Romel B', ovr: 90, rarity: 'icon', image: 'https://i.imghippo.com/files/G4728haA.png', value: 91000, superpowers: ['Chopper'], stats: generateStats(90) },

  // ROTM
  { id: 'r1', name: 'Abyusif', ovr: 92, rarity: 'rotm', image: 'https://i.imghippo.com/files/QGO2832Hw.png', value: 300000, superpowers: ['Rhyme Crafter', 'Word Bender'], stats: generateStats(92) },
  { id: 'r2', name: 'Afroto', ovr: 90, rarity: 'rotm', image: 'https://i.imghippo.com/files/wyyJ2171NvE.png', value: 210000, superpowers: ['StoryTeller'], stats: generateStats(90) },
  { id: 'r3', name: 'Arsenik', ovr: 89, rarity: 'rotm', image: 'https://i.imghippo.com/files/NNlV2642JHg.png', value: 160000, superpowers: ['Words Bender'], stats: generateStats(89) },
  { id: 'r4', name: 'Lege-Cy', ovr: 90, rarity: 'rotm', image: 'https://i.imghippo.com/files/MnRi3278M.png', value: 180000, superpowers: ['StoryTeller'], stats: generateStats(90) },
  { id: 'r5', name: 'Marwan Mousa', ovr: 91, rarity: 'rotm', image: 'https://i.imghippo.com/files/QFb6085DI.png', value: 234000, superpowers: ['StoryTeller', 'Word Bender'], stats: generateStats(91) },
  { id: 'r6', name: 'Wegz', ovr: 91, rarity: 'rotm', image: 'https://i.imghippo.com/files/cci2034ZR.png', value: 250000, superpowers: ['The Artist', 'Notes Master'], stats: generateStats(91) },
  
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
    image: 'https://i.imghippo.com/files/fZo8874.png', 
    value: 32000, 
    isPackable: false,
    superpowers: ['Rhyme Crafter'], 
    stats: { lyrc: 88, flow: 86, sing: 85, live: 90, diss: 84, char: 89 }
  },
   { 
    id: 'evo_tommy_gun_1', 
    name: 'Tommy Gun', 
    ovr: 84, 
    rarity: 'event',
    image: 'https://i.imghippo.com/files/ohZa7371j.png', 
    value: 7800, 
    isPackable: false,
    superpowers: ['Flow Switcher'], 
    stats: { lyrc: 85, flow: 88, sing: 82, live: 86, diss: 83, char: 85 }
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
    stats: generateStats(87)
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
    stats: generateStats(83)
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
    stats: generateStats(85)
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
    stats: generateStats(85)
  },
];


// Defines the properties of each pack type.
export const packs: Record<PackType, PackData> = {
  free: {
    cost: 0,
    packableRarities: ['bronze', 'silver', 'gold'],
    rarityChances: { bronze: 65, silver: 25, gold: 10 },
    ovrWeightingFactor: 0.7, // Heavy penalty for high OVR
    valueWeightingFactor: 0.8, // Heavy penalty for high value
    maxOvr: 80,
  },
  builder: {
    cost: 1200,
    packableRarities: ['bronze', 'silver', 'gold'],
    rarityChances: { bronze: 45, silver: 35, gold: 20 },
    ovrWeightingFactor: 0.75,
    valueWeightingFactor: 0.85,
    maxOvr: 84,
  },
  special: {
    cost: 4000,
    packableRarities: ['silver', 'gold', 'rotm', 'icon'],
    rarityChances: { silver: 10, gold: 83, rotm: 4, icon: 3 },
    ovrWeightingFactor: 0.85,
    valueWeightingFactor: 0.9,
    minOvr: 79,
    maxOvr: 89,
  },
  legendary: {
    cost: 40000,
    packableRarities: ['gold', 'rotm', 'icon', 'legend'],
    rarityChances: { gold: 70, rotm: 15, icon: 14, legend: 1 },
    ovrWeightingFactor: 0.92, // Lower penalty, easier to get high OVR
    valueWeightingFactor: 0.95, // Lower penalty, easier to get high value
    minOvr: 86,
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
