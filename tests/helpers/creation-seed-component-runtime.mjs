import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';
const root=path.resolve(process.env.CREATION_SEED_APP_ROOT??process.cwd()),require=createRequire(path.join(root,'package.json')),ts=require('typescript');
export const id=n=>`bc120000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const actor=id(1),tournament=id(2),foreign=id(3);
export const seed=(tid=tournament)=>({status:'tournament_created',tournamentId:tid,tournamentName:'Fictional Seed',tournamentDate:'02-03-2027'});
export const seedKey=(a=actor,t=tournament)=>`tournament-creation-seed:${a}:${t}`;
export const settle=async()=>{for(let i=0;i<150;i++)await Promise.resolve();};
export function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
export function text(node){if(node===null||node===undefined||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);return [node.props?.children].flat(Infinity).map(text).join('');}
export function runtime(entry,fetch){
 const values=new Map(),removed=[],writes=[],pushes=[],cache=new Map(),slots=[],effects=new Map(),layouts=new Map();let cursor=0,props,component,tree;
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes.push({key,value});values.set(key,value);},removeItem:key=>{removed.push(key);values.delete(key);}};
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const memo=(value,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:value()};return slots[i].value;};
 const hooks={useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef:initial=>{const i=cursor++;return slots[i]??= {current:initial};},useMemo:memo,useCallback:(fn,deps)=>memo(()=>fn,deps),useId:()=>memo(()=>`fixture-${cursor}`,[]),useEffect:(fn,deps)=>{const i=cursor++,old=effects.get(i);if(!old||!same(old.deps,deps))effects.set(i,{fn,deps,cleanup:old?.cleanup,pending:true});},useLayoutEffect:(fn,deps)=>{const i=cursor++,old=layouts.get(i);if(!old||!same(old.deps,deps))layouts.set(i,{fn,deps,cleanup:old?.cleanup,pending:true});}};
 const timers=[],jsx=(type,props)=>({type,props}),noop=()=>null,ui=new Proxy({__esModule:true,default:noop},{get:(o,k)=>k in o?o[k]:noop});
 const context=vm.createContext({console,Response,Request,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,AbortController,structuredClone,crypto:globalThis.crypto,process:{env:{}},sessionStorage:storage,fetch:(...args)=>fetch(...args),setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},window:{sessionStorage:storage,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}},navigator:{onLine:true},Intl,Date});
 function load(file,isEntry=false){
  if(cache.has(file))return cache.get(file).exports;
  if(file.endsWith('.css')||file.endsWith('.tsx')&&!isEntry)return ui;
  const loadedModule={exports:{}};cache.set(file,loadedModule);
  const localRequire=name=>{
   if(name==='react')return hooks;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'fragment'};
   if(name==='next/navigation')return{useRouter:()=>({push:url=>pushes.push(url),refresh:()=>{}})};
   if(name==='server-only')return{};
   if(name.includes('recovery-write-coordinator'))return{setAppRecoveryItem:(s,k,v)=>s.setItem(k,v),assertRecoveryWriteAllowed:()=>{},trackAppRecoveryWrite:fn=>fn()};
   if(name.includes('auth/recovery-owner'))return{assertRecoveryStorageOwner:()=>{}};
   if(name.startsWith('next/'))return ui;
   if(!name.startsWith('.'))throw Error('Unexpected package '+name);
   const candidate=path.resolve(path.dirname(file),name);const resolved=[candidate,candidate+'.ts',candidate+'.tsx',candidate+'.js',path.join(candidate,'index.ts')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
   if(!resolved||!resolved.startsWith(root+path.sep))throw Error('Unexpected local dependency '+name);return load(resolved);
  };
  const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInContext(`(function(exports,require,module){${compiled}\n})`,context,{filename:file})(loadedModule.exports,localRequire,loadedModule);return loadedModule.exports;
 }
 component=load(path.join(root,entry),true);component=component.default??component.NewTournamentClient;
 const render=next=>{if(next)props=next;cursor=0;tree=component(props);for(const effect of layouts.values())if(effect.pending){effect.cleanup?.();effect.cleanup=effect.fn();effect.pending=false;}return tree;};
 const runEffects=predicate=>{for(const effect of effects.values())if(effect.pending&&predicate(effect.fn.toString())){effect.cleanup?.();effect.cleanup=effect.fn();effect.pending=false;}};
 const loadSetup=()=>slots.find(v=>v?.value&&typeof v.value==='function'&&v.value.toString().includes('setup-load-superseded'))?.value;
 return{values,removed,writes,pushes,storage,render,runEffects,loadSetup,timers,get tree(){return tree;},unmount:()=>{for(const effect of layouts.values())effect.cleanup?.();}};
}
