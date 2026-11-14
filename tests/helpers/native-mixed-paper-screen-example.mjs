import {nativeMixedDigitalScreenExample,screenId as id} from './native-mixed-digital-screen-example.mjs';
export function nativeMixedPaperScreenExample(pairing='PP',actor=id(50),roles=['cross_checker']){
 const x=nativeMixedDigitalScreenExample('paper'),sideA=structuredClone(x.binding.opponent),sideB=pairing==='PP'?{...structuredClone(x.binding.player),profileId:null,mode:'paper',displayName:'Fictional Paper 11'}:structuredClone(x.binding.player);
 const paperPerson=p=>{const{profileId,...rest}=p;return{...rest,actorRef:profileId};};
 const binding={target:{...x.binding.target,actorId:actor},tournamentName:x.binding.tournamentName,eventName:x.binding.eventName,gameNumber:3,sideA:paperPerson(sideA),sideB:paperPerson(sideB),official:{roles,identityBindingId:id(90),nonselfChecked:true}};
 const state={...structuredClone(x.state),actorId:actor,playOrder:'official'},result={winnerSide:'b',margin:40};let sequence=0;
 const add=(by,action,payload)=>{const n=++sequence,e={id:id(100+n),operationId:id(200+n),receiptId:id(300+n),payloadDigest:'a'.repeat(64),sequence:n,actorId:by,tournamentId:binding.target.tournamentId,eventId:binding.target.eventId,startId:binding.target.startId,gameId:binding.target.gameId,startSourceDigest:binding.target.startSourceDigest,action,...structuredClone(payload)};state.entries.push(e);state.revision=n;state.evidenceVisibility='evidence';return e;};
 const claims=()=>[{side:'a',result:structuredClone(result)},...(pairing==='PP'?[{side:'b',result:structuredClone(result)}]:[])];
 const capture=()=>add(id(50),'paper-capture',{artifactId:id(60),artifactDigest:'a'.repeat(64),claims:claims(),physicalOriginal:false,fictionalOpponentPlayed:false,independentHumanPlayClaimed:false,statement:'fictional-paper-capture-v1'});
 const review=()=>{const c=state.entries.find(e=>e.action==='paper-capture');return add(id(51),'paper-review',{captureId:c.id,artifactId:c.artifactId,artifactDigest:c.artifactDigest,reenteredClaims:structuredClone(c.claims),decision:'accepted-simulation-only',statement:'fictional-paper-review-v1'});};
 const submit=()=>add(sideB.profileId,'digital-submit',{participantId:sideB.participantId,result,statement:'simulation-own-result-v1'});
 const confirm=()=>add(sideB.profileId,'digital-confirm',{participantId:sideB.participantId,result,references:state.entries.filter(e=>e.action!=='digital-confirm').map(e=>e.id),statement:'simulation-own-confirmation-v1'});
 return{binding,state,result,claims,capture,review,submit,confirm};
}
