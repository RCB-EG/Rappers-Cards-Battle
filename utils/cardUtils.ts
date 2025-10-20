import { Card } from '../types';

/**
 * Calculates the quick sell value of a card based on its rarity.
 * The percentages are fixed for different tiers.
 * @param card The card to calculate the value for.
 * @returns The number of coins the card can be quick sold for.
 */
export const calculateQuickSellValue = (card: Card): number => {
  switch (card.rarity) {
    case 'bronze':
      return 200;
    case 'silver':
      return 600;
    case 'gold':
      return Math.round(card.value * 0.10);
    case 'icon':
    case 'rotm':
      return Math.round(card.value * 0.20);
    case 'legend':
    case 'event':
      // Default for unspecified high-tier cards
      return Math.round(card.value * 0.25);
    default:
      // Fallback for any other rarity
      return Math.round(card.value * 0.05);
  }
};
