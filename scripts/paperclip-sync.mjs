#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RETINA_ROLES } from '../src/role-models.js';
import {
  roleDirectory, instructionPath, selectPaperclipAgents, unpackConfiguration,
  snapshotAgent, validateSnapshot, makeConfigPatch, isExternalBundle
} from '../src/paperclip-git-sync.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = args.find(x => !x.startsWith('-')) || 'status';
const flag = name => args.includes('--' + name);
const option = name => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : null;
};
const stateFile=path.join(root,'.retina','paperclip','git-sync.json');
const showHelp = () => {
  console.log('Retina <-> Paperclip Git sync (never exports credentials)');
  console.log('  npm run paperclip:sync -- status [--company-id ID]');
  console.log('  npm run paperclip:sync -- link --company-id ID --apply --prefer-retina');
  console.log('  npm run paperclip:sync -- link --company-id ID --apply --prefer-paperclip');
  console.log('  npm run paperclip:sync -- save [--company-id ID] [--publish]');
  console.log('  npm run paperclip:sync -- apply [--company-id ID] --apply');
  console.log('  --publish explicitly commits and pushes ONLY paperclip/agents to origin.');
  console.log('  Use a local Paperclip instance and an authenticated paperclipai CLI.');
};
const readJson = filename => JSON.parse(readFileSync(filename,'utf8'));
function readState() {
  if (!existsSync(stateFile)) return {version:1,companyId:null,roles:{}};
  const value=readJson(stateFile);
  if(value.version!==1 || !value.roles || typeof value.roles!=='object')throw new Error('Invalid local sync state');
  return value;
}
function saveState(state) {
  mkdirSync(path.dirname(stateFile),{recursive:true,mode:0o700});
  writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n',{mode:0o600});
}
function callCli(argv,{json=true}={}) {
  const executable=process.env.RETINA_PAPERCLIP_CLI || 'paperclipai';
  const result=spawnSync(executable,argv,{cwd:root,encoding:'utf8',shell:false,maxBuffer:8*1024*1024});
  if (result.error || result.status!==0) {
    throw new Error('Paperclip command failed: ' + argv.slice(0,3).join(' ') +
      '. Check paperclipai authentication, permissions and server availability.');
  }
  if (!json) return result.stdout;
  try { return JSON.parse(result.stdout); }
  catch { throw new Error('Unsupported Paperclip CLI JSON; refusing any write ('+argv.slice(0,2).join(' ')+')'); }
}
function git(argv) {
  try {return execFileSync('git',argv,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
  catch {throw new Error('Git command failed: git '+argv.join(' ') + '. Inspect your Git working tree.');}
}
function equal(a,b) {return JSON.stringify(a)===JSON.stringify(b);}
function settingsPath(role){return path.join(roleDirectory(root,role),'settings.json');}
function getBundle(id) {return callCli(['agent','instructions-bundle',id,'--json']);}
function getInstructions(id) {
  const raw=callCli(['agent','instructions-file:get',id,'--path','AGENTS.md','--json']);
  const candidates=[raw,raw?.file,raw?.result,raw?.result?.file,raw?.data,raw?.data?.file];
  const found=candidates.find(x=>x && typeof x.content==='string');
  if(!found)throw new Error('Missing AGENTS.md content in Paperclip managed bundle');
  return found.content;
}
function resolve(state, company) {
  if (!company) throw new Error('Missing company ID. First run: --company-id YOUR_COMPANY_ID');
  if (state.companyId && state.companyId!==company) {
    throw new Error('Local Paperclip sync is bound to a different company. Refusing to switch.');
  }
  const listed=callCli(['agent','list','--company-id',company,'--json']);
  const storedIds=Object.fromEntries(Object.entries(state.roles)
    .map(([role,value])=>[role,value.id]));
  return selectPaperclipAgents(listed,storedIds);
}
function configFor(agentId) {
  return unpackConfiguration(callCli(['agent','configuration',agentId,'--json']));
}
function safeInstructionText(role,text) {
  if (!text || !text.trim()) throw new Error('Empty AGENTS.md for '+role);
  if (Buffer.byteLength(text,'utf8')>1024*1024) throw new Error('AGENTS.md exceeds Paperclip limit');
  // Avoid inadvertently publishing common credential and redaction markers.
  if (/\*\*\*REDACTED\*\*\*|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}/i.test(text)) {
    throw new Error('Potential credential in AGENTS.md for '+role+'; do not commit it');
  }
}
function prepareManaged(id,role,action) {
  const expected=roleDirectory(root,role);
  const external=isExternalBundle(getBundle(id),expected);
  const current=readFileSync(instructionPath(root,role),'utf8');
  safeInstructionText(role,current);
  if(external) return {external:true};
  const remote=getInstructions(id);
  safeInstructionText(role,remote);
  if (remote!==current && !flag('prefer-retina') && !flag('prefer-paperclip')) {
    throw new Error(role+': managed instructions differ from Git. Use --prefer-retina or --prefer-paperclip explicitly.');
  }
  if(flag('prefer-retina')&&flag('prefer-paperclip'))throw new Error('Choose exactly one instruction source');
  // Pure preflight: no files change until all six agents have been checked.
  return {external:false,differs:remote!==current,remote};
}
function publish() {
  // Commit only the managed role tree; do not include other staged or untracked work.
  console.log('PUBLIC REPOSITORY WARNING: inspect all changes under paperclip/agents before publishing.');
  git(['add','-A','--','paperclip/agents']);
  const changed=git(['status','--porcelain','--','paperclip/agents']);
  if(!changed){
    console.log('No Paperclip agent file changes to publish.');
    return;
  }
  git(['commit','--only','-m','chore(paperclip): save Retina agent configuration and instructions','--','paperclip/agents']);
  git(['push','origin','HEAD']);
  console.log('Committed and pushed only paperclip/agents. No API credentials were exported.');
}
function main() {
  if(flag('help')||command==='help'){showHelp();return;}
  if(!['status','link','save','apply'].includes(command))throw new Error('Unknown action: '+command);
  if(flag('publish') && command!=='save')throw new Error('--publish is only supported on save');
  if(flag('prefer-retina') && flag('prefer-paperclip'))throw new Error('Choose only one instruction source');
  if((command==='link'||command==='apply')&&flag('publish'))throw new Error('Cannot publish during Paperclip changes');
  if(command==='apply' && !flag('apply')){
    throw new Error('Applying Git settings to Paperclip requires --apply');
  }
  const state=readState();
  const company=option('company-id') || state.companyId;
  const agents=resolve(state,company);
  const rows=[];
  // Preflight all six agents before ANY remote configuration or instructions update.
  for(const role of RETINA_ROLES){
    const agent=agents[role];
    const filename=instructionPath(root,role);
    if(!existsSync(filename))throw new Error('Missing Git instructions: '+filename);
    safeInstructionText(role,readFileSync(filename,'utf8'));
    const {config,revision}=configFor(agent.id);
    const live=snapshotAgent(role,config);
    const filenameSettings=settingsPath(role);
    const saved=existsSync(filenameSettings) ? validateSnapshot(readJson(filenameSettings)) : null;
    if(saved && saved.retinaRole!==role)throw new Error('Role mismatch in '+filenameSettings);
    const old=state.roles[role] || {};
    if(old.id && old.id!==agent.id)throw new Error(role+': Paperclip agent identity changed');
    rows.push({role,id:agent.id,live,revision,saved,old,filenameSettings});
  }
  if(command==='status'){
    for(const row of rows){
      const bundle=isExternalBundle(getBundle(row.id),roleDirectory(root,row.role));
      console.log(row.role+': '+row.live.adapterType+'/'+row.live.model+
        (bundle?' [linked Git instructions]':' [Paperclip managed instructions]')+
        (row.saved && !equal(row.live,row.saved)?' [settings drift]':''));
    }
    console.log('No changes made. Link once, save Paperclip edits, and publish only after review.');
    return;
  }
  if(command==='link'){
    const operations=[];
    for(const row of rows){
      const stateBundle=prepareManaged(row.id,row.role,'link');
      operations.push({row,...stateBundle});
      console.log(row.role + ': ' + (stateBundle.external?'already linked':'will link external Git instructions'));
    }
    if(!flag('apply')){
      console.log('DRY RUN. Add --apply and explicit --prefer-retina or --prefer-paperclip if files differ.');
      return;
    }
    for(const op of operations){
      if(!op.external){
        const backups=path.join(root,'.retina','paperclip','backups');
        mkdirSync(backups,{recursive:true,mode:0o700});
        writeFileSync(path.join(backups,op.row.role+'-before-link.md'),op.remote,{mode:0o600});
        if(op.differs && flag('prefer-paperclip')){
          writeFileSync(instructionPath(root,op.row.role),op.remote,{mode:0o600});
        }
        callCli(['agent','instructions-bundle:update',op.row.id,'--payload-json',
          JSON.stringify({mode:'external',rootPath:roleDirectory(root,op.row.role),
            entryFile:'AGENTS.md',requireExistingEntry:true})],{json:false});
        console.log('Linked '+op.row.role+' to Git-tracked AGENTS.md');
      }
    }
    for(const row of rows)state.roles[row.role]={...row.old,id:row.id};
    state.companyId=company;
    saveState(state);
    console.log('Now edits in Paperclip Identity update tracked local files. Use save --publish to commit & push.');
    return;
  }
  if(command==='save'){
    const operations=[];
    for(const row of rows){
      const source=prepareManaged(row.id,row.role,'save');
      if(!source.external && source.differs && !flag('prefer-paperclip')){
        throw new Error(row.role+': link external instructions first, or use save --prefer-paperclip to import managed content');
      }
      const baseline=row.old.baseline;
      const local=row.saved;
      if(local && !baseline && !equal(local,row.live) && !flag('overwrite-local')){
        throw new Error(row.role+': local settings are not known to be synced. Inspect them, then use --overwrite-local.');
      }
      if(local && baseline && !equal(local,baseline) &&
         !equal(row.live,baseline) && !equal(local,row.live)){
        throw new Error(row.role+': both Paperclip and Git changed settings. Resolve explicitly before saving.');
      }
      const preserveLocal=Boolean(local && baseline && !equal(local,baseline) && equal(row.live,baseline));
      operations.push({...row,preserveLocal,source});
    }
    for(const op of operations){
      if(op.source?.differs && flag('prefer-paperclip')) {
        writeFileSync(instructionPath(root,op.role),op.source.remote,{mode:0o600});
      }
      if(!op.preserveLocal)writeFileSync(op.filenameSettings,JSON.stringify(op.live,null,2)+'\n');
      state.roles[op.role]={id:op.id,baseline:op.live};
      console.log(op.role+': '+(op.preserveLocal?'kept unpushed local changes':'captured Paperclip settings'));
    }
    state.companyId=company;
    saveState(state);
    if(flag('publish'))publish();
    else console.log('Saved locally. Review git diff, then rerun save --publish to commit and push.');
    return;
  }
  if(command==='apply'){
    const changes=[];
    for(const row of rows){
      if(!row.saved)throw new Error(row.role+': no tracked settings.json; run save first');
      if(!row.old.baseline)throw new Error(row.role+': no sync baseline; run save first');
      if(!equal(row.live,row.old.baseline) && !equal(row.live,row.saved)){
        throw new Error(row.role+': remote Paperclip settings changed since last save; pull first');
      }
      if(equal(row.live,row.saved))continue;
      const patch=makeConfigPatch({
        ...row.live, adapterConfig:{model:row.live.model},runtimeConfig:{heartbeat:{enabled:row.live.heartbeatEnabled}}
      },row.saved,row.revision);
      if(patch)changes.push({...row,patch});
    }
    for(const change of changes){
      callCli(['agent','update',change.id,'--payload-json',JSON.stringify(change.patch)],{json:false});
      console.log('Applied '+change.role+' with configuration revision check');
    }
    // Refresh saved baseline only after each successful patch.
    for(const row of rows){
      const {config}=configFor(row.id);
      state.roles[row.role]={id:row.id,baseline:snapshotAgent(row.role,config)};
    }
    state.companyId=company;
    saveState(state);
    console.log(changes.length+' Paperclip configuration changes applied. Instructions sync through Git-linked external bundles.');
  }
}
try{main()}catch(error){console.error('Retina Paperclip sync: '+error.message);process.exitCode=1;}
