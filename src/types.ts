// Fix: Define and export all shared types for the application.

export type Rarity = 'bronze' | 'silver' | 'gold' | 'icon' | 'rotm' | 'legend' | 'event';

export type GameView = 'store' | 'collection' | 'market' | 'battle' | 'fbc' | 'evo' | 'objectives';

export type PackType = 'free' | 'builder' | 'special' | 'legendary';

export type FormationLayoutId = '4-4-2' | '4-3-3' | '5-3-2' | '3-4-3';

export interface Stats {
    lyrc: number;
    flow: number;
    sing: number;
    live: number;
    diss: number;
    char: number;
}

export interface Card {
  id: string; // This is the template ID from allCards
  uid?: string; // This is the unique Firestore document ID for a card instance in storage
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
  listingId: string;
  price: number;
  sellerUid: string;
  sellerUsername: string;
}

export interface PackData {
  cost: number;
  rarityChances: {
    [key in Rarity]?: number;
  };
  packableRarities: Rarity[];
  ovrWeightingFactor: number;
  valueWeightingFactor: number;
  minOvr?: number;
  maxOvr?: number;
}

export interface FBCChallenge {
    id: string;
    title: string;
    description: string;
    prerequisiteId?: string;
    groupId?: string;
    groupFinalRewardCardId?: string;
    requirements: {
        cardCount: number;
        exactRarityCount?: { [key in Rarity]?: number };
        minAvgOvr?: number;
        minTotalValue?: number;
        minRarityCount?: { [key in Rarity]?: number };
    };
    reward: {
        type: 'pack' | 'card';
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

export interface Objective {
  id: string;
  type: 'daily' | 'weekly' | 'milestone';
  titleKey: string;
  tasks: ObjectiveTask[];
  reward: {
    type: 'coins' | 'pack' | 'card';
    amount?: number;
    packType?: PackType;
    cardId?: string;
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
  uid: string | null;
  coins: number;
  formation: Record<string, Card | null>;
  formationLayout: FormationLayoutId;
  storage: Card[];
  market: MarketCard[];
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
}

export interface Deal {
    offeredCard: Card;
    message: string;
}

export interface User {
    uid: string;
    username: string;
    email: string;
    password?: string; // Only used for sign-up/login forms, not stored
    avatar?: string;
}

export type CurrentUser = User | null;
