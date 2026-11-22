import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const rounded = v => Math.round(v * 1e8) / 1e8;

export function validateHormouzPrices(snapshot) {
  if (!snapshot || snapshot.unit !== 'USD_PER_MILLION_TOKENS' ||
      !snapshot.models || typeof snapshot.models !== 'object' || Array.isArray(snapshot.models)) {
    throw new Error('Invalid Hormouz tariff snapshot');
  }
  for (const [name, entry] of Object.entries(snapshot.models)) {
    if (!name.includes('/') || number(entry?.input) === null || number(entry?.output) === null ||
        !entry?.source?.startsWith('https://hormouz.net/') && !entry?.source?.startsWith('https://api.hormouz.net/')) {
      throw new Error('Invalid Hormouz tariff for model: ' + name);
    }
    for (const field of ['cacheRead','cacheWrite']) {
      if (entry[field] !== undefined && number(entry[field]) === null) throw new Error('Invalid ' + field + ' tariff');
    }
  }
  return snapshot;
}

export function readHormouzPrices(root) {
  const override = path.join(root, '.retina', 'hormouz-prices.json');
  const source = existsSync(override) ? override : path.join(root,'pricing','hormouz.json');
  return validateHormouzPrices(JSON.parse(readFileSync(source,'utf8')));
}

/**
 * Strict tariff calculation, never a claim that Hormouz settled this amount.
 * Missing cache tariffs or missing billing counters leave cost unavailable.
 */
export function calculateHormouzTariff(step, snapshot) {
  const model = step.upstreamModel;
  const tariff = snapshot.models[model];
  if (!tariff) return {usd:null,source:'UNPRICED',reason:'UNKNOWN_MODEL',model};
  const fields = ['inputTokens','outputTokens','reasoningTokens','cacheReadTokens','cacheWriteTokens'];
  const t = Object.fromEntries(fields.map(k => [k, number(step[k])]));
  if (fields.some(k => t[k] === null)) return {usd:null,source:'UNPRICED',reason:'MISSING_USAGE',model};
  if (t.cacheReadTokens > 0 && number(tariff.cacheRead) === null ||
      t.cacheWriteTokens > 0 && number(tariff.cacheWrite) === null) {
    return {usd:null,source:'UNPRICED',reason:'CACHE_RATE_UNAVAILABLE',model};
  }
  const usd = (t.inputTokens * tariff.input +
      (t.outputTokens + t.reasoningTokens) * tariff.output +
      t.cacheReadTokens * (tariff.cacheRead ?? 0) +
      t.cacheWriteTokens * (tariff.cacheWrite ?? 0)) / 1e6;
  return {
    usd: rounded(usd), source:'HORMOUZ_PUBLISHED_TARIFF', reason:null, model,
    rateSource:tariff.source, observedCatalogDate:snapshot.retrievedAt
  };
}
