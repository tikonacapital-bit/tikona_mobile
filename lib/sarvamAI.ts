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
  tokens_used?: number;
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
    if (res.status === 402) {
      throw new Error('402_INSUFFICIENT_CREDITS');
    }
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
export function buildReportContext(
  report: Record<string, any>,
  equityData?: Record<string, any> | null
): string {
  const sections: string[] = [];

  sections.push(`Company: ${report.company_name || 'N/A'}`);
  sections.push(`NSE Symbol: ${report.nse_symbol || 'N/A'}`);

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

  // 1. Add Summary Table if available
  if (report.summary_table) {
    sections.push(`\nFinancial Summary Table:\n${report.summary_table}`);
  }

  // 2. Scan and add any dynamic custom sections (keys starting with cs_)
  Object.keys(report).forEach((key) => {
    if (key.startsWith('cs_') && report[key]) {
      // Convert key name from cs_valuation_analysis to Valuation Analysis
      const friendlyName = key
        .slice(3)
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      sections.push(`\n${friendlyName}:\n${report[key]}`);
    }
  });

  // 3. Add Key Financial Metrics from Equity Universe
  if (equityData) {
    sections.push(`\n--- KEY FINANCIAL METRICS & VALUATION DATA ---`);
    const metricsMap: Record<string, string> = {
      market_cap: 'Market Capitalization (Cr)',
      current_price: 'Current Price (₹)',
      high_52_week: '52-Week High (₹)',
      low_52_week: '52-Week Low (₹)',
      pe_ttm: 'PE Ratio (TTM)',
      ev_ebitda_ttm: 'EV/EBITDA (TTM)',
      roe: 'ROE (%)',
      roce: 'ROCE (%)',
      debt: 'Total Debt (Cr)',
      cash_equivalents: 'Cash & Equivalents (Cr)',
      net_debt: 'Net Debt (Cr)',
      net_worth: 'Net Worth (Cr)',
      book_value: 'Book Value (₹)',
      promoter_holding_pct: 'Promoter Holding (%)',
      sales_growth_yoy_qtr: 'YoY Quarterly Sales Growth (%)',
      profit_growth_yoy_qtr: 'YoY Quarterly Profit Growth (%)',
      revenue_cagr_hist_2yr: '2-Year Historical Revenue CAGR (%)',
      revenue_cagr_fwd_2yr: '2-Year Forward Revenue CAGR (%)',
      pat_cagr_hist_2yr: '2-Year Historical PAT CAGR (%)',
      pat_cagr_fwd_2yr: '2-Year Forward PAT CAGR (%)',
    };

    Object.entries(metricsMap).forEach(([field, label]) => {
      if (equityData[field] !== undefined && equityData[field] !== null) {
        sections.push(`${label}: ${equityData[field]}`);
      }
    });
  }

  return sections.join('\n');
}

