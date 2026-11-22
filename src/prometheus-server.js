import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { eventsFile, bindingsFile, readBindings, readTelemetry } from './telemetry-store.js';
import { activeRetinaRuns, onlyRetinaEvents } from './retina-scope.js';
import { readHormouzPrices } from './hormouz-pricing.js';
import { prometheusText } from './prometheus-export.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function modelCatalog(rootDir) {
  let config;
  try {config=JSON.parse(readFileSync(path.join(rootDir,'.retina','opencode.runtime.json'),'utf8'));}
  catch {config=JSON.parse(readFileSync(path.join(rootDir,'opencode.json'),'utf8'));}
  return Object.fromEntries(Object.entries(config.providers?.hormoz?.models||{}).map(([id,value])=>[id,value.modelID]));
}
export function createPrometheusServer({projectRoot=root}={}) {
  return http.createServer((req,res)=>{
    if(req.url!=='/metrics' || req.method!=='GET') {
      res.writeHead(404);res.end('Not found');return;
    }
    try {
      const records=onlyRetinaEvents(readTelemetry(eventsFile(projectRoot)),activeRetinaRuns(projectRoot));
      const out=prometheusText(records,readBindings(bindingsFile(projectRoot)),
        modelCatalog(projectRoot),readHormouzPrices(projectRoot));
      res.writeHead(200,{'Content-Type':'text/plain; version=0.0.4; charset=utf-8','Cache-Control':'no-store'});
      res.end(out);
    } catch(err) {
      console.error('Retina metrics export:',err.message);
      res.writeHead(503);res.end('Telemetry unavailable');
    }
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.RETINA_METRICS_PORT||9401);
  if(!Number.isInteger(port)||port<1||port>65535) throw Error('Invalid metrics port');
  createPrometheusServer().listen(port,'0.0.0.0',()=>{
    console.log('Retina metrics on internal container port '+port);
  });
}
