'use client';
import {useEffect,useMemo,useState,type ComponentProps}from'react';
import {NativeMixedPaperEntryV1}from'./native-mixed-paper-entry-v1';
import {isNativeMixedGameTargetV1,type NativeMixedGameTargetV1}from'../lib/seating/native-mixed-game-evidence-v1';
import {projectNativeMixedPaperEntryV1,type NativeMixedPaperEntryBindingV1}from'../lib/seating/native-mixed-paper-entry-view-v1';
type Runtime=NonNullable<ComponentProps<typeof NativeMixedPaperEntryV1>['runtime']>;
/** Private host. All names/roles come from current own-session server metadata,
 * never URL role claims. Account/Start changes discard display state, not saved work. */
export function NativeMixedBoundPaperScreenV1({enabled=false,target,online,runtime}:{enabled?:boolean;target:NativeMixedGameTargetV1|null;online:boolean;runtime:Runtime|null}){
 const valid=enabled&&!!runtime&&isNativeMixedGameTargetV1(target),key=valid?JSON.stringify(target):'';
 const epoch=useMemo(()=>({key,valid,runtime}),[key,valid,runtime]);
 const [loaded,setLoaded]=useState<{epoch:object;binding:NativeMixedPaperEntryBindingV1|null;state:unknown}|null>(null);
 useEffect(()=>{
  if(!valid||!runtime||!target)return;let active=true;const captured=structuredClone(target);
  void(async()=>{try{
   const metadata=await runtime.transport.paperBinding(captured);if(!active)return;
   const state=metadata.data?await runtime.transport.state(captured):null;if(!active)return;
   const binding=metadata.data&&state?.data&&projectNativeMixedPaperEntryV1(metadata.data,state.data)?metadata.data:null;
   if(active)setLoaded({epoch,binding,state:binding?state?.data:null});
  }catch{if(active)setLoaded({epoch,binding:null,state:null});}})();
  return()=>{active=false;};
 },[epoch,runtime,target,valid]);
 if(!valid)return <p role="status">Paper rehearsal is not enabled. Saved entries are preserved.</p>;
 if(!loaded||loaded.epoch!==epoch)return <p role="status">Checking your current Paper assignment and independent official identity.</p>;
 if(!loaded.binding)return <p role="status">Current Paper access could not be verified. Names and seats are hidden. Saved work is preserved; ask the Director to check your assignment before reloading.</p>;
 return <NativeMixedPaperEntryV1 enabled binding={loaded.binding} initialState={loaded.state} online={online} runtime={runtime}/>;
}
