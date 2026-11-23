'use client';
import React, { useState } from 'react';

export default function SmaraLogo({ size = 'md', className = '' }) {
  const [srcStage, setSrcStage] = useState(0); // 0: cropped png, 1: original jpg, 2: text fallback

  const sizeClass =
    size === 'lg'
      ? 'h-24 w-auto'
      : size === 'sm'
      ? 'h-10 w-auto'
      : 'h-12 w-auto';

  if (srcStage === 0) {
    return (
      <div className={`flex flex-col items-center select-none ${className}`}>
        <img
          src="/logo-smara-sm.png"
          alt="SMARA KOPI"
          onError={() => setSrcStage(1)}
          className={`${sizeClass} object-contain drop-shadow-[0_0_16px_rgba(125,211,252,0.4)]`}
        />
      </div>
    );
  }

  if (srcStage === 1) {
    return (
      <div className={`flex flex-col items-center select-none ${className}`}>
        <img
          src="/logo-smara.jpg"
          alt="SMARA KOPI"
          onError={() => setSrcStage(2)}
          className={`${
            size === 'lg' ? 'w-28 h-28' : size === 'sm' ? 'w-12 h-12' : 'w-16 h-16'
          } object-contain mix-blend-screen drop-shadow-[0_0_16px_rgba(125,211,252,0.35)]`}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div className={`${size === 'lg' ? 'text-2xl' : 'text-base'} font-extrabold tracking-[0.2em]`}>
        <span className="text-white">SMARA </span>
        <span className="text-sky-300">KOPI</span>
      </div>
    </div>
  );
}
