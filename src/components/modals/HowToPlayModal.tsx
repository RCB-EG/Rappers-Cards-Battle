
import React, { useState } from 'react';
import Modal from './Modal';
import Button from '../Button';
import { TranslationKey } from '../../utils/translations';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: TranslationKey) => string;
}

const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose, t }) => {
    const [page, setPage] = useState(0);

    const pages: { titleKey: TranslationKey; textKey: TranslationKey }[] = [
        { titleKey: 'how_to_play_goal_title', textKey: 'how_to_play_goal_text' },
        { titleKey: 'how_to_play_store_title', textKey: 'how_to_play_store_text' },
        { titleKey: 'how_to_play_cards_title', textKey: 'how_to_play_cards_text' },
        { titleKey: 'how_to_play_market_title', textKey: 'how_to_play_market_text' },
        { titleKey: 'how_to_play_challenges_title', textKey: 'how_to_play_challenges_text' },
        { titleKey: 'how_to_play_blitz_title', textKey: 'how_to_play_blitz_text' },
    ];
    
    const currentPage = pages[page];
    const isLastPage = page === pages.length - 1;

    const handleNext = () => setPage(p => Math.min(p + 1, pages.length - 1));
    const handleBack = () => setPage(p => Math.max(p - 1, 0));

    // Reset to first page when modal is opened
    React.useEffect(() => {
        if (isOpen) {
            setPage(0);
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('how_to_play_title')}>
            <div className="text-left text-white space-y-4 my-6">
                <h3 className="font-header text-2xl text-gold-light">{t(currentPage.titleKey)}</h3>
                <p className="text-gray-300 leading-relaxed">{t(currentPage.textKey)}</p>
                <div className="flex justify-center pt-2">
                    {pages.map((_, index) => (
                        <div key={index} className={`w-3 h-3 rounded-full mx-1 transition-colors ${index === page ? 'bg-gold-light' : 'bg-gray-600'}`}></div>
                    ))}
                </div>
            </div>
            <div className="flex justify-between items-center mt-6">
                <Button variant="default" onClick={handleBack} disabled={page === 0}>Back</Button>
                {isLastPage ? (
                    <Button variant="ok" onClick={onClose}>{t('got_it')}</Button>
                ) : (
                    <Button variant="cta" onClick={handleNext}>Next</Button>
                )}
            </div>
        </Modal>
    );
};

export default HowToPlayModal;
