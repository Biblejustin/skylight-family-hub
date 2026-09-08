'use client';

import { useState, useEffect } from 'react';

/**
 * Character-by-character typewriter reveal effect.
 * Returns the partially displayed text and whether the animation is complete.
 */
export function useTypewriter(
  text: string,
  enabled: boolean,
  speed = 35,
): { displayed: string; done: boolean } {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i > text.length) {
        setDone(true);
        clearInterval(id);
      } else {
        setDisplayed(text.slice(0, i));
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, enabled, speed]);

  return { displayed, done };
}
