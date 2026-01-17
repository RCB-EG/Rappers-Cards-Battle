
import React from 'react';
import Button from './Button';

interface WelcomeScreenProps {
  onStart: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col justify-center items-center gap-8 p-4">
      <img 
        src="https://i.imghippo.com/files/osQP7559xUw.png" 
        alt="Rappers Battle"
        className="max-w-full w-[500px] drop-shadow-[0_0_10px_#FFD700] drop-shadow-[0_0_20px_#B8860B]"
      />
      <Button variant="cta" onClick={onStart}>Play</Button>
    </div>
  );
};

export default WelcomeScreen;
