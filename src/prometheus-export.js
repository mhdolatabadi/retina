import { stepsFromEvents } from './live-telemetry.js';

const valid = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const escape = v => String(v).replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll('"','\\"');
const roleNames = new Set(['discovery','project-manager','orchestrator','coder','reviewer-1','reviewer-2']);
const categories = {
  input:'inputTokens', output:'outputTokens', reasoning:'reasoningTokens',
  cache_read:'cacheReadTokens', cache_write:'cacheWriteTokens'
};
const help = {
  retina_tokens_total:'Measured scoped Retina token categories',
  retina_model_requests_total:'Scoped Retina model requests by observed status',
  retina_hormouz_tariff_usd_total:'Official Hormouz tariff calculation, not a settled invoice',
  retina_unpriced_requests_total:'Requests lacking tariff information or complete usage',
  retina_model_active_seconds_total:'Model step elapsed time',
  retina_generation_seconds_total:'Observed model stream generation duration',
  retina_first_token_seconds_total:'Time until first generated token',
  retina_first_token_observations_total:'Requests with observed first-token timestamps'
};
export function prometheusText(events, bindings = {}, models = {}, prices = null) {
  const rows=stepsFromEvents(events,bindings,models,prices);
  const metrics=new Map();
  function add(name,labels,value) {
    if(!valid(value)) return;
    const id=name+'|'+JSON.stringify(labels);
    const old=metrics.get(id);
    if(old) old.value+=value;
    else metrics.set(id,{name,labels,value});
  }
  for(const s of rows) {
    if(s.status==='RUNNING') continue;
    const labels={
      role:roleNames.has(s.role)?s.role:'unknown',
      model:s.upstreamModel||'UNKNOWN',
      task_type:s.taskType||'UNATTRIBUTED',
      issue:s.issueKey||'UNATTRIBUTED'
    };
    add('retina_model_requests_total',{...labels,status:s.status},1);
    if(Object.values(categories).every(k=>valid(s[k]))) {
      for(const [kind,key] of Object.entries(categories))
        add('retina_tokens_total',{...labels,kind},s[key]);
    }
    if(valid(s.tariff?.usd)) {
      add('retina_hormouz_tariff_usd_total',labels,s.tariff.usd);
    } else {
      add('retina_unpriced_requests_total',{...labels,reason:s.tariff?.reason||'UNPRICED'},1);
    }
    const start=Date.parse(s.startedAt), end=Date.parse(s.endedAt);
    if(Number.isFinite(start) && Number.isFinite(end) && end>=start) {
      add('retina_model_active_seconds_total',labels,(end-start)/1000);
      const first=Date.parse(s.firstTokenAt), streamed=Date.parse(s.streamedAt);
      if(Number.isFinite(first) && first>=start) {
        add('retina_first_token_seconds_total',labels,(first-start)/1000);
        add('retina_first_token_observations_total',labels,1);
        if(Number.isFinite(streamed) && streamed>first)
          add('retina_generation_seconds_total',labels,(streamed-first)/1000);
      }
    }
  }
  const lines=[];
  for(const [name,description] of Object.entries(help)) {
    lines.push('# HELP '+name+' '+description,'# TYPE '+name+' counter');
    for(const e of metrics.values()) if(e.name===name)
      lines.push(name+'{'+Object.entries(e.labels).map(([k,v])=>k+'="'+escape(v)+'"').join(',')+'} '+Number(e.value.toFixed(9)));
  }
  return lines.join('\n')+'\n';
}
