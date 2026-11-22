import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventsFile, bindingsFile, readBindings, readTelemetry } from './telemetry-store.js';
import { allowedGroups, dashboardReport } from './live-telemetry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticFiles = {
  '/':'public/dashboard.html',
  '/dashboard.js':'public/dashboard.js',
  '/dashboard.css':'public/dashboard.css'
};
const types = { '/':'text/html; charset=utf-8','/dashboard.js':'text/javascript; charset=utf-8','/dashboard.css':'text/css; charset=utf-8' };

function modelCatalog(project) {
  let config;
  try { config = JSON.parse(readFileSync(path.join(project,'.retina','opencode.runtime.json'),'utf8')); }
  catch { config = JSON.parse(readFileSync(path.join(root,'opencode.json'),'utf8')); }
  return Object.fromEntries(Object.entries(config.providers?.hormoz?.models ?? {}).map(([id,value])=>[id,value.modelID]));
}

export function createDashboardServer({ projectRoot = root, port = 4318 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid dashboard port');
  return http.createServer((req,res) => {
    const host = req.headers.host;
    const allowed = new Set(['127.0.0.1:'+port,'localhost:'+port,'[::1]:'+port]);
    // Port 0 is allowed for integration tests only.
    if (port===0) allowed.add('127.0.0.1:'+req.socket.localPort);
    if (!allowed.has(host) || (req.headers.origin && !['http://'+host].includes(req.headers.origin))) {
      res.writeHead(403);res.end('Forbidden');return;
    }
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'");
    try {
      const u = new URL(req.url, 'http://localhost');
      if (req.method!=='GET') { res.writeHead(405);res.end('Method Not Allowed');return; }
      if (u.pathname==='/api/report') {
        const groupBy = u.searchParams.get('groupBy') || 'taskType';
        if (!allowedGroups.includes(groupBy)) {res.writeHead(400);res.end('Invalid groupBy');return;}
        const filters={};
        for(const key of allowedGroups) {
          const value=u.searchParams.get(key);
          if(value) filters[key]=value.slice(0,200);
        }
        for(const key of ['since','until']) {
          const value=u.searchParams.get(key);
          if(value) filters[key]=value;
        }
        const report=dashboardReport(
          readTelemetry(eventsFile(projectRoot)),
          readBindings(bindingsFile(projectRoot)),
          modelCatalog(projectRoot),
          {groupBy,filters}
        );
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
        res.end(JSON.stringify(report));
        return;
      }
      if (Object.hasOwn(staticFiles,u.pathname)) {
        const file=path.join(root,staticFiles[u.pathname]);
        res.writeHead(200,{'Content-Type':types[u.pathname]});
        res.end(readFileSync(file));
        return;
      }
      res.writeHead(404);res.end('Not found');
    } catch (error) {
      console.error('Retina dashboard:',error.message);
      res.writeHead(500,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'Dashboard data unavailable; check local telemetry files.'}));
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.RETINA_DASHBOARD_PORT || 4318);
  const server=createDashboardServer({port});
  server.listen(port,'127.0.0.1',()=>{
    console.log('Retina observability: http://127.0.0.1:'+port);
    console.log('Local only. No API keys or prompts are collected.');
  });
}
