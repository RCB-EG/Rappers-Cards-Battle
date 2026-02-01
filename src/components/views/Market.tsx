
import React, { useState, useMemo, useEffect } from 'react';
import { MarketCard, Card as CardType } from '../../types';
import Card from '../Card';
import BuyModal from '../modals/BuyModal';
import Button from '../Button';
import { TranslationKey } from '../../utils/translations';
import { allCards } from '../../data/gameData';

interface MarketProps {
  market: MarketCard[];
  onBuyCard: (card: MarketCard) => void;
  onCancelListing: (card: MarketCard) => void;
  onClaimCard: (card: MarketCard) => void; // New prop for claiming expired/won items
  currentUserId: string;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
  userCoins: number;
}

const formatDuration = (ms: number) => {
    if (ms <= 0) return "Expired";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${Math.floor((ms % 60000) / 1000)}s`;
};

// Helper to merge old market data with current game definitions
const getUpdatedCardData = (marketCard: MarketCard): MarketCard => {
    const canonical = allCards.find(c => c.name === marketCard.name && c.rarity === marketCard.rarity);
    if (canonical) {
        return {
            ...marketCard,
            ovr: marketCard.ovr || canonical.ovr,
            stats: marketCard.stats || canonical.stats,
        };
    }
    return marketCard;
};

const Market: React.FC<MarketProps> = ({ market, onBuyCard, onCancelListing, onClaimCard, currentUserId, t, userCoins }) => {
  const [cardToBuy, setCardToBuy] = useState<MarketCard | null>(null);
  const [sortBy, setSortBy] = useState('ending_soon');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [now, setNow] = useState(Date.now());

  // Timer Tick
  useEffect(() => {
      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timer);
  }, []);

  const processedMarket = useMemo(() => {
      return market
        .map(card => {
            const updatedCard = getUpdatedCardData(card);
            let expiresAt = updatedCard.expiresAt || 0;
            const durationMs = (updatedCard.durationHours || 24) * 3600000;
            
            // Client-side visual fix for items that theoretically auto-renew if no bidder
            if (now > expiresAt && !updatedCard.highestBidderId && durationMs > 0) {
                const timeSinceExpiry = now - expiresAt;
                const cycles = Math.ceil(timeSinceExpiry / durationMs);
                expiresAt = expiresAt + (cycles * durationMs);
            }
            
            return { ...updatedCard, displayExpiresAt: expiresAt };
        })
        .filter(card => {
            // FIX: Show items if Time Remaining OR Has Bidder OR Is Mine
            // This ensures finished auctions are visible to be claimed
            const timeRemaining = (card.displayExpiresAt || 0) - now;
            const hasBidder = !!card.highestBidderId;
            const isMyListing = card.sellerId === currentUserId;
            const isMyBid = card.highestBidderId === currentUserId;
            
            return timeRemaining > 0 || hasBidder || isMyListing || isMyBid;
        });
  }, [market, now, currentUserId]);

  const sortedAndFilteredMarket = useMemo(() => {
    let filtered = processedMarket.filter(card => 
      card.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (rarityFilter === 'all' || card.rarity === rarityFilter)
    );
    
    filtered.sort((a, b) => {
      const priceA = a.buyNowPrice || a.price || 0;
      const priceB = b.buyNowPrice || b.price || 0;
      
      switch (sortBy) {
        case 'price-desc': return priceB - priceA;
        case 'price-asc': return priceA - priceB;
        case 'bid-desc': return b.bidPrice - a.bidPrice;
        case 'ending_soon': return (a.displayExpiresAt || 0) - (b.displayExpiresAt || 0);
        case 'newest': return (b.createdAt || 0) - (a.createdAt || 0);
        default: return 0;
      }
    });
    return filtered;
  }, [processedMarket, sortBy, rarityFilter, searchTerm]);

  const handleMarketAction = (card: MarketCard, action: 'buy' | 'bid' | 'cancel', bidAmount?: number) => {
    if (action === 'cancel') {
        onCancelListing(card);
    } else if (action === 'buy') {
        const safePrice = card.buyNowPrice || card.price || 0;
        onBuyCard({ ...card, bidPrice: safePrice }); 
    } else if (action === 'bid' && bidAmount) {
        onBuyCard({ ...card, bidPrice: bidAmount });
    }
    setCardToBuy(null);
  };

  return (
    <div className="animate-fadeIn">
      <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_market')}</h2>
      
      <div className="controls-bar flex justify-between items-center mt-6 mb-4 flex-wrap gap-4 p-4 bg-black/20 rounded-lg">
        <div className="filter-group flex gap-2 items-center">
          <input 
            type="text"
            placeholder={t('search_by_name')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md"
          />
          <select value={rarityFilter} onChange={e => setRarityFilter(e.target.value)} className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md">
            <option value="all">All Rarities</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="rotm">ROTM</option>
            <option value="icon">Icon</option>
            <option value="legend">Legend</option>
            <option value="event">Event</option>
          </select>
        </div>
        <div className="filter-group flex gap-2 items-center">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-darker-gray border border-gold-dark/30 text-white p-2 rounded-md">
            <option value="ending_soon">Ending Soon</option>
            <option value="newest">Newest Listed</option>
            <option value="price-asc">Buy Now: Low to High</option>
            <option value="price-desc">Buy Now: High to Low</option>
            <option value="bid-desc">Highest Bid</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6 justify-items-center p-4 rounded-lg min-h-[300px] bg-black/30 border border-gold-dark/30">
        {sortedAndFilteredMarket.length > 0 ? (
          sortedAndFilteredMarket.map(card => {
            const isOwner = card.sellerId === currentUserId;
            const isWinning = card.highestBidderId === currentUserId;
            const hasBids = !!card.highestBidderId;
            const displayBuyPrice = card.buyNowPrice || card.price || 0;
            
            // Expiry logic check
            const timeLeft = (card.displayExpiresAt || 0) - now;
            const isExpired = timeLeft <= 0;
            
            // "Claim" state logic
            const showClaim = isExpired && (
                (isWinning) || // Winner claiming item
                (isOwner && !hasBids) // Seller reclaiming unsold item
            );

            return (
                <div key={card.id} className="cursor-pointer relative group w-full max-w-[180px]" onClick={() => !showClaim && setCardToBuy(card)}>
                    <Card card={card} origin="market" className="!w-full !h-auto aspect-[2/3]" />
                    
                    {/* Timer Badge */}
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold shadow-md z-20 ${isExpired ? 'bg-gray-800 text-gray-400' : timeLeft < 300000 ? 'bg-red-600 text-white animate-pulse' : 'bg-black/70 text-gray-300'}`}>
                        {formatDuration(timeLeft)}
                    </div>

                    {/* Status Badge */}
                    {isWinning && !isExpired && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-md z-20">
                            Winning
                        </div>
                    )}

                    {/* Claim Button Overlay */}
                    {showClaim && (
                        <div className="absolute inset-0 bg-black/60 z-30 flex flex-col items-center justify-center p-2 rounded-lg">
                            <span className="text-gold-light font-bold mb-2 text-center text-sm">Auction Ended</span>
                            <Button 
                                variant="keep" 
                                onClick={(e) => { e.stopPropagation(); onClaimCard(card); }} 
                                className="!py-1 !px-3 text-xs w-full shadow-gold-glow animate-pulse"
                            >
                                {isWinning ? t('claim_item') : t('reclaim_card')}
                            </Button>
                        </div>
                    )}

                    <div className={`absolute bottom-2 left-0 right-0 py-2 rounded-b-md transition-opacity duration-300 opacity-100 group-hover:opacity-0 flex flex-col items-center justify-center gap-0.5 ${isOwner ? 'bg-blue-900/90' : 'bg-black/80'}`}>
                        {isOwner ? (
                            <span className="text-white font-bold text-sm">YOUR LISTING</span>
                        ) : (
                            <>
                                <div className="flex justify-between w-full px-3 text-xs">
                                    <span className="text-gray-400">{hasBids ? "Bid" : "Start"}</span>
                                    <span className="text-blue-300 font-bold">{hasBids ? card.bidPrice : card.startingPrice}</span>
                                </div>
                                <div className="flex justify-between w-full px-3 text-xs">
                                    <span className="text-gray-400">Buy</span>
                                    <span className="text-gold-light font-bold">{displayBuyPrice}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            );
          })
        ) : (
          <p className="col-span-full text-center text-gray-400 text-xl py-10">The market is empty.</p>
        )}
      </div>

      <BuyModal 
        cardToBuy={cardToBuy} 
        onClose={() => setCardToBuy(null)} 
        onAction={handleMarketAction} 
        t={t} 
        userCoins={userCoins} 
        isOwner={cardToBuy?.sellerId === currentUserId}
      />
    </div>
  );
};
export default Market;
