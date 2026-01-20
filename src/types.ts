
export type Rarity = 'bronze' | 'silver' | 'gold' | 'icon' | 'rotm' | 'legend' | 'event';

export type GameView = 'store' | 'collection' | 'market' | 'battle' | 'fbc' | 'evo' | 'objectives' | 'social';

export type PackType = 'free' | 'bronze' | 'builder' | 'special' | 'legendary';

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
    repeatable?: 'daily';
    requirements: {
        cardCount: number;
        exactRarityCount?: { [key in Rarity]?: number };
        minAvgOvr?: number;
        minTotalValue?: number;
        minRarityCount?: { [key in Rarity]?: number };
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

export interface User {
    username: string;
    email?: string;
    password?: string;
    avatar?: string;
}

export type CurrentUser = User | null;

export type Rank = 'Bronze' | 'Silver' | 'Gold' | 'Legend';

export interface PlayerPickConfig {
    id: string;
    nameKey: string;
    pickCount: number;
    totalOptions: number;
    minOvr: number;
    rarityGuarantee?: Rarity;
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

export interface OnlineBattleState {
    id: string;
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
    turn: string; // uid of the current turn
    winner: string | null; // uid of winner
    lastMoveTimestamp: number;
    logs: string[];
    status: 'waiting' | 'preparing' | 'active' | 'finished';
}
