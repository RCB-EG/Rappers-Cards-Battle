
import React from 'react';
import Button from './Button';

interface IntroVideoProps {
  onSkip: () => void;
}

const IntroVideo: React.FC<IntroVideoProps> = ({ onSkip }) => {
  return (
    <div className="fixed inset-0 bg-black z-[99] flex justify-center items-center transition-opacity duration-1000">
      <video
        src="https://od.lk/s/NTdfMTAxMTA3MTMyXw/Intro%20Ultra%20Comp.mp4"
        autoPlay
        playsInline
        onEnded={onSkip}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-8 right-8 z-[100]">
         <Button variant="default" onClick={onSkip}>Skip Intro</Button>
      </div>
    </div>
  );
};

export default IntroVideo;
