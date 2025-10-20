
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
  id: string;
  name: string;
  ovr: number;
  rarity: Rarity;
  image: string;
  value: number;
  superpowers: string[];
  stats: Stats;
}

export interface MarketCard extends Card {
  price: number;
  sellerId: string;
}

export interface PackData {
  cost: number;
  rarityChances: {
    [key in Rarity]?: number;
  };
}

export interface FBCChallenge {
    id: string;
    title: string;
    description: string;
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

export interface ObjectiveReward {
    type: 'coins' | 'pack';
    amount?: number;
    packType?: PackType;
}

export interface Objective {
    id: string;
    description: string;
    target: number;
    reward: ObjectiveReward;
}

export interface ObjectiveData {
    daily: Objective[];
    weekly: Objective[];
}

export interface ObjectiveProgress {
    [objectiveId: string]: {
        progress: number;
        claimed: boolean;
    };
}

export interface Settings {
  musicOn: boolean;
  musicVolume: number;
  sfxOn: boolean;
  sfxVolume: number;
  animationsOn: boolean;
}

export interface GameState {
  userId: string;
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
  objectives: ObjectiveProgress;
  lastDailyObjectivesReset: number | null;
  lastWeeklyObjectivesReset: number | null;
}

export interface Deal {
    offeredCard: Card;
    message: string;
}
