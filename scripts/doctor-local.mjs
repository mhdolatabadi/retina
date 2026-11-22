import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
let valid = true;
for (const key of ['HORMOZ_API_KEY','HORMOZ_BASE_URL','HORMOZ_MODEL_ID']) {
  const present = Boolean(process.env[key]?.trim());
  console.log(key + ': ' + (present ? 'configured' : 'MISSING'));
  valid &&= present;
}
try {
 const u = new URL(process.env.HORMOZ_BASE_URL);
 if (u.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(u.hostname)) throw Error('HTTPS required');
} catch(e) { console.error('Base URL invalid or missing:', e.message); valid=false; }
for (const cmd of ['node','opencode']) {
 const r=spawnSync(cmd,['--version'],{encoding:'utf8'});
 const found=!r.error && r.status===0;
 console.log(cmd + ': '+(found?'installed':'MISSING'));
 valid &&=found;
}
try{JSON.parse(readFileSync('opencode.json','utf8'));}catch(e){console.error('Invalid opencode.json',e.message);valid=false;}
if(valid) console.log('Local configuration looks valid. Live provider connectivity is NOT verified.');
process.exitCode=valid?0:1;
