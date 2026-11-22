import { Plugin } from '@opencode/plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendTelemetry } from '../../../src/telemetry-store.js';
import { normalizeOpenCodeEvent } from '../../../src/opencode-event-adapter.js';

// Local-only OpenCode v2 server plugin. Writes numeric step usage; never transcripts.
export default Plugin.define({
  id: 'retina.telemetry',
  setup(ctx) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const dir = process.env.RETINA_DATA_DIR || path.join(root, '.retina');
    const filename = path.join(dir, 'telemetry', 'events.ndjson');
    const controller = new AbortController();
    const task = {};
    for (const [env,key] of [
      ['RETINA_ISSUE_KEY','issueKey'],['RETINA_TASK_TYPE','taskType'],
      ['RETINA_RISK','risk'],['RETINA_ORCHESTRATOR_ID','orchestratorId']
    ]) if (process.env[env]) task[key] = process.env[env].slice(0,200);
    const points = Number(process.env.RETINA_STORY_POINTS);
    if (process.env.RETINA_STORY_POINTS && Number.isFinite(points) && points >= 0) task.storyPoints = points;
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          types:[
            'session.step.started','session.step.first-token',
            'session.step.streamed','session.step.ended','session.step.failed'
          ],
          signal:controller.signal
        })) {
          const row = normalizeOpenCodeEvent(event);
          if (!row) continue;
          if (row.kind === 'started' && task.issueKey) row.task = task;
          try {
            appendTelemetry(filename,row);
          } catch (error) {
            console.error('[retina.telemetry] Could not persist local token event:',error.message);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error('[retina.telemetry] OpenCode events interrupted:',error.message);
      }
    })();
    return () => controller.abort();
  }
});
