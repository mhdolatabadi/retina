import { calculateHormouzTariff } from './hormouz-pricing.js';
const num = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const ts = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null;
const round = v => v === null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100;
const keys = ['inputTokens','outputTokens','reasoningTokens','cacheReadTokens','cacheWriteTokens'];
const field = {
  issue: 'issueKey', taskType: 'taskType', stage: 'stage', agent: 'agentId', role: 'role',
  model: 'upstreamModel', orchestrator: 'orchestratorId', risk: 'risk', status: 'status'
};
export const allowedGroups = Object.keys(field);

function enrich(step, bindings, models, pricing) {
  const bound = bindings[step.sessionID] ?? {};
  const meta = step.task ?? {};
  const attrs = { ...meta, ...bound };
  const alias = step.provider && step.model ? step.provider + '/' + step.model : 'UNKNOWN';
  const output = {
    ...step, ...attrs,
    role: step.agentId || 'UNKNOWN',
    issueKey: attrs.issueKey || 'UNATTRIBUTED',
    taskType: attrs.taskType || 'UNATTRIBUTED',
    stage: step.stage || step.agentId || 'UNKNOWN',
    orchestratorId: attrs.orchestratorId || 'UNKNOWN',
    risk: attrs.risk || 'UNKNOWN',
    upstreamModel: models[step.model] || alias
  };
  output.tariff = pricing ? calculateHormouzTariff(output, pricing) : null;
  return output;
}

export function stepsFromEvents(events, bindings = {}, models = {}, pricing = null) {
  const map = new Map();
  for (const event of events) {
    if (!event || !event.sessionID || !event.messageID) continue;
    const id = (event.retinaRunId || 'legacy') + '|' + event.sessionID + '|' + event.messageID;
    if (!map.has(id)) map.set(id, { retinaRunId:event.retinaRunId || null, sessionID: event.sessionID, messageID: event.messageID, status: 'RUNNING' });
    const step = map.get(id);
    switch (event.kind) {
      case 'started':
        step.startedAt = event.startedAt;
        step.agentId = event.agentId || 'UNKNOWN';
        step.model = event.model || 'UNKNOWN';
        step.provider = event.provider || 'UNKNOWN';
        step.task = event.task || step.task;
        break;
      case 'first-token':
        if (!step.firstTokenAt) step.firstTokenAt = event.observedAt;
        break;
      case 'streamed':
        if (!step.streamedAt) step.streamedAt = event.observedAt;
        break;
      case 'ended':
      case 'failed':
        // Repeat/replay of the same terminal event must not double count it.
        if (step.status !== 'RUNNING') break;
        for (const key of keys) step[key] = num(event[key]);
        step.cost = num(event.cost);
        step.endedAt = event.observedAt;
        step.status = event.kind === 'ended' ? 'SUCCESS' : 'FAILED';
        break;
    }
  }
  return [...map.values()].map(step => enrich(step, bindings, models, pricing));
}

