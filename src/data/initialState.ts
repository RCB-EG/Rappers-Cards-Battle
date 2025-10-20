import { GameState } from '../types';
import { formationLayouts } from './gameData';

const initialFormation: Record<string, null> = {};
formationLayouts['4-4-2'].allPositions.forEach(posId => {
  initialFormation[posId] = null;
});

export const initialState: GameState = {
  userId: `user-${Math.random().toString(36).substr(2, 9)}`,
  coins: 10000,
  formation: initialFormation,
  formationLayout: '4-4-2',
  storage: [],
  market: [],
  completedFbcIds: [],
  completedEvoIds: [],
  activeEvolution: null,
  lastRewardClaimTime: null,
  freePacksOpenedToday: 0,
  lastFreePackResetTime: null,
};
