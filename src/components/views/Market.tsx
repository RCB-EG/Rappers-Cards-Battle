import React, { useState, useMemo } from 'react';
import { MarketCard } from '../../types';
import Card from '../Card';
import BuyModal from '../modals/BuyModal';
import DelistModal from '../modals/DelistModal';
import { TranslationKey } from '../../utils/translations';

interface MarketProps {
  market: MarketCard[];
  onBuyCard: (card: MarketCard) => void;
  onDelistCard: (card: MarketCard) => void;
  currentUserUid: string;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const Market: React.FC<MarketProps> = ({ market, onBuyCard, onDelistCard, currentUserUid, t }) => {
  const [cardToBuy, setCardToBuy] = useState<MarketCard | null>(null);
  const [cardToDelist, setCardToDelist] = useState<MarketCard | null>(null);
  const [sortBy, setSortBy] = useState('price-asc');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const sortedAndFilteredMarket = useMemo(() => {
    let filtered = market.filter(card => 
      card.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (rarityFilter === 'all' || card.rarity === rarityFilter)
    );
    // Sort so user's cards appear first
    filtered.sort((a, b) => {
        if (a.sellerUid === currentUserUid && b.sellerUid !== currentUserUid) return -1;
        if (a.sellerUid !== currentUserUid && b.sellerUid === currentUserUid) return 1;

        switch (sortBy) {
            case 'price-desc': return b.price - a.price;
            case 'price-asc': return a.price - b.price;
            default: return 0;
        }
    });
    return filtered;
  }, [market, sortBy, rarityFilter, searchTerm, currentUserUid]);

  const handleBuyConfirm = (card: MarketCard) => {
    onBuyCard(card);
    setCardToBuy(null);
  };
  
  const handleDelistConfirm = (card: MarketCard) => {
    onDelistCard(card);
    setCardToDelist(null);
  };

  return (
    <div className="animate-fadeIn">
      <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_market')}</h2>
      
      {/* Controls */}
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
            <option value="price-asc">{t('sort_price_asc')}</option>
            <option value="price-desc">{t('sort_price_desc')}</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6 justify-items-center p-4 rounded-lg min-h-[300px] bg-black/30 border border-gold-dark/30">
        {sortedAndFilteredMarket.length > 0 ? (
          sortedAndFilteredMarket.map(card => {
            const isOwnCard = card.sellerUid === currentUserUid;

            const handleClick = () => {
              if (isOwnCard) {
                setCardToDelist(card);
              } else {
                setCardToBuy(card);
              }
            };
            
            return (
                <div key={card.listingId} className="cursor-pointer relative group" onClick={handleClick}>
                  <Card card={card} origin="market" />
                  {isOwnCard && (
                    <div className="absolute top-0 left-0 w-full bg-blue-500/80 text-white text-center font-main text-sm py-1 rounded-t-md pointer-events-none">
                      Your Listing
                    </div>
                  )}
                  <div className="absolute bottom-2 left-0 right-0 bg-black/70 text-center py-1 rounded-b-md transition-opacity duration-300">
                      <span className="text-gold-light font-bold">{card.price} {t('coins')}</span>
                  </div>
                </div>
            );
          })
        ) : (
          <p className="col-span-full text-center text-gray-400 text-xl py-10">The market is empty.</p>
        )}
      </div>

      <BuyModal cardToBuy={cardToBuy} onClose={() => setCardToBuy(null)} onBuy={handleBuyConfirm} t={t} />
      <DelistModal cardToDelist={cardToDelist} onClose={() => setCardToDelist(null)} onConfirm={handleDelistConfirm} t={t} />
    </div>
  );
};
export default Market;