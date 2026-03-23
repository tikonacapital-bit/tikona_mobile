/**
 * Chat Logger — Saves AI Chat sessions to Supabase
 *
 * Stores conversations as JSONB arrays inside `ai_chat_sessions` table.
 * Uses upsert-on-close pattern: creates a session row on first message,
 * then updates the messages array on session end.
 */

import { supabase } from './supabase';
import { logger } from './logger';

export interface ChatLogMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;         // ISO string
  input_mode?: 'voice' | 'text'; // only for user messages
  has_audio?: boolean;       // only for assistant messages
}

export interface ChatSession {
  id: string;
  user_id: string;
  report_id: string;
  company_name: string;
  nse_symbol: string;
  messages: ChatLogMessage[];
  message_count: number;
  started_at: string;
  ended_at: string | null;
}

/**
 * Create a new chat session row. Call this when the user sends their first message.
 * Returns the session UUID.
 */
export async function createChatSession(params: {
  userId: string;
  reportId: string;
  companyName: string;
  nseSymbol: string;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('ai_chat_sessions')
      .insert({
        user_id: params.userId,
        report_id: params.reportId,
        company_name: params.companyName,
        nse_symbol: params.nseSymbol,
        messages: [],
        message_count: 0,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[ChatLogger] Create session error:', error.message);
      return null;
    }

    return data.id;
  } catch (err) {
    logger.error('[ChatLogger] Create session exception:', err);
    return null;
  }
}

/**
 * Append messages to an existing session and update the count.
 * Call this after each complete exchange (user msg + AI reply).
 */
export async function appendMessages(
  sessionId: string,
  newMessages: ChatLogMessage[]
): Promise<void> {
  try {
    // Fetch current messages
    const { data: current, error: fetchErr } = await supabase
      .from('ai_chat_sessions')
      .select('messages')
      .eq('id', sessionId)
      .single();

    if (fetchErr || !current) {
      logger.error('[ChatLogger] Fetch messages error:', fetchErr?.message);
      return;
    }

    const existingMessages = (current.messages as ChatLogMessage[]) || [];
    const updatedMessages = [...existingMessages, ...newMessages];

    const { error: updateErr } = await supabase
      .from('ai_chat_sessions')
      .update({
        messages: updatedMessages,
        message_count: updatedMessages.length,
      })
      .eq('id', sessionId);

    if (updateErr) {
      logger.error('[ChatLogger] Append messages error:', updateErr.message);
    }
  } catch (err) {
    logger.error('[ChatLogger] Append messages exception:', err);
  }
}

/**
 * Close a chat session — sets `ended_at` timestamp.
 * Call this when the user closes the chat modal or starts a new chat.
 */
export async function closeChatSession(sessionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_chat_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      logger.error('[ChatLogger] Close session error:', error.message);
    }
  } catch (err) {
    logger.error('[ChatLogger] Close session exception:', err);
  }
}

/**
 * Fetch past chat sessions for a user + report combination.
 * Returns sessions ordered by most recent first.
 */
export async function fetchChatSessions(
  userId: string,
  reportId: string,
  limit: number = 20
): Promise<ChatSession[]> {
  try {
    const { data, error } = await supabase
      .from('ai_chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('report_id', reportId)
      .gt('message_count', 0)           // skip empty sessions
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[ChatLogger] Fetch sessions error:', error.message);
      return [];
    }

    return (data ?? []) as ChatSession[];
  } catch (err) {
    logger.error('[ChatLogger] Fetch sessions exception:', err);
    return [];
  }
}

/**
 * Delete a chat session.
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      logger.error('[ChatLogger] Delete session error:', error.message);
    }
  } catch (err) {
    logger.error('[ChatLogger] Delete session exception:', err);
  }
}
