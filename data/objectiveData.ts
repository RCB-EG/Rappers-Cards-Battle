
import { ObjectiveData } from '../types';

export const objectiveData: ObjectiveData = {
    daily: [
        {
            id: 'open_builder_pack',
            description: 'Open a Builder Pack',
            target: 1,
            reward: { type: 'coins', amount: 500 }
        },
        {
            id: 'list_card_market',
            description: 'List a card on the market',
            target: 1,
            reward: { type: 'coins', amount: 250 }
        }
    ],
    weekly: [
        {
            id: 'open_special_pack',
            description: 'Open a Special Pack',
            target: 1,
            reward: { type: 'pack', packType: 'builder' }
        },
        {
            id: 'buy_card_market',
            description: 'Buy a card from the market',
            target: 1,
            reward: { type: 'coins', amount: 1000 }
        },
        {
            id: 'complete_fbc',
            description: 'Complete a Formation Building Challenge',
            target: 1,
            reward: { type: 'pack', packType: 'special' }
        },
        {
            id: 'complete_evo',
            description: 'Complete a Card Evolution',
            target: 1,
            reward: { type: 'coins', amount: 5000 }
        }
    ]
};