function summary(rows) {
  const done = rows.filter(s => s.status !== 'RUNNING');
  const complete = done.filter(s => keys.every(k => num(s[k]) !== null));
  const counts = Object.fromEntries(keys.map(k => [k, null]));
  if (complete.length) {
    for (const key of keys) counts[key] = complete.reduce((acc,s) => acc + s[key], 0);
  }
  // OpenCode v2 token categories are disjoint: input, visible output, reasoning, cache read/write.
  const total = complete.length
    ? complete.reduce((acc,s) => acc + keys.reduce((sum,k) => sum + s[k], 0), 0)
    : null;
  const durations = complete.map(s => [ts(s.startedAt), ts(s.endedAt)]);
  const completeTimes = durations.filter(([a,b]) => a !== null && b !== null && b > a);
  const activeMs = completeTimes.length ? completeTimes.reduce((sum,[a,b]) => sum + b - a, 0) : null;
  const wallMs = completeTimes.length ? Math.max(...completeTimes.map(a=>a[1])) - Math.min(...completeTimes.map(a=>a[0])) : null;
  const generation = complete.filter(s => ts(s.firstTokenAt) !== null && ts(s.streamedAt) > ts(s.firstTokenAt));
  const genMs = generation.reduce((sum,s)=>sum + ts(s.streamedAt) - ts(s.firstTokenAt),0);
  const generating = generation.reduce((sum,s) => sum + s.outputTokens + s.reasoningTokens,0);
  const ttft = complete.map(s => ts(s.firstTokenAt) !== null && ts(s.startedAt) !== null
    ? ts(s.firstTokenAt) - ts(s.startedAt) : null).filter(t => t !== null && t >= 0);
  const priced = done.filter(s => num(s.tariff?.usd) !== null);
  const reported = done.filter(s => num(s.cost) !== null);
  const uniqueIssues = new Set(rows.map(s=>s.issueKey).filter(k=>k!=='UNATTRIBUTED'));
  const tasksWithComplete = new Set(complete.map(s=>s.issueKey).filter(k=>k!=='UNATTRIBUTED'));
  return {
    requests: rows.length, completed: complete.length, failed: done.filter(s=>s.status==='FAILED').length,
    running: rows.filter(s=>s.status==='RUNNING').length, missingUsage: done.length - complete.length,
    uniqueTasks: uniqueIssues.size, tokens: {...counts,total},
    costUSD: done.length && priced.length===done.length ? Math.round(priced.reduce((a,s)=>a+s.tariff.usd,0)*1e8)/1e8 : null,
    tariffPricedRequests: priced.length,
    tariffUnpricedRequests: done.length-priced.length,
    billingVerifiedUSD: null,
    opencodeReportedUSD: reported.length===done.length && done.length ? Math.round(reported.reduce((a,s)=>a+s.cost,0)*1e8)/1e8 : null,
    activeMs,
    wallMs,
    tokensPerActiveMinute: total !== null && complete.length===done.length && completeTimes.length===complete.length && activeMs > 0
      ? round(total * 60000/activeMs) : null,
    tokensPerWallMinute: total !== null && complete.length===done.length && completeTimes.length===complete.length && wallMs > 0
      ? round(total * 60000/wallMs) : null,
    generationTokensPerSecond: generation.length === complete.length && genMs > 0
      ? round(generating * 1000/genMs) : null,
    ttftMeanMs: ttft.length ? round(ttft.reduce((a,b)=>a+b,0)/ttft.length) : null,
    averageTokensPerMeasuredTask: tasksWithComplete.size && total !== null
      ? round(complete.filter(s=>s.issueKey!=='UNATTRIBUTED').reduce((sum,s)=>sum+keys.reduce((a,k)=>a+s[k],0),0)/tasksWithComplete.size)
      : null
  };
}

function keep(s, filters) {
  for (const [name, value] of Object.entries(filters)) {
    if (!value) continue;
    if (name === 'since' && (!ts(s.startedAt) || ts(s.startedAt) < ts(value))) return false;
    else if (name === 'until' && (!ts(s.startedAt) || ts(s.startedAt) > ts(value))) return false;
    else if (field[name] && String(s[field[name]]) !== value) return false;
  }
  return true;
}
export function dashboardReport(events, bindings = {}, models = {}, opts = {}) {
  const groupBy = opts.groupBy || 'taskType';
  if (!allowedGroups.includes(groupBy)) throw Error('Invalid grouping dimension');
  const filters = opts.filters || {};
  for (const name of Object.keys(filters)) if (!field[name] && name!=='since' && name!=='until') throw Error('Invalid filter');
  const all = stepsFromEvents(events, bindings, models, opts.pricing || null);
  const rows = all.filter(s=>keep(s,filters));
  const groups = new Map();
  for(const row of rows) {
    const key = String(row[field[groupBy]] || 'UNKNOWN');
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(row);
  }
  const trend = new Map();
  for(const row of rows) {
    if(row.status==='RUNNING' || keys.some(k=>num(row[k])===null) || !ts(row.endedAt)) continue;
    const hour = row.endedAt.slice(0,13)+':00';
    trend.set(hour, (trend.get(hour)||0) + keys.reduce((a,k)=>a+row[k],0));
  }
  const sessions = new Map();
  for(const row of rows) {
    const s = sessions.get(row.sessionID) || {sessionID:row.sessionID,issueKey:row.issueKey,taskType:row.taskType,requests:0,lastSeen:null};
    s.requests++; s.lastSeen = [s.lastSeen,row.endedAt||row.startedAt].filter(Boolean).sort().at(-1)||null;
    sessions.set(row.sessionID,s);
  }
  return {
    updatedAt:new Date().toISOString(), groupBy, filters,
    overview:summary(rows),
    groups:[...groups].map(([name,items])=>({name,...summary(items)})).sort((a,b)=>(b.tokens.total??0)-(a.tokens.total??0)),
    trend:[...trend].sort(([a],[b])=>a.localeCompare(b)).slice(-72).map(([time,tokens])=>({time,tokens})),
    sessions:[...sessions.values()].sort((a,b)=>(b.lastSeen||'').localeCompare(a.lastSeen||'')).slice(0,100),
    note:'Scoped OpenCode v2 usage. Cost is calculated from the published Hormouz tariff and is not a settled invoice.'
  };
}
