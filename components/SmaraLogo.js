'use client';
import React, { useState } from 'react';

export default function SmaraLogo({ size = 'md' }) {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <div className="flex flex-col items-center select-none">
        <img
          src="/logo-smara.jpg"
          alt="SMARA KOPI"
          onError={() => setImgError(true)}
          className={`${
            size === 'lg' ? 'w-28 h-28' : 'w-16 h-16'
          } object-contain mix-blend-screen drop-shadow-[0_0_16px_rgba(125,211,252,0.35)]`}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center select-none">
      <div className={`${size === 'lg' ? 'text-2xl' : 'text-base'} font-extrabold tracking-[0.2em]`}>
        <span className="text-white">SMARA </span>
        <span className="text-sky-300">PLAY</span>
      </div>
    </div>
  );
}
