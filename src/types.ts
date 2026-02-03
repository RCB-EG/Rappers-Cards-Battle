
export type Rarity = string;

// Dynamic Rarity Configuration
export interface RarityDefinition {
    id: string;
    name: string;
    rank: number; // For sorting
    color: string; // Hex code for glow/shadow
    baseImage: string; // URL for the card background
    animationTier: number; // 1: Basic, 2: Rare, 3: Epic, 4: Legendary, 5: Ultimate
}

export type GameView = 'store' | 'collection' | 'market' | 'battle' | 'fbc' | 'evo' | 'objectives' | 'social' | 'admin';

export type PackType = string;

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
  isPackable?: boolean;
  customScale?: number;
  customScaleX?: number;
  customScaleY?: number;
  legacy?: boolean;
}

export interface MarketCard extends Card {
  marketId?: string;
  price: number; // Legacy
  buyNowPrice?: number;
  startingPrice?: number;
  bidPrice: number;
  highestBidderId?: string | null;
  expiresAt?: number;
  durationHours?: number;
  sellerId: string;
  createdAt?: number;
  displayExpiresAt?: number;
}

export interface PackData {
  cost: number;
  bpCost: number;
  rarityChances: Record<string, number>;
  requiredPromos?: Rarity[];
  // Dynamic Pack Fields
  id?: string;
  name?: string;
  image?: string;
  description?: string;
  active?: boolean;
}

export interface FBCChallenge {
    id: string;
    title: string;
    description: string;
    prerequisiteId?: string;
    groupId?: string;
    groupFinalRewardCardId?: string;
    repeatable?: 'daily';
    requirements: {
        cardCount: number;
        exactRarityCount?: { [key: string]: number };
        minAvgOvr?: number;
        minTotalValue?: number;
        minRarityCount?: { [key: string]: number };
    };
    reward: {
        type: 'pack' | 'card' | 'coins';
        details?: PackType;
        cardId?: string;
        amount?: number;
        bypassLimit?: boolean;
    };
}

export interface Evolution {
    id: string;
    title: string;
    description: string;
    eligibility: {
        cardName?: string;
        rarity?: Rarity;
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
    type: 'coins' | 'pack' | 'card' | 'player_pick' | 'coins_and_pick';
    amount?: number;
    packType?: PackType;
    cardId?: string;
    playerPickId?: string;
  };
}

export interface ObjectiveProgress {
    tasks: Record<string, number>; 
    claimed: boolean;
}

export interface Settings {
  musicOn: boolean;
  musicVolume: number;
  sfxOn: boolean;
  sfxVolume: number;
  animationsOn: boolean;
}

export interface GlobalSettings {
    maintenanceMode: boolean;
    marketEnabled: boolean;
    battlesEnabled: boolean;
    announcement?: {
        active: boolean;
        message: string;
        type: 'info' | 'warning' | 'success';
    };
    disabledCardIds?: string[];
    activePromos?: Rarity[];
}

export interface User {
    username: string;
    email?: string;
    password?: string;
    avatar?: string;
}

export type CurrentUser = User | null;

export type Rank = 'Bronze' | 'Silver' | 'Gold' | 'Legend';
export type BlitzRank = 5 | 4 | 3 | 2 | 1;

export interface PlayerPickConfig {
    id: string;
    nameKey: string;
    pickCount: number;
    totalOptions: number;
    minOvr: number;
    rarityGuarantee?: Rarity;
    // Dynamic fields
    name?: string;
    cost?: number;
    image?: string;
    active?: boolean;
}

export interface Friend {
    uid: string;
    username: string;
    avatar?: string;
}

export interface FriendRequest {
    id: string;
    fromUid: string;
    fromName: string;
    fromAvatar?: string;
    toUid: string;
    toName: string;
    status: 'pending' | 'accepted' | 'rejected';
    timestamp: number;
}

export interface BattleInvite {
    id: string;
    fromUid: string;
    fromName: string;
    toUid: string;
    status: 'pending' | 'accepted' | 'rejected';
    battleId?: string;
    timestamp: number;
}

export interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    timestamp: number;
}

export interface GameState {
  version: number;
  userId: string;
  userProfile?: User;
  coins: number;
  battlePoints?: number;
  xp?: number;
  rank: Rank;
  rankValue: number;
  rankWins: number;
  blitzRank: BlitzRank;
  blitzWins: number;
  pendingEarnings?: number;
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
  ownedPacks: PackType[];
  ownedPlayerPicks: PlayerPickConfig[];
  activePlayerPick: PlayerPickConfig | null;
  friends: Friend[];
  banned?: boolean;
}

export interface Deal {
    offeredCard: Card;
    message: string;
}

export type BattleMode = 'attack' | 'defense';

export interface ActiveEffect {
    type: 'poison' | 'stun' | 'silence' | 'taunt' | 'untargetable' | 'buff';
    duration: number;
    val?: number;
    sourceId?: string;
}

export interface BattleCard extends Card {
    instanceId: string;
    maxHp: number;
    currentHp: number;
    atk: number;
    mode: BattleMode;
    owner: 'player' | 'cpu' | 'opponent';
    specialSlots: number;
    availableSuperpowers: string[];
    activeEffects: ActiveEffect[];
    attacksRemaining: number;
}

export interface BattleAction {
    attackerId: string;
    targetId: string | null;
    actionType: string;
    damage: number;
    isCrit: boolean;
    timestamp: number;
    rarity: Rarity; // Add rarity for projectile coloring
}

export interface OnlineBattleState {
    id: string;
    mode?: 'standard' | 'blitz';
    player1: {
        uid: string;
        username: string;
        avatar?: string;
        team: BattleCard[];
    };
    player2: {
        uid: string;
        username: string;
        avatar?: string;
        team: BattleCard[];
    };
    player1TimeRemaining?: number; // For Blitz: ms remaining
    player2TimeRemaining?: number; // For Blitz: ms remaining
    turn: string; // uid of the current turn
    winner: string | null; // uid of winner
    lastMoveTimestamp: number;
    lastAction?: BattleAction | null; // Detailed action data for visuals
    logs: string[];
    status: 'waiting' | 'preparing' | 'active' | 'finished';
}
