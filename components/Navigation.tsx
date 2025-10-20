import React from 'react';
import { GameView } from '../types';
import { TranslationKey } from '../utils/translations';

interface NavigationProps {
  currentView: GameView;
  setCurrentView: (view: GameView) => void;
  t: (key: TranslationKey) => string;
}

const NavTab: React.FC<{
  label: string;
  view: GameView;
  isActive: boolean;
  onClick: (view: GameView) => void;
}> = ({ label, view, isActive, onClick }) => {
  const baseClasses = "relative px-4 md:px-8 py-2 font-header text-2xl md:text-3xl tracking-wider cursor-pointer transition-all duration-300 bg-gradient-to-b from-gray-700 to-dark-gray text-gold-dark/70 [clip-path:polygon(0%_50%,8%_0%,92%_0%,100%_50%,92%_100%,8%_100%)] border-t-2 border-b-2 border-t-gray-500 border-b-gray-800 shadow-blue-glow/40";
  const activeClasses = "bg-gradient-to-b from-gray-600 to-gray-800 text-gold-light scale-105 z-10 shadow-[0_0_10px_#00c7e2,0_0_5px_rgba(255,255,255,0.5)]";
  const hoverClasses = "hover:text-gold-light hover:shadow-blue-glow hover:scale-105";

  return (
    <button
      onClick={() => onClick(view)}
      className={`${baseClasses} ${isActive ? activeClasses : hoverClasses}`}
    >
      {label}
    </button>
  );
};

const Navigation: React.FC<NavigationProps> = ({ currentView, setCurrentView, t }) => {
  const navItems: { labelKey: TranslationKey; view: GameView }[] = [
    { labelKey: 'nav_store', view: 'store' },
    { labelKey: 'nav_cards', view: 'collection' },
    { labelKey: 'nav_market', view: 'market' },
    { labelKey: 'nav_battle', view: 'battle' },
    { labelKey: 'nav_fbc', view: 'fbc' },
    { labelKey: 'nav_evo', view: 'evo' },
  ];

  return (
    <nav className="mobile-nav-container flex gap-2 md:gap-4 mb-8 flex-wrap justify-center pb-2">
      {navItems.map(item => (
        <NavTab
          key={item.view}
          label={t(item.labelKey)}
          view={item.view}
          isActive={currentView === item.view}
          onClick={setCurrentView}
        />
      ))}
    </nav>
  );
};

export default Navigation;