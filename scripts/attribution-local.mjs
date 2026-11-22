#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindingsFile, readBindings, updateBindings, validateBinding } from '../src/telemetry-store.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const filename=bindingsFile(root);
const [command='list',session,issue,type,points,risk]=process.argv.slice(2);
try {
  const bindings=readBindings(filename);
  switch(command) {
    case 'bind':
      bindings[session]=validateBinding(session,issue,type,points,risk||null);
      updateBindings(filename,bindings);
      break;
    case 'unbind':
      if (!session || !Object.hasOwn(bindings,session)) throw Error('Unknown bound session');
      delete bindings[session];updateBindings(filename,bindings);
      break;
    case 'list':
      if(session) throw Error('Usage: npm run task -- list');
      break;
    default:
      throw Error('Usage: npm run task -- bind SESSION ISSUE TYPE STORY_POINTS [R1|R2|R3|R4] | unbind SESSION | list');
  }
  console.log(JSON.stringify(bindings,null,2));
} catch(error) {console.error('Retina attribution:',error.message);process.exitCode=1;}
