from pathlib import Path
s=Path('tests/helpers/render-native-mixed-start-actual-models.mjs').read_text()
s=s[:s.index('const {NativeMixedStartViewV1:Start}')]
s+='''
const {NativeMixedBootstrapViewV1:View}=load('src/components/native-mixed-bootstrap-workflow-v1.tsx');
const {offer,context,modeFor,templates}=await import('./bootstrap-workflow-example.mjs');
let calls=0;const noop=()=>calls++;
for(const action of Object.keys(templates)){
 const c=context(modeFor(action)),o=offer(action,c),snapshot={status:'ready',offer:o,wire:null,phase:null,receipt:null,message:o.message};
 const props={enabled:true,context:c,snapshot,online:true,busy:false,confirmed:false,confirm:noop,refresh:noop,submit:noop,check:noop,retry:noop};
 const html=renderToStaticMarkup(React.createElement(View,props));assert(html.includes('TEST ONLY'));assert(!html.includes('checked=""'));assert(html.includes('disabled=""'));
 assert.equal(renderToStaticMarkup(React.createElement(View,{...props,enabled:false})), '');
}
assert.equal(calls,0);console.log('PASS nine role/action SSR cases; unchecked confirmation, disabled submit, off gate; not browser proof');
'''
Path('tests/helpers/render-native-bootstrap-workflow.mjs').write_text(s,encoding='utf8')
