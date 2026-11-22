// OpenCode v2 durable step events only. Never store prompts, outputs, tool arguments or credentials.
const supported = new Set([
  'session.step.started', 'session.step.first-token', 'session.step.streamed',
  'session.step.ended', 'session.step.failed'
]);
const nonNegative = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
const safeId = v => typeof v === 'string' && v.length <= 200 ? v : null;
const asTime = (v, fallback) => nonNegative(v) !== null ? new Date(v).toISOString() : new Date(fallback).toISOString();

export function normalizeOpenCodeEvent(event, observedAt = Date.now()) {
  if (!event || !supported.has(event.type)) return null;
  const data = event.data;
  if (!data || !safeId(data.sessionID) || !safeId(data.assistantMessageID)) return null;
  const row = {
    kind: event.type.slice('session.step.'.length),
    sessionID: data.sessionID,
    messageID: data.assistantMessageID,
    observedAt: asTime(observedAt, Date.now())
  };
  if (row.kind === 'started') {
    row.startedAt = asTime(data.started, observedAt);
    row.agentId = safeId(data.agent);
    row.model = safeId(data.model?.id);
    row.provider = safeId(data.model?.providerID);
  }
  if (row.kind === 'ended' || row.kind === 'failed') {
    const t = data.tokens;
    row.inputTokens = nonNegative(t?.input);
    row.outputTokens = nonNegative(t?.output);
    row.reasoningTokens = nonNegative(t?.reasoning);
    row.cacheReadTokens = nonNegative(t?.cache?.read);
    row.cacheWriteTokens = nonNegative(t?.cache?.write);
    row.cost = nonNegative(data.cost);
    row.status = row.kind === 'ended' ? 'SUCCESS' : 'FAILED';
  }
  return row;
}
