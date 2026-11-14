const snapshotScope=(value:unknown):unknown=>{try{return structuredClone(value);}catch{return undefined;}};
import{createEventFinanceEditorV1,isEventFinanceWorkspaceV1,projectEventFinanceSectionV1,reduceEventFinanceEditorV1,type EventFinanceEditorV1,type EventFinanceSectionViewV1,type EventFinanceWorkspaceV1,type EventFinanceActionV1}from'./event-finance-workspace-v1.ts';
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
/** Local proposal state only. No effects, persistence, finance permissions, receipt
 * or payment authority. A future host must enforce its own authenticated access.
 * One rendered-view lease prevents old controls from editing a newer form/source.
 */
export class EventFinanceEditorControllerV1{
 private forecastScope:unknown;private editor:EventFinanceEditorV1|null;private current:EventFinanceWorkspaceV1|null;private enabled=false;private view:EventFinanceSectionViewV1|null=null;private makeId:()=>string;private listeners=new Set<()=>void>();
 constructor(workspace:unknown,makeId:()=>string,forecastScope?:unknown){this.forecastScope=snapshotScope(forecastScope);this.editor=createEventFinanceEditorV1(workspace);this.current=isEventFinanceWorkspaceV1(workspace)?structuredClone(workspace):null;this.makeId=makeId;}
 getSnapshot=()=>this.view;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private publish(){this.view=this.enabled&&this.editor?freeze(projectEventFinanceSectionV1(this.editor,this.current,this.forecastScope)):null;this.listeners.forEach(fn=>fn());}
 setEnabled(enabled:boolean){if(this.enabled===enabled)return;this.enabled=enabled;this.publish();}
 updateSource(workspace:unknown,forecastScope?:unknown){this.forecastScope=snapshotScope(forecastScope);this.current=isEventFinanceWorkspaceV1(workspace)?structuredClone(workspace):null;this.publish();}
 dispatch=(action:EventFinanceActionV1,expectedView:EventFinanceSectionViewV1)=>{if(!this.enabled||!this.editor||!this.view||expectedView!==this.view||this.view.blocked)return false;this.editor=reduceEventFinanceEditorV1(this.editor,action,this.current,this.makeId);this.publish();return true;};
 /** Read-only retained source/proposal for future explicit recovery/export.
  * It is not persisted, approved, disbursed, or safe to discard on navigation. */
 getRetainedProposal(){return this.editor?freeze(structuredClone(this.editor)):null;}
}
