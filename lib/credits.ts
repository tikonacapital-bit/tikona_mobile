// Helpers for showing AI credits as ₹-equivalent numbers.
// Internally the backend stores token balances, roughly 502 tokens per ₹1.
export const TOKENS_PER_DISPLAY_CREDIT = 502;

export const toDisplayCredits = (tokens: number) =>
  Math.round(tokens / TOKENS_PER_DISPLAY_CREDIT);

export const formatDisplayCredits = (dc: number) =>
  dc >= 1000000 ? `${(dc / 1000000).toFixed(1)}M` :
  dc >= 1000 ? `${(dc / 1000).toFixed(1)}K` :
  `${dc}`;

export const formatTokensAsCredits = (tokens: number) =>
  formatDisplayCredits(toDisplayCredits(tokens));
