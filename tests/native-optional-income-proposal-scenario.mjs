// Real pure editor actions over the caller's actual SQL-derived proposal.
import assert from'node:assert/strict';
import{reduceEventFinanceEditorV1,projectEventFinancePayoutBasisReviewV1,projectEventFinanceSectionV1}from'../src/lib/finance/event-finance-workspace-v1.ts';
export function advanceNativeOptionalIncomeProposal({editor,stage,lineId=null,nextId}){
 const before=structuredClone(editor),basis=editor.basis;
 const act=action=>{editor=reduceEventFinanceEditorV1(editor,action,basis,nextId);};
 if(stage===0||stage===3){
  act({type:'add_line',category:'unrestricted_income'});act({type:'line_field',field:'label',value:stage===0?'TEST ONLY Donation One':'TEST ONLY Donation Two'});
  act({type:'line_field',field:'amount',value:stage===0?'100':'200'});act({type:'line_field',field:'reason',value:'TEST ONLY new recorded unrestricted donation proposal'});act({type:'apply_line'});
 }else if(stage===1){
  act({type:'edit_line',lineId});act({type:'line_field',field:'amount',value:'150'});act({type:'line_field',field:'reason',value:'TEST ONLY correct donation amount with retained history'});act({type:'apply_line'});
 }else if(stage===2)act({type:'void_line',lineId,reason:'TEST ONLY void erroneous donation; no money refunded'});
 else throw Error('Unsupported income scenario stage');
 assert.equal(editor.history.length,before.history.length+1);assert.deepEqual(editor.history.slice(0,before.history.length),before.history);
 const record=structuredClone(editor.history.at(-1));assert.equal(record.line.category,'unrestricted_income');
 const review=projectEventFinancePayoutBasisReviewV1(editor,basis);assert.equal(review.status,'review_required',JSON.stringify(review));
 act({type:'review_payout_basis',reviewKey:review.reviewKey,reason:'TEST ONLY explicitly re-review payouts after donation change',confirmed:true});
 assert.deepEqual(editor.overrideHistory.slice(0,before.overrideHistory.length),before.overrideHistory);
 act({type:'edit_band',firstPlace:1,lastPlace:1});
 act({type:'band_field',field:'reason',value:'TEST ONLY equal-group fund-conserving payout adjustment'});
 if(stage<2){act({type:'band_field',field:'amount',value:stage===0?'210':'230'});act({type:'apply_band'});}
 else act({type:'restore_band'});
 const view=projectEventFinanceSectionV1(editor,basis),fund=[53000,58000,43000,63000][stage];
 assert.equal(view.fundMinor,fund);assert.equal(view.adjustedTotalMinor,fund);assert.equal(view.differenceMinor,0);
 assert.equal(view.excludedQMinor,17000);assert.equal(view.excludedSideMinor,16000);
 assert.deepEqual(editor.history.slice(0,before.history.length),before.history);
 return{editor,record,lineId:record.line.lineId,view,review};
}
