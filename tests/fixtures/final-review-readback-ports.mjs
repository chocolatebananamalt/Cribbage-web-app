export const createClient=()=>({auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});
export const trackAppRecoveryWrite=fn=>fn();
export const createIndexedFinanceDraftRetainedV1=()=>({
 read:async key=>window.fixture.values.get(key)??null,
 transition:async(key,old,next,archive)=>{
  const f=window.fixture;if((f.values.get(key)??null)!==old)return false;
  if(archive&&f.mode==='archive-failure')return false;
  if(next===null)f.values.delete(key);else f.values.set(key,next);
  if(archive)f.archives.push(archive);return true;
 }
});
