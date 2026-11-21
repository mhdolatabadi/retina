/** Aggregate measured token usage; missing values are never silently treated as zero. */
const dimensions = {
  issue: 'issueKey', task: 'issueKey', taskType: 'taskType', storyPoints: 'storyPoints',
  stage: 'stage', role: 'agentId', agent: 'agentId', model: 'model',
  orchestrator: 'orchestratorId', status: 'status', risk: 'risk'
};
const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const rounded = value => value === null || !Number.isFinite(value) ? null : Number(value.toFixed(2));
const keyOf = (row, group) => String(row[dimensions[group]] ?? 'UNKNOWN');
const timeOf = value => { const time = Date.parse(value); return Number.isFinite(time) ? time : null; };

export function usageMetrics(entries) {
  const count = entries.length;
  const known = key => entries.filter(row => numeric(row[key]) !== null).length;
  const sum = key => entries.reduce((total, row) => total + (numeric(row[key]) ?? 0), 0);
  const missing = entries.filter(row => numeric(row.inputTokens) === null || numeric(row.outputTokens) === null).length;
  const input = sum('inputTokens'), output = sum('outputTokens');
  const windows = entries.map(row => {
    const start = timeOf(row.startedAt), duration = numeric(row.durationMs);
    return start === null || duration === null ? null : { start, end: start + duration };
  }).filter(Boolean);
  const activeMs = sum('durationMs');
  const wallMs = windows.length ? Math.max(...windows.map(w => w.end)) - Math.min(...windows.map(w => w.start)) : null;
  const generation = entries.filter(row => numeric(row.generationDurationMs) > 0 && numeric(row.outputTokens) !== null);
  const genMs = generation.reduce((sum, row) => sum + row.generationDurationMs, 0);
  const fullyTimed = count > 0 && known('durationMs') === count;
  const fullyMeasured = count > 0 && missing === 0;
  return {
    invocations: count,
    tokenCounts: {
      input: known('inputTokens') ? input : null,
      output: known('outputTokens') ? output : null,
      total: fullyMeasured ? input + output : null,
      cached: known('cachedTokens') ? sum('cachedTokens') : null,
      reasoning: known('reasoningTokens') ? sum('reasoningTokens') : null
    },
    completeness: { fullyMeasured: count - missing, missingTokenMeasurements: missing },
    duration: { activeInvocationMs: known('durationMs') ? activeMs : null, wallElapsedMs: wallMs, measuredInvocations: windows.length },
    rates: {
      totalTokensPerActiveMinute: fullyMeasured && fullyTimed && activeMs > 0 ? rounded((input + output) * 60000 / activeMs) : null,
      outputTokensPerActiveSecond: fullyMeasured && fullyTimed && activeMs > 0 ? rounded(output * 1000 / activeMs) : null,
      totalTokensPerWallMinute: fullyMeasured && windows.length === count && wallMs > 0 ? rounded((input + output) * 60000 / wallMs) : null,
      outputTokensPerGenerationSecond: generation.length === count && genMs > 0
        ? rounded(generation.reduce((total, row) => total + row.outputTokens, 0) * 1000 / genMs) : null
    },
    timing: {
      timeToFirstTokenMsMean: known('timeToFirstTokenMs') ? rounded(sum('timeToFirstTokenMs') / known('timeToFirstTokenMs')) : null,
      ttftObservations: known('timeToFirstTokenMs'),
      generationTimingObservations: generation.length
    }
  };
}

export function usageReport(entries, { groupBy = 'taskType', filters = {} } = {}) {
  if (!Object.hasOwn(dimensions, groupBy)) throw new Error('Unsupported grouping dimension: ' + groupBy);
  for (const key of Object.keys(filters)) if (!Object.hasOwn(dimensions, key)) throw new Error('Unsupported filter dimension: ' + key);
  const selected = entries.filter(row => Object.entries(filters).every(([name, value]) => keyOf(row, name) === String(value)));
  const groups = new Map();
  for (const row of selected) {
    const key = keyOf(row, groupBy);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return {
    groupBy, filters, overall: usageMetrics(selected),
    groups: [...groups].map(([value, items]) => ({ value, ...usageMetrics(items) })).sort((a, b) => a.value.localeCompare(b.value))
  };
}

export function taskTypeReport(entries, tasks = []) {
  const metadata = new Map(tasks.filter(t => t.issueKey).map(t => [t.issueKey, t]));
  const byIssue = new Map();
  for (const entry of entries) {
    if (!entry.issueKey) continue;
    if (!byIssue.has(entry.issueKey)) byIssue.set(entry.issueKey, []);
    byIssue.get(entry.issueKey).push(entry);
  }
  const summaries = [...byIssue].map(([issueKey, observations]) => {
    const task = metadata.get(issueKey) ?? {};
    const metrics = usageMetrics(observations);
    const storyPoints = numeric(task.storyPoints ?? observations.find(e => e.storyPoints !== undefined)?.storyPoints);
    return {
      issueKey,
      taskType: task.taskType ?? observations.find(e => e.taskType)?.taskType ?? 'UNKNOWN',
      storyPoints,
      taskStatus: task.state ?? 'UNKNOWN',
      metrics,
      tokensPerStoryPoint: storyPoints > 0 && metrics.tokenCounts.total !== null
        ? rounded(metrics.tokenCounts.total / storyPoints) : null
    };
  }).sort((a, b) => a.issueKey.localeCompare(b.issueKey));
  const types = new Map();
  for (const row of summaries) {
    if (!types.has(row.taskType)) types.set(row.taskType, []);
    types.get(row.taskType).push(row);
  }
  const byTaskType = [...types].map(([taskType, rows]) => {
    const measured = rows.filter(row => row.metrics.tokenCounts.total !== null);
    const points = measured.filter(row => row.storyPoints > 0);
    const allUsage = entries.filter(entry => rows.some(row => row.issueKey === entry.issueKey));
    const total = measured.reduce((sum, row) => sum + row.metrics.tokenCounts.total, 0);
    const totalSp = points.reduce((sum, row) => sum + row.storyPoints, 0);
    const rates = usageMetrics(allUsage).rates;
    return {
      taskType,
      taskCount: rows.length,
      fullyMeasuredTasks: measured.length,
      totalReportedTokens: total,
      averageTokensPerMeasuredTask: measured.length ? rounded(total / measured.length) : null,
      averageTokensPerStoryPoint: totalSp ? rounded(points.reduce((sum, row) => sum + row.metrics.tokenCounts.total, 0) / totalSp) : null,
      rates: {
        totalTokensPerActiveMinute: rates.totalTokensPerActiveMinute,
        outputTokensPerActiveSecond: rates.outputTokensPerActiveSecond
      }
    };
  }).sort((a, b) => a.taskType.localeCompare(b.taskType));
  return { tasks: summaries, byTaskType };
}
