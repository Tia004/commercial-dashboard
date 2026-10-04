'use client';

import { useEffect } from 'react';

export function GlowPointerListener() {
  useEffect(() => {
    let ticking = false;

    const handlePointerMove = (e: PointerEvent) => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;
        const target = (e.target as HTMLElement)?.closest(
          '.bg-surface-container-lowest, .settings-card, .auth-panel, .theme-choice, .app-card'
        ) as HTMLElement | null;

        if (target) {
          const rect = target.getBoundingClientRect();
          const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
          const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
          target.style.setProperty('--glow-x', `${x}%`);
          target.style.setProperty('--glow-y', `${y}%`);
        }
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  return null;
}
