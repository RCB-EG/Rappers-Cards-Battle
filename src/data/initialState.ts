import { GameState, MarketCard } from '../types';
import { formationLayouts, allCards } from './gameData';

const initialFormation: Record<string, null> = {};
formationLayouts['4-4-2'].allPositions.forEach(posId => {
  initialFormation[posId] = null;
});

// Seed some market cards so it's not empty
const seedMarket = (): MarketCard[] => {
  const marketCards: MarketCard[] = [];
  // Pick a few random cards to populate the market
  const indices = [0, 5, 10, 15, 20]; // Arbitrary indices
  
  indices.forEach((index, i) => {
    if (allCards[index]) {
      const card = allCards[index];
      marketCards.push({
        ...card,
        id: `market-seed-${i}`,
        price: Math.round(card.value * 1.2), // Slightly marked up
        sellerId: 'system',
        isSystem: true
      });
    }
  });
  
  return marketCards;
};

export const initialState: GameState = {
  userId: `user-${Math.random().toString(36).substr(2, 9)}`,
  coins: 10000,
  formation: initialFormation,
  formationLayout: '4-4-2',
  storage: [],
  market: seedMarket(),
  completedFbcIds: [],
  completedEvoIds: [],
  activeEvolution: null,
  lastRewardClaimTime: null,
  freePacksOpenedToday: 0,
  lastFreePackResetTime: null,
  objectiveProgress: {},
  lastDailyReset: null,
  lastWeeklyReset: null,
};