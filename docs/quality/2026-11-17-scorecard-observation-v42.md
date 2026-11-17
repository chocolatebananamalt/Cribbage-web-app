# V42: ordinary player scorecard observation

## Local core behavior

The ordinary scorecard route previously returned a server-rendered PlayerScorecardView with no observer. New client observer asks the existing router to refresh every10seconds and on focus/online/visible/accepted-result notification. Only matching SDK-observed server actor, committed actor/tournament/event/fixedID scope, visible page, online state and no print session permit a check. Rapid events coalesce for1second. Subscription failure is closed; layout invalidation blocks retained callbacks before passive cleanup. No action submission, local verification, new RPC, score calculation or browser-storage access.

The route supplies its existing authorized actor. Existing scorecard/MyGames/server-authorization readers, totals/row projection, print control and recovery storage are unchanged. All feature-gate files and values remain unchanged. This is local unpublished code, not a staged activation. The pinned Next16.4.5 useRouter guide documents current-route RSC refresh/state preservation; genuine runtime caching/provider acceptance is not inferred from synthetic ports.

## Executed proof

Four focused groups cover own-account10s timing, narrow storage key, burst coalescing, offline/hidden/print/foreign/unknown/setupfailure, layout cleanup before passive cleanup, scope/owner ABA, cleanup and no mutation/storage calls.8Chrome cases at390/1440 use actual scorecard page VM -> actual getPlayerScorecard validator -> normal synthetic RPC -> actual PlayerScorecardView/observer. After authoritative fixture verification both independent views fetch fresh data and render verified rows/totals without manual refresh. Correction after print, offline/unknown pause, unmount and unchanged own/foreign bytes pass. Eight normal RPC reads observed; owned listener closed. No provider write request.

Auth/RPC/router-refresh/frame are explicit synthetic ports; fixture state changes are not the two-player confirmation protocol. No genuine Auth/PostgREST/database/NextSSR/RSC or physical print acceptance. Existing historical laptop waiting after two confirmations is not re-diagnosed or claimed fixed by this separate scorecard observation slice.

Full app3899pass; lint0errors/252baselinewarnings; provider/build/typecheck pass; workspace7pass/1private-handoff skip. Dependency pins unchanged from verified V41/V40 security patch; audit evidence can be reused only with exact package/lock hash equality. Independent bounded source review passes. Aggregate report records commands, source identities, patch reconstruction and limitations.

## Intentional limits

Pagehide permanently disposes that mounted observer; a back-forward-cache-restored page needs full reload to resume, consistent with existing recovery document boundary. Print guards suppress new checks; they do not claim cancellation of an RSC request already in flight or physical-print immutability. A failed observation keeps the existing server-rendered view; it never changes pending data or claims freshness. Account hints from browser subscription do not grant authority: existing server checks remain decisive.

No production/practice/draft/session access, publication retry, callback/settings/SQL/grant/gate change, new tournament or sign-in email. Main regular-only/no-pool financial-source wiring remains a separate backend dependency documented in support; no fake empty pool journal introduced.
