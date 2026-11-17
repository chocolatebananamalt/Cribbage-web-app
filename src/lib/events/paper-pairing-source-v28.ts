import 'server-only';
import {isUuid} from '../api/validation.ts';
import {requireVerifiedIdentity} from '../api/verified-subject.ts';
import {buildPaperPairingPacketV28} from './paper-pairing-packet-v28.ts';
type Client=Parameters<typeof requireVerifiedIdentity>[0]&{auth:{getUser:()=>Promise<{data:{user:{id:string}|null};error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
export async function readPaperPairingPacketV28(client:Client,scope:{actorId:string;tournamentId:string;eventId:string;player?:string},readWorkspace:()=>PromiseLike<{data:unknown;error:unknown}>) {
 if(![scope.actorId,scope.tournamentId,scope.eventId].every(isUuid)||scope.player!==undefined&&(scope.player.length>8||!/^[A-Z]-[1-9][0-9]*$/.test(scope.player)))return null;
 try {
 const before=await requireVerifiedIdentity(client),user=await client.auth.getUser();if(!before||before.subject!==scope.actorId||user.error||user.data.user?.id!==scope.actorId)return null;
 const role=await client.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});if(role.error||!['director','co_director'].includes(String(role.data)))return null;
 const prepared=await requireVerifiedIdentity(client),preparedUser=await client.auth.getUser(),preparedFinal=await requireVerifiedIdentity(client);if(!preparedFinal||preparedFinal.subject!==before.subject||preparedFinal.sessionId!==before.sessionId||!prepared||prepared.subject!==before.subject||prepared.sessionId!==before.sessionId||preparedUser.error||preparedUser.data.user?.id!==scope.actorId)return null;
 const raw=await readWorkspace(),after=await requireVerifiedIdentity(client),lastUser=await client.auth.getUser(),lastRole=await client.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId}),finalIdentity=await requireVerifiedIdentity(client);
 if(!finalIdentity||finalIdentity.subject!==before.subject||finalIdentity.sessionId!==before.sessionId||raw.error||!after||after.subject!==before.subject||after.sessionId!==before.sessionId||lastUser.error||lastUser.data.user?.id!==scope.actorId||lastRole.error||lastRole.data!==role.data)return null;
 return buildPaperPairingPacketV28(raw.data,scope.eventId,scope.player);
 }catch{return null;}
}
