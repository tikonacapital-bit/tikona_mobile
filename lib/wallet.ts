import { supabase } from './supabase';
import { logger } from './logger';
import { AIWallet } from './types';

export class WalletService {
  /**
   * Fetches the user's AI wallet balance.
   */
  static async getBalance(userId: string): Promise<AIWallet | null> {
    try {
      const { data, error } = await supabase
        .from('ai_wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('[WalletService] Error fetching balance:', error);
        return null;
      }
      return data as AIWallet;
    } catch (e) {
      logger.error('[WalletService] Exception fetching balance:', e);
      return null;
    }
  }
}
