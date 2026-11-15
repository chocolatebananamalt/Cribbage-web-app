import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const bundledRoot=fileURLToPath(new URL('../fixtures/integrated-history/',import.meta.url));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const inside=(root,target)=>{const relative=path.relative(root,target);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
function noLinkedParents(root,target){for(let at=target;inside(root,at);at=path.dirname(at))if(fs.existsSync(at)&&fs.lstatSync(at).isSymbolicLink())throw Error('Historical fixture path must not traverse a link');}

/** Restore only approved fictional historical test inputs, never run them or
 * substitute them for current provider evidence. Existing different bytes fail. */
export function restoreIntegratedHistory({workspaceRoot=process.cwd(),fixtureRoot=bundledRoot}={}){
  const workspace=fs.realpathSync(workspaceRoot),source=fs.realpathSync(fixtureRoot);
  const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
  if(manifest.version!==1||!Array.isArray(manifest.files)||manifest.files.length===0||manifest.files.length>64)throw Error('Invalid bounded historical fixture manifest');
  const seen=new Set(),planned=[];let total=0;
  for(const entry of manifest.files){
    if(typeof entry.path!=='string'||! /^(?:test-results\/[A-Za-z0-9_.-]+\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:json|sql)|output\/print\/physical-trial-18-20261110\/print-data\.json)$/.test(entry.path)
      ||entry.path.split('/').some(part=>part==='.'||part==='..')||seen.has(entry.path)||! /^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||entry.bytes>8*1024*1024)throw Error('Invalid historical fixture entry');
    seen.add(entry.path);total+=entry.bytes;if(total>64*1024*1024)throw Error('Historical fixture manifest exceeds byte budget');
    const from=path.resolve(source,entry.path),to=path.resolve(workspace,entry.path);
    if(!inside(source,from)||!inside(workspace,to))throw Error('Historical fixture path escapes its root');
    noLinkedParents(source,from);noLinkedParents(workspace,to);
    const stat=fs.statSync(from);if(!stat.isFile()||stat.size!==entry.bytes||hash(fs.readFileSync(from))!==entry.sha256)throw Error('Bundled historical fixture hash mismatch: '+entry.path);
    if(fs.existsSync(to)){if(!fs.statSync(to).isFile()||hash(fs.readFileSync(to))!==entry.sha256)throw Error('Existing historical fixture differs; refusing overwrite: '+entry.path);}
    else planned.push({from,to,entry});
  }
  for(const {from,to,entry}of planned){fs.mkdirSync(path.dirname(to),{recursive:true});noLinkedParents(workspace,to);try{fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);}catch(error){if(error.code!=='EEXIST'||hash(fs.readFileSync(to))!==entry.sha256)throw error;}if(hash(fs.readFileSync(to))!==entry.sha256)throw Error('Restored historical fixture hash mismatch: '+entry.path);}
  return{approved:manifest.files.length,restored:planned.length,fictionalHistoricalInputsOnly:true};
}
