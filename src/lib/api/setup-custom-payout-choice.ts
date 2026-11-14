/** Presentation of existing setup wording only; not a new payout policy. */
export type SetupPayoutChoiceKind='q'|'satellite';
export function presetPayoutFromCustomRatio(kind:SetupPayoutChoiceKind,raw:string,options:readonly string[]):string|null {
 if(!/^[0-9]+$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)<=0)return null;
 const value=kind==='q'?`Graduated (1-in-${Number(raw)})`:`1 in ${Number(raw)}`;
 return options.includes(value)?value:null;
}
export function customPayoutDraftIssue(kind:SetupPayoutChoiceKind,raw:string,options:readonly string[]):string|null {
 if(presetPayoutFromCustomRatio(kind,raw,options))return null;
 if(!raw)return'Enter the required payout ratio.';
 if(!/^[0-9]+$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)<=0)return'Enter a positive whole number.';
 return kind==='q'?'This custom ratio is not yet connected to Q-Pool policy and accounting. It cannot be saved in this test version.':'This custom ratio is not yet connected to Satellite payout calculation and accounting. It cannot be saved in this test version.';
}
