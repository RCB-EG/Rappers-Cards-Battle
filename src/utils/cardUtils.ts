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
      return Math.round(card.value * 0.25);
    default:
      // NEW LOGIC: Dynamic range based on OVR (Rating)
      // Base: 6000 for 80 OVR. Max: 15000 for 99 OVR.
      // Approx 475 coins per rating point above 80.
      
      const minPrice = 6000;
      const maxPrice = 15000;
      const minOvr = 80; // Starting point for the scale
      
      // Calculate difference
      const ovrDiff = Math.max(0, card.ovr - minOvr);
      const pricePerPoint = 475; // (15000 - 6000) / 19 points approx
      
      const calculated = minPrice + (ovrDiff * pricePerPoint);
      
      // Ensure it stays within your requested bounds
      return Math.round(Math.min(maxPrice, Math.max(minPrice, calculated)));
  }
};