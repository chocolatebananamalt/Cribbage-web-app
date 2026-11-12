'use client';
import Link from'next/link';
import {PlayerPageFrame}from'./player-page-frame';
import {useEffect,useMemo,useState,type ComponentProps}from'react';
import {NativeMixedDigitalScoreEntryV1}from'./native-mixed-digital-score-entry-v1';
import {NativeMixedPlayerScorecardV1}from'./native-mixed-player-scorecard-v1';
import {isNativeMixedGameTargetV1,type NativeMixedGameTargetV1}from'../lib/seating/native-mixed-game-evidence-v1';
import {loadNativeMixedOwnEntryV1}from'../lib/seating/native-mixed-digital-entry-view-v1';
import {loadNativeMixedOwnPlayerCardV1}from'../lib/seating/native-mixed-player-scorecard-v1';
type Runtime=NonNullable<ComponentProps<typeof NativeMixedDigitalScoreEntryV1>['runtime']>;
type Entry=Awaited<ReturnType<typeof loadNativeMixedOwnEntryV1>>;
type Card=Awaited<ReturnType<typeof loadNativeMixedOwnPlayerCardV1>>;
/** Unmounted/default-off integration. No client/service-key creation or role
 * grant. Host must dispose on account change and supply an authenticated own
 * transport plus transactional retained storage; actual routes remain separate. */
export function NativeMixedOwnPlayerScreenV1({enabled=false,page,target,online,runtime}:{enabled?:boolean;page:'entry'|'card';target:NativeMixedGameTargetV1|null;online:boolean;runtime:Runtime|null}){
 const valid=enabled&&!!runtime&&isNativeMixedGameTargetV1(target),key=valid?JSON.stringify([page,target]):'';
 const epoch=useMemo(()=>({key,valid,runtime}),[key,valid,runtime]);
 const [loaded,setLoaded]=useState<{key:string;epoch:object;runtime:Runtime;entry:Entry;card:Card}|null>(null);
 useEffect(()=>{
  if(!valid||!runtime||!target)return;let active=true;const captured=structuredClone(target),options={target:captured,transport:runtime.transport,enabled:()=>active,current:()=>active};
  void(async()=>{const entry=page==='entry'?await loadNativeMixedOwnEntryV1(options):null,card=page==='card'?await loadNativeMixedOwnPlayerCardV1(options):null;if(active)setLoaded({key,epoch,runtime,entry,card});})();
  return()=>{active=false;};
 },[epoch,key,page,runtime,target,valid]);
 if(!valid)return <p role="status">Player rehearsal is not enabled. Saved entries are preserved.</p>;
 if(!loaded||loaded.key!==key||loaded.epoch!==epoch||loaded.runtime!==runtime)return <p role="status">Checking your current rehearsal information. Saved entries are preserved.</p>;
 const path=`/tournament/${target!.tournamentId}/rehearsal/${target!.eventId}/${target!.startId}/${target!.gameId}`,navigation={entryHref:path,cardHref:path+'?page=card'};
 if(page==='entry')return loaded.entry?<NativeMixedDigitalScoreEntryV1 enabled navigation={navigation} binding={loaded.entry.binding} initialState={loaded.entry.state} online={online} runtime={runtime}/>:<p role="status">Current player information is unavailable. Saved entries are preserved.</p>;
 if(!loaded.card)return <NativeMixedPlayerScorecardV1 enabled card={null}/>;
 return <PlayerPageFrame tournamentId={target!.tournamentId} tournamentName={loaded.card.tournamentName} eventId={target!.eventId} eventName={loaded.card.eventName} activeTab="card" navigation={navigation} player={{displayName:loaded.card.player.displayName,verificationId:loaded.card.player.fixedTournamentId}}><NativeMixedPlayerScorecardV1 enabled card={loaded.card}/>{loaded.card.currentGameId?<Link className="primary player-current-game" href={`/tournament/${target!.tournamentId}/rehearsal/${target!.eventId}/${target!.startId}/${loaded.card.currentGameId}`}>Open Current Practice Game</Link>:null}</PlayerPageFrame>;
}
