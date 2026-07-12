import { useEffect, useState } from 'react';

export default function Countdown({ expiresAt, onExpire }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const isUrgent = seconds <= 10;

  return (
    <span
      className={`font-mono text-sm font-semibold ${isUrgent ? 'text-red-400' : 'text-amber-300'}`}
    >
      {seconds}s
    </span>
  );
}
