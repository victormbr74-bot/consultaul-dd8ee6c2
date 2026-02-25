import { useState, useEffect } from 'react';

export function useTimeUpdate(intervalMs = 30000): Date {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
