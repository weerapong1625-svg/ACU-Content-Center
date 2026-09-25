import { useState, useEffect, useRef, useCallback } from 'react';

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes warning before timeout
export const ACU_LAST_ACTIVE_KEY = 'acu_last_active_time';

interface UseInactivityTimeoutOptions {
  timeoutMs?: number;
  warningMs?: number;
  isLoggedIn: boolean;
  onTimeout: () => void;
}

export function useInactivityTimeout({
  timeoutMs = INACTIVITY_TIMEOUT_MS,
  warningMs = WARNING_BEFORE_TIMEOUT_MS,
  isLoggedIn,
  onTimeout,
}: UseInactivityTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(Math.floor(warningMs / 1000));

  const lastActiveRef = useRef<number>(Date.now());
  const lastSavedStorageRef = useRef<number>(0);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // Function to mark activity and reset idle timer
  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;

    // Throttle writing to localStorage to once every 10 seconds
    if (now - lastSavedStorageRef.current > 10000) {
      lastSavedStorageRef.current = now;
      try {
        localStorage.setItem(ACU_LAST_ACTIVE_KEY, now.toString());
      } catch {
        // ignore
      }
    }

    setShowWarning(false);
  }, []);

  // Explicit function to extend session (e.g., when clicking "ใช้งานต่อ")
  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;
    lastSavedStorageRef.current = now;
    try {
      localStorage.setItem(ACU_LAST_ACTIVE_KEY, now.toString());
    } catch {
      // ignore
    }
    setShowWarning(false);
  }, []);

  // Handle user activity events
  useEffect(() => {
    if (!isLoggedIn) {
      setShowWarning(false);
      return;
    }

    // Initialize or verify current active timestamp
    const now = Date.now();
    try {
      const stored = localStorage.getItem(ACU_LAST_ACTIVE_KEY);
      const parsed = stored ? parseInt(stored, 10) : 0;
      if (!parsed || now - parsed >= timeoutMs) {
        // Was inactive or fresh login
        localStorage.setItem(ACU_LAST_ACTIVE_KEY, now.toString());
        lastActiveRef.current = now;
        lastSavedStorageRef.current = now;
      } else {
        lastActiveRef.current = parsed;
      }
    } catch {
      lastActiveRef.current = now;
    }

    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
      'click',
    ];

    const handleUserInteraction = () => {
      // Only record regular activity if warning modal is not currently locking attention,
      // or record it to refresh user state
      recordActivity();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserInteraction, { passive: true });
    });

    // Check immediately when tab becomes visible or window gains focus
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const currentTime = Date.now();
        let effectiveLastActive = lastActiveRef.current;
        try {
          const stored = localStorage.getItem(ACU_LAST_ACTIVE_KEY);
          if (stored) {
            effectiveLastActive = Math.max(effectiveLastActive, parseInt(stored, 10));
          }
        } catch {
          // ignore
        }

        const elapsed = currentTime - effectiveLastActive;
        if (elapsed >= timeoutMs) {
          onTimeoutRef.current();
        } else {
          // Sync in-memory timestamp
          lastActiveRef.current = effectiveLastActive;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Multi-tab sync: if another tab recorded activity or logged out
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === ACU_LAST_ACTIVE_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (remoteTime > lastActiveRef.current) {
          lastActiveRef.current = remoteTime;
          setShowWarning(false);
        }
      } else if (e.key === 'acu_current_user_email' && !e.newValue) {
        // Logged out in another tab
        onTimeoutRef.current();
      }
    };

    window.addEventListener('storage', handleStorageEvent);

    // Interval ticker to evaluate inactivity
    const intervalId = window.setInterval(() => {
      const currentTime = Date.now();
      let effectiveLastActive = lastActiveRef.current;

      try {
        const stored = localStorage.getItem(ACU_LAST_ACTIVE_KEY);
        if (stored) {
          effectiveLastActive = Math.max(effectiveLastActive, parseInt(stored, 10));
        }
      } catch {
        // ignore
      }

      const elapsed = currentTime - effectiveLastActive;

      if (elapsed >= timeoutMs) {
        setShowWarning(false);
        window.clearInterval(intervalId);
        onTimeoutRef.current();
      } else if (elapsed >= timeoutMs - warningMs) {
        setShowWarning(true);
        const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
        setRemainingSeconds(remaining);
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserInteraction);
      });
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageEvent);
      window.clearInterval(intervalId);
    };
  }, [isLoggedIn, timeoutMs, warningMs, recordActivity]);

  return {
    showWarning,
    remainingSeconds,
    extendSession,
  };
}
