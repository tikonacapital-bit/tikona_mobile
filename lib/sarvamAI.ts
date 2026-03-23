/**
 * Sarvam AI Service — Speech-to-Speech Report Assistant
 * 
 * Communicates with the `report-ai-chat` Supabase Edge Function
 * which proxies requests to Sarvam AI APIs (STT, Chat, TTS).
 */

const EDGE_FUNCTION_URL = (() => {
  // Supabase edge function URL follows pattern:
  // https://<project-ref>.supabase.co/functions/v1/<function-name>
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  return `${supabaseUrl}/functions/v1/report-ai-chat`;
})();

function buildHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface STTResponse {
  transcript: string;
  language_code: string;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  reply: string;
}

interface TTSResponse {
  audio: string; // base64 encoded audio
}

interface SpeechToSpeechResponse {
  user_transcript: string;
  ai_reply: string;
  audio: string; // base64 encoded audio
}

/**
 * Convert speech audio to text using Sarvam AI STT (Saaras v3)
 */
export async function speechToText(
  audioBase64: string,
  languageCode: string = 'en-IN',
  token: string = ''
): Promise<STTResponse> {
  const headers = buildHeaders(token);

  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'stt',
      audio: audioBase64,
      language_code: languageCode,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`STT failed: ${err}`);
  }

  return res.json();
}

/**
 * Send a text message to the AI chat with report context
 */
export async function chatWithReport(
  message: string,
  reportContext: string,
  history: ChatHistoryEntry[] = [],
  token: string = ''
): Promise<ChatResponse> {
  const headers = buildHeaders(token);

  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'chat',
      message,
      report_context: reportContext,
      history,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chat failed: ${err}`);
  }

  return res.json();
}

/**
 * Convert text to speech using Sarvam AI TTS (Bulbul v3)
 */
export async function textToSpeech(
  text: string,
  languageCode: string = 'en-IN',
  token: string = ''
): Promise<TTSResponse> {
  const headers = buildHeaders(token);

  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'tts',
      text,
      language_code: languageCode,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS failed: ${err}`);
  }

  return res.json();
}

/**
 * Full speech-to-speech pipeline:
 * User speech → STT → Chat AI → TTS → AI speech
 */
export async function speechToSpeech(
  audioBase64: string,
  reportContext: string,
  languageCode: string = 'en-IN',
  token: string = ''
): Promise<SpeechToSpeechResponse> {
  const headers = buildHeaders(token);

  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'speech_to_speech',
      audio: audioBase64,
      report_context: reportContext,
      language_code: languageCode,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Speech-to-speech failed: ${err}`);
  }

  return res.json();
}

/**
 * Build report context string from a ResearchReport object.
 * This is sent to the LLM as context for answering questions.
 */
export function buildReportContext(report: {
  company_name: string;
  nse_symbol: string;
  recommendation?: string | null;
  target_price?: number | null;
  recommendation_rationale?: string | null;
  company_background?: string | null;
  business_model?: string | null;
  management_analysis?: string | null;
  industry_overview?: string | null;
  industry_tailwinds?: string | null;
  demand_drivers?: string | null;
  industry_risks?: string | null;
}): string {
  const sections: string[] = [];

  sections.push(`Company: ${report.company_name}`);
  sections.push(`NSE Symbol: ${report.nse_symbol}`);

  if (report.recommendation) {
    sections.push(`Recommendation: ${report.recommendation}`);
  }
  if (report.target_price) {
    sections.push(`Target Price: ₹${report.target_price.toLocaleString('en-IN')}`);
  }
  if (report.recommendation_rationale) {
    sections.push(`\nRecommendation Rationale:\n${report.recommendation_rationale}`);
  }
  if (report.company_background) {
    sections.push(`\nCompany Background:\n${report.company_background}`);
  }
  if (report.business_model) {
    sections.push(`\nBusiness Model:\n${report.business_model}`);
  }
  if (report.management_analysis) {
    sections.push(`\nManagement Analysis:\n${report.management_analysis}`);
  }
  if (report.industry_overview) {
    sections.push(`\nIndustry Overview:\n${report.industry_overview}`);
  }
  if (report.industry_tailwinds) {
    sections.push(`\nIndustry Tailwinds:\n${report.industry_tailwinds}`);
  }
  if (report.demand_drivers) {
    sections.push(`\nDemand Drivers:\n${report.demand_drivers}`);
  }
  if (report.industry_risks) {
    sections.push(`\nIndustry Risks:\n${report.industry_risks}`);
  }

  return sections.join('\n');
}
