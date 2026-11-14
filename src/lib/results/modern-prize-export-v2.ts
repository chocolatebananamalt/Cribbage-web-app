import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import type {ModernPrizeResultsV2} from './modern-prize-results-v2.ts';
export const modernPrizeExportEnabledV2=()=>integratedTestFeatureEnabled();
const cell=(value:string|number|boolean)=>{const text=String(value);return '"'+(/^[\s]*[=+@-]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';};
/** Caller must freshly authorize and obtain a current source-validated view. */
export function modernPrizeCsvV2(view:ModernPrizeResultsV2,scope:{tournamentId:string;eventId:string;qualificationResultVersionId:string}){
 const rows:Array<Array<string|number|boolean>>=[['Report','Recorded Unpaid Regular Prize Awards'],['Status','No payment, bank settlement, MRP award or ACC acceptance established'],['Tournament',scope.tournamentId],['Event',scope.eventId],['Qualification Result Version',scope.qualificationResultVersionId],['Event Type',view.eventKind],['Method',view.method],['Recorded At',view.recordedAt],['Source Observation','Source-validated award snapshot; separate qualification and access reads are not one atomic transaction. Refresh for a new check.'],['Rounding Increment USD',(view.roundingUnitMinor/100).toFixed(2)],['Regular Fund / Award Total USD',(view.totalMinor/100).toFixed(2)],['Separate Funds','Q-Pool and Side Pool amounts are not included'],[],['Tournament Player ID','Name','First Place','Last Place','Included','Award USD','Payment Status']];
 for(const group of view.groups)for(const member of group.members)rows.push([member.tournamentPlayerId,member.name,group.firstPlace,group.lastPlace,group.included,(group.perPersonMinor/100).toFixed(2),'Unpaid']);
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
