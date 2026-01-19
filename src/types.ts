
// Fix: Define and export all shared types for the application.

export type Rarity = 'bronze' | 'silver' | 'gold' | 'icon' | 'rotm' | 'legend' | 'event';

export type GameView = 'store' | 'collection' | 'market' | 'battle' | 'fbc' | 'evo' | 'objectives';

export type PackType = 'free' | 'bronze' | 'builder' | 'special' | 'legendary';

export type FormationLayoutId = '4-4-2' | '4-3-3' | '5-3-2' | '3-4-3';

export type Rank = 'Bronze' | 'Silver' | 'Gold' | 'Legend';

export interface Stats {
    lyrc: number;
    flow: number;
    sing: number;
    live: number;
    diss: number;
    char: number;
}

export interface Card {
  id: string;
  name: string;
  ovr: number;
  rarity: Rarity;
  image: string;
  value: number;
  superpowers: string[];
  stats: Stats;
  isPackable?: boolean;
}

export interface MarketCard extends Card {
  price: number;
  sellerId: string;
  marketId?: string; // Firestore Document ID
  createdAt?: number; // Timestamp for sorting
}

export interface PackData {
  cost: number;
  bpCost: number; // Cost in Battle Points
  rarityChances: {
    [key in Rarity]?: number;
  };
}

export interface FBCChallenge {
    id: string;
    title: string;
    description: string;
    prerequisiteId?: string;
    groupId?: string;
    groupFinalRewardCardId?: string;
    repeatable?: 'daily'; // New property for daily resets
    requirements: {
        cardCount: number;
        exactRarityCount?: { [key in Rarity]?: number };
        minAvgOvr?: number;
        minTotalValue?: number;
        minRarityCount?: { [key in Rarity]?: number };
    };
    reward: {
        type: 'coins' | 'pack' | 'card';
        amount?: number;
        details?: PackType;
        cardId?: string;
        bypassLimit?: boolean;
    };
}

export interface Evolution {
    id: string;
    title: string;
    description: string;
    eligibility: {
        cardName: string;
        rarity: Rarity;
        maxOvr?: number;
    };
    tasks: {
        id: string;
        description: string;
        target: number;
    }[];
    resultCardId: string;
}

export interface ObjectiveTask {
    id: string;
    descriptionKey: string;
    target: number;
}

export interface PlayerPickConfig {
    id: string;
    nameKey: string; // Translation key
    pickCount: number; // How many cards the user keeps (e.g., 1)
    totalOptions: number; // How many options are shown (e.g., 3)
    minOvr: number; // Minimum OVR for generated cards
    rarityGuarantee?: Rarity; // Optional rarity filter
}

export interface Objective {
  id: string;
  type: 'daily' | 'weekly' | 'milestone';
  titleKey: string;
  tasks: ObjectiveTask[];
  reward: {
    type: 'coins' | 'pack' | 'card' | 'player_pick' | 'coins_and_pick';
    amount?: number;
    packType?: PackType;
    cardId?: string;
    playerPickId?: string;
  };
}


export interface ObjectiveProgress {
    tasks: Record<string, number>; // Track progress for each task by its ID
    claimed: boolean;
}


export interface Settings {
  musicOn: boolean;
  musicVolume: number;
  sfxOn: boolean;
  sfxVolume: number;
  animationsOn: boolean;
}

export interface GameState {
  version?: number;
  userId: string;
  coins: number;
  battlePoints: number; // New currency
  xp: number;
  rank: Rank;
  rankWins: number; // Wins towards next rank
  pendingEarnings: number; // For offline market sales
  formation: Record<string, Card | null>;
  formationLayout: FormationLayoutId;
  storage: Card[];
  market: MarketCard[]; // Local view of market
  completedFbcIds: string[];
  completedEvoIds: string[];
  activeEvolution: {
    evoId: string;
    cardId: string;
    tasks: Record<string, number>;
  } | null;
  lastRewardClaimTime: number | null;
  freePacksOpenedToday: number;
  lastFreePackResetTime: number | null;
  objectiveProgress: Record<string, ObjectiveProgress>;
  lastDailyReset: number | null;
  lastWeeklyReset: number | null;
  ownedPacks: PackType[];
  ownedPlayerPicks: PlayerPickConfig[];
  activePlayerPick: PlayerPickConfig | null;
}

export interface Deal {
    offeredCard: Card;
    message: string;
}

export interface User {
    username: string;
    email?: string;
    password?: string;
    avatar?: string;
}

export type CurrentUser = User | null;
