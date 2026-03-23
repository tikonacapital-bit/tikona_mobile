import AsyncStorage from '@react-native-async-storage/async-storage';

export class RateLimiter {
  /**
   * Checks if the user has hit the rate limit for a specific feature.
   * @param key E.g., 'speech_to_speech'
   * @param limit Max requests
   * @param windowMs Time window in milliseconds (default 24 hours)
   * @param increment Whether to consume a request if allowed (default true)
   * @returns true if allowed, false if limit exceeded
   */
  static async checkLimit(key: string, limit: number, windowMs: number = 24 * 60 * 60 * 1000, increment: boolean = true): Promise<boolean> {
    try {
      const storageKey = `rate_limit_${key}`;
      const raw = await AsyncStorage.getItem(storageKey);
      const now = Date.now();
      let timestamps: number[] = raw ? JSON.parse(raw) : [];

      // Filter timestamps to only keep recent ones within the window
      timestamps = timestamps.filter(t => now - t < windowMs);

      if (timestamps.length >= limit) {
        return false; // Rate limit exceeded
      }

      if (increment) {
        // Add the new request and save
        timestamps.push(now);
        await AsyncStorage.setItem(storageKey, JSON.stringify(timestamps));
      }
      return true;
    } catch (e) {
      console.error('Rate limit error:', e);
      return true; // Failsafe to true if storage fails
    }
  }

  static async getRemaining(key: string, limit: number, windowMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const storageKey = `rate_limit_${key}`;
      const raw = await AsyncStorage.getItem(storageKey);
      const now = Date.now();
      let timestamps: number[] = raw ? JSON.parse(raw) : [];
      timestamps = timestamps.filter(t => now - t < windowMs);
      return Math.max(0, limit - timestamps.length);
    } catch (e) {
      return limit;
    }
  }
}
