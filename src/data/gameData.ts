import { Card, PackType, PackData, FBCChallenge, Evolution, FormationLayoutId, Stats, Objective } from '../types';

// --- GITHUB ASSET CONFIGURATION ---
// Ensures we pull directly from the main branch of your repo
const GITHUB_BASE = "https://raw.githubusercontent.com/RCB-EG/Rappers-Cards-Battle/main";

// Helper to format rarity for folder/filenames based on your repo structure
// Structure: Bronze, Silver, Gold, ROTM, Icon, Evo
const getRepoRarityString = (rarity: string) => {
    if (rarity === 'rotm') return 'ROTM';
    if (rarity === 'event') return 'Evo'; // Maps internal 'event' type to your 'Evo' folder
    return rarity.charAt(0).toUpperCase() + rarity.slice(1);
};

// Generates the specific URL for a card
// Target format: .../Gold/Abo El Anwar Gold (86).png
const getCardImage = (name: string, rarity: string, ovr: number) => {
    const rarityLabel = getRepoRarityString(rarity);
    const folder = rarityLabel; 
    const filename = `${name} ${rarityLabel} (${ovr}).png`;
    
    // We use encodeURIComponent to ensure spaces in names (e.g., "Abo El Anwar") don't break the URL
    return `${GITHUB_BASE}/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
};

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
  { id: 'b1', name: 'Bebo', ovr: 62, rarity: 'bronze', image: getCardImage('Bebo', 'bronze', 62), value: 200, superpowers: [], stats: generateStats(62) },
  { id: 'b2', name: 'Casper', ovr: 60, rarity: 'bronze', image: getCardImage('Casper', 'bronze', 60), value: 200, superpowers: [], stats: generateStats(60) },
  { id: 'b3', name: 'Dena Phantom', ovr: 69, rarity: 'bronze', image: getCardImage('Dena Phantom', 'bronze', 69), value: 200, superpowers: [], stats: generateStats(69) },
  { id: 'b4', name: 'Sagy', ovr: 66, rarity: 'bronze', image: getCardImage('Sagy', 'bronze', 66), value: 450, superpowers: [], stats: generateStats(66) },
  { id: 'b5', name: 'Xander Ghost', ovr: 69, rarity: 'bronze', image: getCardImage('Xander Ghost', 'bronze', 69), value: 600, superpowers: [], stats: generateStats(69) },
  { id: 'b6', name: 'Xena', ovr: 68, rarity: 'bronze', image: getCardImage('Xena', 'bronze', 68), value: 400, superpowers: [], stats: generateStats(68) },
  
  // Silver
  { id: 's1', name: 'Flex', ovr: 78, rarity: 'silver', image: getCardImage('Flex', 'silver', 78), value: 900, superpowers: [], stats: generateStats(78) },
  { id: 's2', name: 'Lella Fadda', ovr: 79, rarity: 'silver', image: getCardImage('Lella Fadda', 'silver', 79), value: 900, superpowers: [], stats: generateStats(79) },
  { id: 's3', name: 'Lil Baba', ovr: 77, rarity: 'silver', image: getCardImage('Lil Baba', 'silver', 77), value: 750, superpowers: [], stats: generateStats(77) },
  { id: 's4', name: 'Perrie', ovr: 79, rarity: 'silver', image: getCardImage('Perrie', 'silver', 79), value: 650, superpowers: [], stats: generateStats(79) },

  // Gold
  { id: 'g1', name: 'Abo El Anwar', ovr: 86, rarity: 'gold', image: getCardImage('Abo El Anwar', 'gold', 86), value: 20000, superpowers: [], stats: generateStats(86) },
  { id: 'g2', name: 'Abyusif', ovr: 91, rarity: 'gold', image: getCardImage('Abyusif', 'gold', 91), value: 200000, superpowers: ['Rhymes Crafter'], stats: generateStats(91) },
  { id: 'g3', name: 'Afroto', ovr: 89, rarity: 'gold', image: getCardImage('Afroto', 'gold', 89), value: 92000, superpowers: ['Notes Master'], stats: generateStats(89) },
  { id: 'g4', name: 'Arsenik', ovr: 88, rarity: 'gold', image: getCardImage('Arsenik', 'gold', 88), value: 57000, superpowers: ['Flow Switcher'], stats: generateStats(88) },
  { id: 'g5', name: 'Batistuta', ovr: 86, rarity: 'gold', image: getCardImage('Batistuta', 'gold', 86), value: 14000, superpowers: ['Notes Master'], stats: generateStats(86) },
  { id: 'g6', name: 'DizzyTooSkinny', ovr: 86, rarity: 'gold', image: getCardImage('DizzyTooSkinny', 'gold', 86), value: 25000, superpowers: ['Notes Master'], stats: generateStats(86) },
  { id: 'g7', name: 'El Joker', ovr: 89, rarity: 'gold', image: getCardImage('El Joker', 'gold', 89), value: 97000, superpowers: ['Storyteller'], stats: generateStats(89) },
  { id: 'g8', name: 'Hala', ovr: 84, rarity: 'gold', image: getCardImage('Hala', 'gold', 84), value: 3000, superpowers: ['Notes Master'], stats: generateStats(84) },
  { id: 'g9', name: 'Hussein', ovr: 84, rarity: 'gold', image: getCardImage('Hussein', 'gold', 84), value: 4500, superpowers: [], stats: generateStats(84) },
  { id: 'g10', name: 'Kareem Ossama', ovr: 84, rarity: 'gold', image: getCardImage('Kareem Ossama', 'gold', 84), value: 4800, superpowers: [], stats: generateStats(84) },
  { id: 'g11', name: 'Lege-Cy', ovr: 89, rarity: 'gold', image: getCardImage('Lege-Cy', 'gold', 89), value: 85000, superpowers: ['Notes Master'], stats: generateStats(89) },
  { id: 'g12', name: 'Mared Gold', ovr: 82, rarity: 'gold', image: getCardImage('Mared Gold', 'gold', 82), value: 1000, superpowers: [], stats: generateStats(82) },
  { id: 'g13', name: 'Marwan Moussa', ovr: 90, rarity: 'gold', image: getCardImage('Marwan Moussa', 'gold', 90), value: 120000, superpowers: ['Storyteller'], stats: generateStats(90) },
  { id: 'g14', name: 'Marwan Pablo', ovr: 89, rarity: 'gold', image: getCardImage('Marwan Pablo', 'gold', 89), value: 100000, superpowers: ['Show Maker'], stats: generateStats(89) },
  { id: 'g15', name: 'Moscow', ovr: 85, rarity: 'gold', image: getCardImage('Moscow', 'gold', 85), value: 6000, superpowers: [], stats: generateStats(85) },
  { id: 'g16', name: 'Mousv', ovr: 85, rarity: 'gold', image: getCardImage('Mousv', 'gold', 85), value: 9000, superpowers: [], stats: generateStats(85) },
  { id: 'g17', name: 'Muhab', ovr: 84, rarity: 'gold', image: getCardImage('Muhab', 'gold', 84), value: 5100, superpowers: [], stats: generateStats(84) },
  { id: 'g18', name: 'Nobi', ovr: 83, rarity: 'gold', image: getCardImage('Nobi', 'gold', 83), value: 1900, superpowers: [], stats: generateStats(83) },
  { id: 'g19', name: 'Santa', ovr: 88, rarity: 'gold', image: getCardImage('Santa', 'gold', 88), value: 55000, superpowers: ['Word Bender'], stats: generateStats(88) },
  { id: 'g20', name: 'Shahyn', ovr: 88, rarity: 'gold', image: getCardImage('Shahyn', 'gold', 88), value: 70000, superpowers: ['Show Maker'], stats: generateStats(88) },
  { id: 'g21', name: 'Wegz', ovr: 90, rarity: 'gold', image: getCardImage('Wegz', 'gold', 90), value: 140000, superpowers: ['The Artist'], stats: generateStats(90) },
  { id: 'g22', name: 'Young T', ovr: 83, rarity: 'gold', image: getCardImage('Young T', 'gold', 83), value: 2200, superpowers: ['Flow Switcher'], stats: generateStats(83) },
  { id: 'g23', name: 'Zap', ovr: 80, rarity: 'gold', image: getCardImage('Zap', 'gold', 80), value: 1200, superpowers: ['StoryTeller'], stats: generateStats(80) },

  // Icon
  { id: 'i1', name: 'Adham', ovr: 93, rarity: 'icon', image: getCardImage('Adham', 'icon', 93), value: 218000, superpowers: ['Rhymes Crafter', 'Punchline Machine'], stats: generateStats(93) },
  { id: 'i2', name: 'E-money', ovr: 92, rarity: 'icon', image: getCardImage('E-money', 'icon', 92), value: 133000, superpowers: ['Chopper', 'Flow Switcher'], stats: generateStats(92) },
  { id: 'i3', name: 'Kordy', ovr: 92, rarity: 'icon', image: getCardImage('Kordy', 'icon', 92), value: 146000, superpowers: ['Show Maker'], stats: generateStats(92) },
  { id: 'i4', name: 'Maleka', ovr: 91, rarity: 'icon', image: getCardImage('Maleka', 'icon', 91), value: 112000, superpowers: ['The Artist'], stats: generateStats(91) },
  { id: 'i5', name: 'Mc Amin', ovr: 94, rarity: 'icon', image: getCardImage('Mc Amin', 'icon', 94), value: 240000, superpowers: ['Show Maker', 'Flow Switcher'], stats: generateStats(94) },
  { id: 'i6', name: 'Mody Rap', ovr: 91, rarity: 'icon', image: getCardImage('Mody Rap', 'icon', 91), value: 89000, superpowers: ['StoryTeller'], stats: generateStats(91) },
  { id: 'i7', name: 'Romel B', ovr: 90, rarity: 'icon', image: getCardImage('Romel B', 'icon', 90), value: 91000, superpowers: ['Chopper'], stats: generateStats(90) },

  // ROTM
  { id: 'r1', name: 'Abyusif', ovr: 92, rarity: 'rotm', image: getCardImage('Abyusif', 'rotm', 92), value: 300000, superpowers: ['Rhyme Crafter', 'Word Bender'], stats: generateStats(92) },
  { id: 'r2', name: 'Afroto', ovr: 90, rarity: 'rotm', image: getCardImage('Afroto', 'rotm', 90), value: 210000, superpowers: ['StoryTeller'], stats: generateStats(90) },
  { id: 'r3', name: 'Arsenik', ovr: 89, rarity: 'rotm', image: getCardImage('Arsenik', 'rotm', 89), value: 160000, superpowers: ['Words Bender'], stats: generateStats(89) },
  { id: 'r4', name: 'Lege-Cy', ovr: 90, rarity: 'rotm', image: getCardImage('Lege-Cy', 'rotm', 90), value: 180000, superpowers: ['StoryTeller'], stats: generateStats(90) },
  { id: 'r5', name: 'Marwan Mousa', ovr: 91, rarity: 'rotm', image: getCardImage('Marwan Mousa', 'rotm', 91), value: 234000, superpowers: ['StoryTeller', 'Word Bender'], stats: generateStats(91) },
  { id: 'r6', name: 'Wegz', ovr: 91, rarity: 'rotm', image: getCardImage('Wegz', 'rotm', 91), value: 250000, superpowers: ['The Artist', 'Notes Master'], stats: generateStats(91) },
  
  // Legend
  {
    id: 'l1', name: 'The GOAT', ovr: 98, rarity: 'legend', image: getCardImage('The GOAT', 'legend', 98),
    stats: { lyrc: 99, flow: 99, sing: 98, live: 98, diss: 98, char: 99 },
    superpowers: ['Career Killer', 'The Artist', 'Words Bender', 'Flow Switcher'], value: 800000
  },
  
  // Evo Cards
  { 
    id: 'evo_abo_1', 
    name: 'Abo El Anwar', 
    ovr: 87, 
    rarity: 'event',
    image: getCardImage('Abo El Anwar', 'event', 87), 
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
    image: getCardImage('Tommy Gun', 'event', 84), 
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
    image: getCardImage('Shehab', 'gold', 87),
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
    image: getCardImage('Tommy Gun', 'gold', 83),
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
    image: getCardImage('Shabjdeed', 'gold', 85),
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
    image: getCardImage('Ra3', 'gold', 85),
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
    rarityChances: {
      bronze: 65,
      silver: 25,
      gold: 10,
    },
  },
  builder: {
    cost: 1200,
    rarityChances: {
      bronze: 45,
      silver: 35,
      gold: 20,
    },
  },
  special: {
    cost: 4000,
    rarityChances: {
      silver: 10,
      gold: 83,
      rotm: 4,
      icon: 3,
    },
  },
  legendary: {
    cost: 40000,
    rarityChances: {
      gold: 70,
      rotm: 15,
      icon: 14,
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
    'https://api.dicebear.com/9.x/bottts/svg?seed=avatar1',
    'https://api.dicebear.com/9.x/bottts/svg?seed=avatar2',
    'https://api.dicebear.com/9.x/bottts/svg?seed=avatar3',
    'https://api.dicebear.com/9.x/bottts/svg?seed=avatar4',
    'https://api.dicebear.com/9.x/bottts/svg?seed=avatar5',
    'https://api.dicebear.com/9.x/bottts/svg?seed=avatar6',
    'https://api.dicebear.com/9.x/bottts/svg?seed=avatar7',
    'https://api.dicebear.com/9.x/bottts/svg?seed=avatar8',
    'https://api.dicebear.com/9.x/bottts/svg?seed=avatar9',
];