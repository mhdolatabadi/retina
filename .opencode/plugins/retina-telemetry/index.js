import { Plugin } from '@opencode/plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendTelemetry } from '../../../src/telemetry-store.js';
import { normalizeOpenCodeEvent } from '../../../src/opencode-event-adapter.js';
import { activeRetinaRuns, createRetinaEventGate } from '../../../src/retina-scope.js';

// Scoped OpenCode v2 plugin: never collect unrelated OpenCode sessions.
export default Plugin.define({
  id: 'retina.telemetry',
  setup(ctx) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const runId = process.env.RETINA_RUN_ID;
    const workspace = process.env.RETINA_TELEMETRY_WORKSPACE;
    const gate = createRetinaEventGate({runId, workspace, registeredRuns:activeRetinaRuns(root)});
    if (gate.reason) return () => {};
    const filename = path.join(root, '.retina', 'telemetry', 'events.ndjson');
    const controller = new AbortController();
    const task = {};
    for (const [env,key] of [
      ['RETINA_ISSUE_KEY','issueKey'],['RETINA_TASK_TYPE','taskType'],
      ['RETINA_RISK','risk'],['RETINA_ORCHESTRATOR_ID','orchestratorId']
    ]) if (process.env[env]) task[key] = process.env[env].slice(0,200);
    const points = Number(process.env.RETINA_STORY_POINTS);
    if (process.env.RETINA_STORY_POINTS && Number.isFinite(points) && points>=0) task.storyPoints=points;
    void (async()=>{
      try {
        for await (const event of ctx.event.subscribe({
          types:['session.step.started','session.step.first-token','session.step.streamed',
            'session.step.ended','session.step.failed'],
          signal:controller.signal
        })) {
          if (!gate.admit(event)) continue;
          const row = normalizeOpenCodeEvent(event);
          if (!row) continue;
          row.retinaRunId = runId;
          if (row.kind==='started' && task.issueKey) row.task=task;
          try { appendTelemetry(filename,row); }
          catch(error) {console.error('[retina.telemetry] Local persistence failed:',error.message);}
        }
      } catch(error) {
        if (!controller.signal.aborted) console.error('[retina.telemetry] Event stream interrupted:',error.message);
      }
    })();
    return ()=>controller.abort();
  }
});
