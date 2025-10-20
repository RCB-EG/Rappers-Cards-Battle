
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'cta' | 'keep' | 'sell' | 'ok' | 'default';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ variant = 'default', children, className, ...props }) => {
  const baseClasses = "relative px-6 py-3 font-main text-lg text-white rounded-md cursor-pointer transition-all duration-200 shadow-[0_4px_10px_rgba(0,0,0,0.5)] disabled:cursor-not-allowed disabled:transform-none disabled:shadow-[0_4px_10px_rgba(0,0,0,0.5)] disabled:border-gray-600 disabled:bg-gray-600 disabled:text-gray-400";
  
  const hoverClasses = "hover:-translate-y-0.5 hover:shadow-[0_6px_15px_rgba(0,0,0,0.6),0_0_10px_#FFD700] hover:border-gold-light";

  const variantClasses = {
    cta: 'bg-gradient-to-br from-green-500 to-green-700 border-2 border-green-800',
    keep: 'bg-gradient-to-br from-green-500 to-green-700 border-2 border-green-800',
    sell: 'bg-gradient-to-br from-red-600 to-red-800 border-2 border-red-900',
    ok: 'bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-blue-800',
    default: 'bg-gradient-to-br from-light-gray to-darker-gray border-2 border-gray-500',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${!props.disabled ? hoverClasses : ''} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
