import React from 'react';

const Particles: React.FC = () => {
    const particleCount = 50;
    return (
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
            {Array.from({ length: particleCount }).map((_, i) => {
                const size = Math.random() * 5 + 2;
                const style = {
                    width: `${size}px`,
                    height: `${size}px`,
                    left: `${Math.random() * 100}vw`,
                    animationDelay: `${Math.random() * 20}s`,
                    animationDuration: `${Math.random() * 10 + 15}s`,
                };
                return (
                    <div
                        key={i}
                        className="absolute bg-gold-light rounded-full opacity-0 animate-float shadow-glow"
                        style={style}
                    />
                );
            })}
        </div>
    );
};

export default Particles;