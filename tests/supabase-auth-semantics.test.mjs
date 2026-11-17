import {directPrivateResponseBoundary,directPrivateUnavailableBoundary,sharedApiUnavailableBoundary} from './helpers/direct-route-contracts.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const collectRoutes = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(directory, entry.name);
  if (entry.isDirectory()) return collectRoutes(fullPath);
  return entry.name === 'route.ts' ? [fullPath] : [];
});

function usesGameReopenNoStore(route,source,handler=read('src/lib/api/native-mixed-game-reopen-v1.ts')){
 const tree=ts.createSourceFile(route,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const factory='createNativeMixedGameReopenHandlersV1';
 const imported=tree.statements.find(n=>ts.isImportDeclaration(n)&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)&&n.importClause.namedBindings.elements.some(e=>e.name.text===factory));
 if(!imported||!ts.isStringLiteral(imported.moduleSpecifier)||path.resolve(path.dirname(route),imported.moduleSpecifier.text+'.ts')!==path.join(root,'src/lib/api/native-mixed-game-reopen-v1.ts'))return false;
 let binding;const exports=[];
 for(const s of tree.statements){if(!ts.isVariableStatement(s))continue;for(const d of s.declarationList.declarations){
  if(ts.isIdentifier(d.name)&&d.initializer&&ts.isCallExpression(d.initializer)&&d.initializer.expression.getText(tree)===factory)binding=d.name.text;
  if(s.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))exports.push(d);
 }}
 if(!binding||!exports.length||!exports.every(d=>ts.isIdentifier(d.name)&&['GET','POST'].includes(d.name.text)&&d.initializer&&ts.isArrowFunction(d.initializer)&&ts.isCallExpression(d.initializer.body)&&ts.isPropertyAccessExpression(d.initializer.body.expression)&&d.initializer.body.expression.expression.getText(tree)===binding&&['GET','POST','reconcilePOST'].includes(d.initializer.body.expression.name.text)))return false;
 // This bounded factory owns its Response.json helper. All return branches
 // must continue through it; changing the helper or bypassing it fails here.
 return handler.includes("const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}})")
  &&! /return\s+(?:Response\.|new Response|fetch\()/.test(handler)
  &&handler.includes("return{GET:(r:NextRequest,c:Context)=>run(r,c,'read'),POST:(r:NextRequest,c:Context)=>run(r,c,'write'),reconcilePOST:(r:NextRequest,c:Context)=>run(r,c,'recover')}");
}

function usesConsyAddonNoStore(route,source,handler=read('src/lib/api/consy-addon-director-handlers-v1.ts'),factoryName='createConsyAddonDirectorHandlersV1',handlerFile='src/lib/api/consy-addon-director-handlers-v1.ts'){
 const tree=ts.createSourceFile(route,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const name=factoryName;
 if(!tree.statements.some(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&path.resolve(path.dirname(route),n.moduleSpecifier.text+'.ts')===path.join(root,handlerFile)&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)&&n.importClause.namedBindings.elements.some(e=>e.name.text===name)))return false;
 const binding=tree.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]).find(d=>ts.isIdentifier(d.name)&&d.initializer&&ts.isCallExpression(d.initializer)&&d.initializer.expression.getText(tree)===name)?.name.getText(tree);
 const exports=tree.statements.filter(n=>ts.isVariableStatement(n)&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)).flatMap(n=>[...n.declarationList.declarations]).filter(d=>!(ts.isIdentifier(d.name)&&d.name.text==='dynamic'&&d.initializer&&ts.isStringLiteral(d.initializer)&&d.initializer.text==='force-dynamic'));
 if(!exports.length||!exports.every(d=>ts.isIdentifier(d.name)&&['GET','POST'].includes(d.name.text)&&d.initializer&&ts.isPropertyAccessExpression(d.initializer)&&['GET','POST','reconcilePOST'].includes(d.initializer.name.text)&&(ts.isCallExpression(d.initializer.expression)&&d.initializer.expression.expression.getText(tree)===name||ts.isIdentifier(d.initializer.expression)&&d.initializer.expression.text===binding)))return false;
 return /const json=\((?:v|body):unknown,status=200\)=>Response\.json\((?:v|body),\{status,headers:\{'cache-control':'private, no-store'\}\}\)/.test(handler)&&!/return\s+(?:Response\.|new Response|fetch\()/.test(handler);
}

// Follow real wrapper -> production factory -> shared apiJson wiring. Merely
// placing a boundary name in a route comment is not a factory proof.
function usesSharedMixedNoStore(route,source,productionSource=read('src/lib/api/synthetic-mixed-production.ts'),settings={factory:'createMixedProductionHandlers',file:'src/lib/api/synthetic-mixed-production.ts',handler:'createMixedHandlers',methods:['capabilityGET','ownGET','ownPOST','officialGET','officialPOST']}){
 const tree=ts.createSourceFile(route,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const imported=tree.statements.find(n=>ts.isImportDeclaration(n)&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)
  &&n.importClause.namedBindings.elements.some(e=>e.name.text===settings.factory));
 if(!imported||!ts.isStringLiteral(imported.moduleSpecifier)||path.resolve(path.dirname(route),imported.moduleSpecifier.text+'.ts')!==path.join(root,settings.file))return false;
 let binding;const exported=[];
 for(const statement of tree.statements){
  if(!ts.isVariableStatement(statement))continue;
  for(const d of statement.declarationList.declarations){
   if(ts.isIdentifier(d.name)&&d.initializer&&ts.isCallExpression(d.initializer)&&d.initializer.expression.getText(tree)===settings.factory&&d.initializer.arguments.length===0)binding=d.name.text;
   if(statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){if(ts.isIdentifier(d.name)&&d.name.text==='dynamic'&&d.initializer&&ts.isStringLiteral(d.initializer)&&d.initializer.text==='force-dynamic')continue;exported.push(d);}
  }
 }
 if(!binding||!exported.length||!exported.every(d=>ts.isIdentifier(d.name)&&['GET','POST'].includes(d.name.text)&&d.initializer&&ts.isPropertyAccessExpression(d.initializer)
  &&d.initializer.expression.getText(tree)===binding&&settings.methods.includes(d.initializer.name.text)))return false;
 const factory=ts.createSourceFile('production.ts',productionSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const boundaryImport=factory.statements.find(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text==='./route-boundary');
 if(!boundaryImport?.importClause?.namedBindings||!ts.isNamedImports(boundaryImport.importClause.namedBindings))return false;
 const names=boundaryImport.importClause.namedBindings.elements.map(n=>n.name.text);if(!names.includes('apiJson')||!names.includes('withApiFailureBoundary'))return false;
 const definition=factory.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===settings.factory);
 if(!definition?.body||definition.parameters.length)return false;
 const returned=definition.body.statements.find(ts.isReturnStatement)?.expression;
 if(!returned||!ts.isCallExpression(returned)||returned.expression.getText(factory)!==settings.handler||returned.arguments.length!==1||!ts.isObjectLiteralExpression(returned.arguments[0]))return false;
 const properties=returned.arguments[0].properties;
 return [['json','apiJson'],['boundary','withApiFailureBoundary']].every(([name,value])=>properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(factory)===name&&ts.isIdentifier(p.initializer)&&p.initializer.text===value));
}

function usesSharedBootstrapWorkflowNoStore(route,source,production=read('src/lib/api/native-mixed-bootstrap-production-v1.ts')){
 return usesSharedMixedNoStore(route,source,production,{factory:'createNativeMixedBootstrapProductionHandlersV1',file:'src/lib/api/native-mixed-bootstrap-production-v1.ts',handler:'createNativeMixedBootstrapHandlersV1',methods:['sourceGET','writePOST','operationPOST']});
}
function usesSharedPilotNoStore(route,source,productionSource=read('src/lib/api/native-mixed-pilot-director-production-v1.ts')){
 const file='src/lib/api/native-mixed-pilot-director-production-v1.ts';
 return [{factory:'createNativeMixedPilotDirectorProductionHandlersV1',file,handler:'createNativeMixedPilotDirectorHandlersV1',methods:['sourceGET','operationPOST','operationGET','transitionPOST','cancelPOST','cancellationPOST','simulatedStartPOST','simulatedStartOperationPOST','simulatedStartedSourcePOST']},{factory:'createNativeMixedPilotPreparationProductionHandlersV1',file,handler:'createNativeMixedPreparationHandlersV1',methods:['GET','bootstrapGET']}].some(settings=>usesSharedMixedNoStore(route,source,productionSource,settings));
}
function usesSharedOperationalProviderNoStore(route,source,productionSource=read('src/lib/api/operational-provider-production-v1.ts'),handlerSource=read('src/lib/api/operational-provider-handlers-v1.ts')){
 const productionFile='src/lib/api/operational-provider-production-v1.ts';
 const routeTree=ts.createSourceFile(route,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const imported=routeTree.statements.find(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)
  &&path.resolve(path.dirname(route),n.moduleSpecifier.text)===path.join(root,productionFile)
  &&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)
  &&n.importClause.namedBindings.elements.some(e=>(e.propertyName?.text??e.name.text)==='operationalProviderHandlersV1'));
 if(!imported||!imported.importClause?.namedBindings||!ts.isNamedImports(imported.importClause.namedBindings))return false;
 const specifier=imported.importClause.namedBindings.elements.find(e=>(e.propertyName?.text??e.name.text)==='operationalProviderHandlersV1');
 if(!specifier)return false;
 const binding=specifier.name.text;
 const allowed=new Set(['eventSettingsGET','eventSettingsPOST','eventSettingsOperationGET','financeGET','financePOST','financeOperationGET','recipientSourceGET','incomePOST','fundReviewPOST','fundReviewSourceGET','finalSourceGET','finalRecordGET','finalAwardsPOST','nativeOperationGET']);
 const exported=routeTree.statements.flatMap(statement=>ts.isVariableStatement(statement)&&statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)?[...statement.declarationList.declarations]:[]);
 if(!exported.length||!exported.every(d=>ts.isIdentifier(d.name)&&['GET','POST'].includes(d.name.text)&&d.initializer&&ts.isPropertyAccessExpression(d.initializer)
  &&d.initializer.expression.getText(routeTree)===binding&&allowed.has(d.initializer.name.text)))return false;

 const production=ts.createSourceFile('operational-provider-production-v1.ts',productionSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const boundaryImport=production.statements.find(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text==='./route-boundary.ts');
 if(!boundaryImport?.importClause?.namedBindings||!ts.isNamedImports(boundaryImport.importClause.namedBindings))return false;
 const boundaryNames=boundaryImport.importClause.namedBindings.elements.map(n=>n.name.text);
 if(!boundaryNames.includes('apiJson')||!boundaryNames.includes('withApiFailureBoundary'))return false;
 const handlerImport=production.statements.find(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text==='./operational-provider-handlers-v1.ts'
  &&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)
  &&n.importClause.namedBindings.elements.some(e=>e.name.text==='createOperationalProviderHandlersV1'));
 if(!handlerImport)return false;
 const provider=production.statements.flatMap(statement=>ts.isVariableStatement(statement)?[...statement.declarationList.declarations]:[])
  .find(d=>ts.isIdentifier(d.name)&&d.name.text==='operationalProviderHandlersV1');
 if(!provider?.initializer||!ts.isCallExpression(provider.initializer)||provider.initializer.expression.getText(production)!=='createOperationalProviderHandlersV1'
  ||provider.initializer.arguments.length!==1||!ts.isObjectLiteralExpression(provider.initializer.arguments[0]))return false;
 const properties=provider.initializer.arguments[0].properties;
 if(![['json','apiJson'],['boundary','withApiFailureBoundary']].every(([name,value])=>properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(production)===name&&ts.isIdentifier(p.initializer)&&p.initializer.text===value)))return false;

 const handler=ts.createSourceFile('operational-provider-handlers-v1.ts',handlerSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 if(!handler.statements.some(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='createOperationalProviderHandlersV1'&&n.body))return false;
 let privateNoStore=false,usesJson=false,usesBoundary=false;
 const visit=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
  const target=node.expression.expression.getText(handler),method=node.expression.name.text;
  if(target==='headers'&&method==='set'&&node.arguments.length===2&&node.arguments.every(ts.isStringLiteral)
   &&node.arguments[0].text==='cache-control'&&node.arguments[1].text==='private, no-store')privateNoStore=true;
  if(target==='d'&&method==='json')usesJson=true;
  if(target==='d'&&method==='boundary')usesBoundary=true;
 }ts.forEachChild(node,visit);};
 visit(handler);
 return privateNoStore&&usesJson&&usesBoundary;
}

function usesSharedOperationalAdoptionNoStore(route,source){
 const productionFile='src/lib/api/operational-finance-source-adoption-production-v1.ts',handlerFile='src/lib/api/operational-finance-source-adoption-handlers-v1.ts';
 const routeTree=ts.createSourceFile(route,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const imported=routeTree.statements.find(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&path.resolve(path.dirname(route),n.moduleSpecifier.text)===path.join(root,productionFile)&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)&&n.importClause.namedBindings.elements.some(e=>(e.propertyName?.text??e.name.text)==='operationalFinanceSourceAdoptionHandlersV1'));
 if(!imported||!imported.importClause?.namedBindings||!ts.isNamedImports(imported.importClause.namedBindings))return false;
 const specifier=imported.importClause.namedBindings.elements.find(e=>(e.propertyName?.text??e.name.text)==='operationalFinanceSourceAdoptionHandlersV1');if(!specifier)return false;const binding=specifier.name.text;
 const allowed=new Set(['adoptionGET','adoptionPOST','adoptionOperationGET','allocationGET','allocationPOST','allocationOperationGET']);
 const exported=routeTree.statements.flatMap(statement=>ts.isVariableStatement(statement)&&statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)?[...statement.declarationList.declarations]:[]);
 if(!exported.length||!exported.every(d=>ts.isIdentifier(d.name)&&['GET','POST'].includes(d.name.text)&&d.initializer&&ts.isPropertyAccessExpression(d.initializer)&&d.initializer.expression.getText(routeTree)===binding&&allowed.has(d.initializer.name.text)))return false;
 const productionSource=read(productionFile),handlerSource=read(handlerFile),production=ts.createSourceFile(productionFile,productionSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),handler=ts.createSourceFile(handlerFile,handlerSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const boundaryImport=production.statements.find(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text==='./route-boundary.ts');
 if(!boundaryImport?.importClause?.namedBindings||!ts.isNamedImports(boundaryImport.importClause.namedBindings))return false;const names=boundaryImport.importClause.namedBindings.elements.map(n=>n.name.text);if(!names.includes('apiJson')||!names.includes('withApiFailureBoundary'))return false;
 const provider=production.statements.flatMap(statement=>ts.isVariableStatement(statement)?[...statement.declarationList.declarations]:[]).find(d=>ts.isIdentifier(d.name)&&d.name.text==='operationalFinanceSourceAdoptionHandlersV1');
 if(!provider?.initializer||!ts.isCallExpression(provider.initializer)||provider.initializer.expression.getText(production)!=='createOperationalFinanceSourceAdoptionHandlersV1'||provider.initializer.arguments.length!==1||!ts.isObjectLiteralExpression(provider.initializer.arguments[0]))return false;
 const properties=provider.initializer.arguments[0].properties;if(![['json','apiJson'],['boundary','withApiFailureBoundary']].every(([name,value])=>properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(production)===name&&ts.isIdentifier(p.initializer)&&p.initializer.text===value)))return false;
 if(!handler.statements.some(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='createOperationalFinanceSourceAdoptionHandlersV1'&&n.body))return false;
 let privateNoStore=false,usesJson=false,usesBoundary=false;const visit=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){const target=node.expression.expression.getText(handler),method=node.expression.name.text;if(target==='headers'&&method==='set'&&node.arguments.length===2&&node.arguments.every(ts.isStringLiteral)&&node.arguments[0].text==='cache-control'&&node.arguments[1].text==='private, no-store')privateNoStore=true;if(target==='dependencies'&&method==='json')usesJson=true;if(target==='dependencies'&&method==='boundary')usesBoundary=true;}ts.forEachChild(node,visit);};visit(handler);return privateNoStore&&usesJson&&usesBoundary;
}

function usesSharedPrizeProposalNoStore(route,source,productionSource=read('src/lib/api/playoff-prize-proposal-production-v2.ts'),handlerSource=read('src/lib/api/playoff-prize-proposal-handlers-v2.ts')){
 const productionFile='src/lib/api/playoff-prize-proposal-production-v2.ts',handlerFile='src/lib/api/playoff-prize-proposal-handlers-v2.ts';
 const tree=(file,text)=>ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const importedName=(file,filePath,targetPath,name)=>{
  for(const statement of file.statements){
   if(!ts.isImportDeclaration(statement)||!ts.isStringLiteral(statement.moduleSpecifier)||path.resolve(path.dirname(filePath),statement.moduleSpecifier.text.replace(/\.ts$/,'')+'.ts')!==path.join(root,targetPath)
    ||!statement.importClause?.namedBindings||!ts.isNamedImports(statement.importClause.namedBindings))continue;
   const specifier=statement.importClause.namedBindings.elements.find(e=>(e.propertyName?.text??e.name.text)===name);
   if(specifier&&!statement.importClause.isTypeOnly&&!specifier.isTypeOnly)return specifier.name.text;
  }
  return null;
 };
 const routeTree=tree(route,source),binding=importedName(routeTree,route,productionFile,'playoffPrizeProposalHandlersV2');if(!binding)return false;
 let dynamic=false,methods=0;
 for(const statement of routeTree.statements){
  if(!statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)&&!ts.isExportDeclaration(statement)&&!ts.isExportAssignment(statement))continue;
  if(!ts.isVariableStatement(statement))return false;
  for(const declaration of statement.declarationList.declarations){
   if(!ts.isIdentifier(declaration.name)||!declaration.initializer)return false;
   const name=declaration.name.text,value=declaration.initializer;
   if(name==='dynamic'){if(dynamic||!ts.isStringLiteral(value)||value.text!=='force-dynamic')return false;dynamic=true;continue;}
   if(!['GET','POST'].includes(name)||!ts.isPropertyAccessExpression(value)||!ts.isIdentifier(value.expression)||value.expression.text!==binding
    ||!(name==='GET'?value.name.text==='GET':['POST','operationPOST'].includes(value.name.text)))return false;
   methods++;
  }
 }
 if(!dynamic||!methods)return false;
 const productionPath=path.join(root,productionFile),production=tree(productionPath,productionSource);
 const json=importedName(production,productionPath,'src/lib/api/route-boundary.ts','apiJson'),boundary=importedName(production,productionPath,'src/lib/api/route-boundary.ts','withApiFailureBoundary');
 const factory=importedName(production,productionPath,handlerFile,'createPlayoffPrizeProposalHandlersV2');if(!json||!boundary||!factory)return false;
 const provider=production.statements.filter(ts.isVariableStatement).flatMap(s=>[...s.declarationList.declarations]).find(d=>ts.isIdentifier(d.name)&&d.name.text==='playoffPrizeProposalHandlersV2');
 if(!provider?.initializer||!ts.isCallExpression(provider.initializer)||!ts.isIdentifier(provider.initializer.expression)||provider.initializer.expression.text!==factory
  ||provider.initializer.arguments.length!==1||!ts.isObjectLiteralExpression(provider.initializer.arguments[0]))return false;
 const properties=new Map();
 for(const property of provider.initializer.arguments[0].properties){
  if(!ts.isPropertyAssignment(property)||!ts.isIdentifier(property.name)||properties.has(property.name.text))return false;
  properties.set(property.name.text,property.initializer);
 }
 if(![['json',json],['boundary',boundary]].every(([name,value])=>ts.isIdentifier(properties.get(name)??{})&&properties.get(name).text===value))return false;
 const handler=tree(handlerFile,handlerSource),definition=handler.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='createPlayoffPrizeProposalHandlersV2');
 if(!definition?.body||definition.parameters.length!==1||!ts.isIdentifier(definition.parameters[0].name))return false;
 const dependency=definition.parameters[0].name.text;let usesJson=false,usesBoundary=false;
 const visit=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)&&node.expression.expression.text===dependency){
  if(node.expression.name.text==='json')usesJson=true;if(node.expression.name.text==='boundary')usesBoundary=true;
 }ts.forEachChild(node,visit);};visit(definition.body);
 return usesJson&&usesBoundary;
}

test('Supabase auth scaffolding fails closed and does not expose server secrets', () => {
  const env = read('src/lib/env.ts');
  const browser = read('src/lib/supabase/client.ts');
  const server = read('src/lib/supabase/server.ts');
  const privateAdmin = read('src/lib/supabase/private-admin.ts');
  assert.match(env, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(env, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(env, /throw new Error/);
  assert.doesNotMatch(browser + server, /SERVICE_ROLE|SECRET|SUPABASE_KEY\s*=/i);
  assert.match(browser, /createBrowserClient/);
  assert.match(server, /createServerClient/);
  assert.match(server, /cookies\(\)/);
  assert.match(browser, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(browser, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(privateAdmin, /import "server-only"/);
  assert.match(privateAdmin, /SUPABASE_SECRET_KEY/);
  assert.match(privateAdmin, /startsWith\("sb_secret_"\)/);
  assert.match(privateAdmin, /persistSession: false/);
  assert.match(privateAdmin, /autoRefreshToken: false/);
  assert.doesNotMatch(browser + server, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(read('.env.example'), /SUPABASE_SECRET_KEY|sb_secret_/);
});

test('server-only Supabase configuration rejects absent or malformed credentials', async () => {
  const { getServerOnlySupabaseEnv } = await import(pathToFileURL(path.join(root, 'src/lib/supabase/private-admin.ts')).href);
  const publicEnv = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  };
  assert.throws(() => getServerOnlySupabaseEnv(publicEnv), /not configured/);
  assert.throws(() => getServerOnlySupabaseEnv({ ...publicEnv, SUPABASE_SECRET_KEY: '   ' }), /not configured/);
  assert.throws(() => getServerOnlySupabaseEnv({ ...publicEnv, SUPABASE_SECRET_KEY: 'legacy-or-public-key' }), /scoped secret API key/);
  assert.deepEqual(
    getServerOnlySupabaseEnv({ ...publicEnv, SUPABASE_SECRET_KEY: ' sb_secret_example ' }),
    { url: 'https://example.supabase.co', secretKey: 'sb_secret_example' },
  );
});

test('deployment runtime is pinned to the tested Node major', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.engines.node, '24.x');
});

test('site-wide browser hardening headers prevent framing, indexing, referrer leakage, and unused device access', () => {
  const config = read('next.config.ts');
  assert.match(config, /source: "\/:path\*"/);
  assert.match(config, /X-Content-Type-Options/, 'responses must prevent MIME sniffing');
  assert.match(config, /value: "nosniff"/);
  assert.match(config, /X-Frame-Options/, 'the app must not be frameable');
  assert.match(config, /value: "DENY"/);
  assert.match(config, /Referrer-Policy/, 'sensitive routes must not send referrers');
  assert.match(config, /value: "no-referrer"/);
  assert.match(config, /X-Robots-Tag/, 'operational surfaces must not be indexed by search engines');
  assert.match(config, /value: "noindex, nofollow, noarchive"/);
  assert.match(config, /Permissions-Policy/);
  assert.match(config, /camera=\(\), geolocation=\(\), microphone=\(\), payment=\(\), usb=\(\)/);
  assert.match(config, /X-DNS-Prefetch-Control/);
  assert.match(config, /value: "off"/);
  const proxy = read('src/proxy.ts');
  assert.match(proxy, /Content-Security-Policy/, 'every matched application response must set a CSP');
  assert.match(proxy, /configuredSupabaseConnectSources/, 'the CSP must bind external browser connections to the configured Supabase project');
  assert.doesNotMatch(proxy, /\*\.supabase\.co/, 'the CSP must not allow connections to every Supabase tenant');
  assert.match(proxy, /frame-ancestors 'none'/, 'the CSP must independently deny framing');
  assert.match(proxy, /object-src 'none'/, 'the CSP must deny plugin content');
  assert.match(proxy, /style-src-elem 'self'/, 'stylesheet elements must retain the nonce-bound policy');
  assert.match(proxy, /style-src-attr 'unsafe-inline'/, 'React and Next.js style attributes must render without CSP violations');
  assert.doesNotMatch(proxy, /`style-src 'self'/, 'the broad style directive must not weaken both style elements and attributes');
  assert.doesNotMatch(proxy, /if \(!protectsFragmentCredential\) return await updateSession/, 'CSP must not be restricted to registration pages');
  assert.match(proxy, /NextResponse\.json\(apiMutationOriginRejection\.body, apiMutationOriginRejection\.init\);\s*response\.headers\.set\("Content-Security-Policy", policy\);/s, 'cross-origin write rejections must retain the CSP');
  assert.match(proxy, /status: 503, headers: \{ "cache-control": "private, no-store" \}[\s\S]*?response\.headers\.set\("Content-Security-Policy", policy\);/, 'unavailable-operation responses must retain the CSP');
});

test('browser CSP allow-list accepts only one exact configured Supabase origin', async () => {
  const { configuredSupabaseConnectSources } = await import(pathToFileURL(path.join(root, 'src/lib/browser-connect-policy.ts')).href);
  assert.deepEqual(configuredSupabaseConnectSources('https://fnjkwymxpnsqvxtpronk.supabase.co'), [
    'https://fnjkwymxpnsqvxtpronk.supabase.co',
    'wss://fnjkwymxpnsqvxtpronk.supabase.co',
  ]);
  for (const value of [undefined, '', 'http://fnjkwymxpnsqvxtpronk.supabase.co', 'https://fnjkwymxpnsqvxtpronk.supabase.co/path', 'https://user:pass@fnjkwymxpnsqvxtpronk.supabase.co']) {
    assert.deepEqual(configuredSupabaseConnectSources(value), []);
  }
});

test('callback defers exchange to coordinated POST and validates redirect paths centrally', () => {
  const route = read('src/app/auth/callback/route.ts');
  const core = read('src/lib/auth/recovery-auth.ts');
  assert.match(route, /safeAuthNext/);
  assert.match(core, /startsWith\("\/\/"\)/);
  assert.match(core, /startsWith\("\/"\)/);
  assert.doesNotMatch(route, /exchangeCodeForSession/);
  assert.match(read('src/lib/auth/recovery-auth-route.ts'), /exchangeCodeForSession/);
  assert.match(route, /recoveryAuthPost\(request, "code"\)/);
  assert.match(route, /target.hash/);
  assert.match(route, /cache-control", "private, no-store/);
  assert.match(route, /referrer-policy", "no-referrer/);
  assert.match(route, /error=missing_code/);
});

test('sign-in uses publishable browser auth and keeps the prototype route available', () => {
  const page = read('src/app/sign-in/page.tsx');
  const form = read('src/app/sign-in/sign-in-form.tsx');
  assert.match(page, /await searchParams/);
  assert.match(page, /handoffWarning/);
  assert.match(form, /signInWithOtp/);
  // Passwordless remains the default and the only way an account is created.
  // A password is allowed as a sign-in fallback, because the emailed link is a
  // single point of failure: when mail is throttled or filtered, a director at
  // the desk has no way in at all. Account creation by password stays banned.
  assert.doesNotMatch(form, /signUp\s*\(/);
  assert.match(form, /submitCoordinatedAuthentication/);
  assert.match(read('src/lib/auth/recovery-auth-route.ts'), /signInWithPassword/);
  assert.match(form, /shouldCreateUser: true/);
  const bootstrap = read('database/migrations/0067_passwordless_profile_bootstrap.sql');
  assert.match(bootstrap, /after insert on auth\.users/);
  assert.match(bootstrap, /security definer set search_path = ''/);
  assert.match(bootstrap, /revoke all on function app\.create_profile_for_auth_user/);
  assert.doesNotMatch(bootstrap, /insert into app\.(tournament_roles|event_participants|tournament_roster_entries)/);
  assert.match(form, /requestedNext/);
  assert.match(form, /encodeURIComponent\(next\)/);
  assert.match(form, /auth\/callback/);
  assert.match(form, /type="email"/);
  assert.match(form, /passwordless email sign-in/);
  assert.doesNotMatch(form, /Authentication is not connected/);
  assert.match(read('src/app/page.tsx'), /export default|TournamentDashboard/);
});

test('root always uses verified identity and the sample dashboard stays on explicit demo', () => {
  const page = read('src/app/page.tsx');
  const demo = read('src/app/demo/page.tsx');
  assert.doesNotMatch(page, /allowsReviewPrototype|TournamentDashboard|requestHeaders/);
  assert.match(page, /const subject = await getCurrentSubject\(\)/);
  assert.match(page, /if \(subject\)/);
  assert.match(page, /getAccessibleTournaments\(subject\)/);
  assert.match(page, /href="\/sign-in"/);
  assert.match(page, /href="\/demo"/);
  assert.match(page, /SharedDeviceSignOut/);
  assert.match(demo, /Demonstration notice/);
  assert.match(demo, /Sample Data Only/);
  assert.match(demo, /<TournamentDashboard initialScreen=/);
});
test('successful magic-link sessions are visible and cannot request another link', () => {
  const subject = read('src/lib/auth/current-subject.ts');
  const signInPage = read('src/app/sign-in/page.tsx');
  const form = read('src/app/sign-in/sign-in-form.tsx');
  const emailError = read('src/lib/auth/email-sign-in-error.ts');
  assert.match(subject, /server-only/);
  assert.match(subject, /auth\.getClaims\(\)/);
  assert.match(subject, /claims\?\.sub/);
  assert.doesNotMatch(subject, /getSession|getUser/);
  assert.match(signInPage, /getCurrentSubject/);
  assert.match(signInPage, /if \(subject\) redirect\("\/"\)/);
  assert.match(form, /normalizeEmailSignInError/);
  assert.match(emailError, /Too many sign-in emails were requested/);
  assert.match(emailError, /exact reset time is unavailable/);
  assert.doesNotMatch(form + emailError, /wait a few minutes/i);
});

test('the public production demonstration is explicit, synthetic-only, and disconnected from tournament writes', () => {
  const home = read('src/app/page.tsx');
  const demo = read('src/app/demo/page.tsx');
  const dashboard = read('src/app/tournament-dashboard.tsx');
  const proxy = read('src/proxy.ts');
  assert.match(home, /href="\/demo"/);
  assert.match(home, /Explore the demonstration/);
  assert.doesNotMatch(demo, /getCurrentSubject|redirect\(/);
  assert.match(demo, /Public Demonstration · Sample Data Only/);
  assert.match(demo, /Nothing here is saved/);
  assert.match(demo, /href="\/sign-in"/);
  assert.match(demo, /<TournamentDashboard initialScreen=\{initialScreen\} \/>/);
  assert.match(demo, /requestedScreen === "corrections" \? "corrections" : "score"/);
  assert.match(demo, /await connection\(\)/);
  assert.doesNotMatch(demo + dashboard, /fetch\(|XMLHttpRequest|sendBeacon|\.rpc\(|createClient|createServerOnlyAdminClient|supabase|\/api\/v1\//i);
  assert.match(proxy, /"\/demo"/);
  assert.ok(proxy.indexOf('"/demo"') < proxy.indexOf('await updateSession'), 'the public demo must bypass Supabase session refresh');
  assert.match(proxy, /"\/sample\/qualifiers-summary\.pdf"/);
  assert.match(proxy, /"\/rulebook\/acc-rulebook-2025\.pdf"/);
  assert.doesNotMatch(dashboard, /Barb Stevens|Steve Hall|HI-296|Grass Roots|Honolulu|Apr\. 25, 2025/);
  assert.match(dashboard, /Demo Player, DEMO-001/);
});

test('the public qualification sample generator contains only fictional fixtures', () => {
  const generator = read('scripts/create-qualifiers-pdf.py');
  assert.match(generator, /Sample Cribbage Classic - Demo City, ST - January 15, 2030/);
  assert.match(generator, /Example Qualifier One/);
  const resultsBlock = generator.slice(generator.indexOf('results = ['), generator.indexOf('qualifiers = ['));
  const qualifiersBlock = generator.slice(generator.indexOf('qualifiers = ['), generator.indexOf('def styled_table'));
  assert.doesNotMatch(resultsBlock, /High Non-Qualifier/);
  assert.match(qualifiersBlock, /High Non-Qualifier: Example Non-Qualifier/);
  for (const playoffPlayer of ['Example Qualifier Two', 'Example Qualifier Three']) {
    assert.match(resultsBlock, new RegExp(playoffPlayer));
    assert.match(qualifiersBlock, new RegExp(playoffPlayer));
  }
  const rankedRows = ['1. Example Qualifier One', '2. Example Qualifier Two', '3. Example Qualifier Three'];
  let priorIndex = -1;
  for (const row of [...rankedRows, 'High Non-Qualifier']) {
    const rowIndex = qualifiersBlock.indexOf(row);
    assert.ok(rowIndex > priorIndex, `${row} must follow the prior ranked row`);
    priorIndex = rowIndex;
  }
  assert.doesNotMatch(generator, /Casey Kim|Jordan Patel|Alex Morgan|Robin Lee|Grass Roots|Honolulu|April 25, 2025/);
});

test('proxy refreshes claims and protected tournament data requires server membership', () => {
  const proxy = read('src/proxy.ts') + read('src/lib/api/mutation-origin-gateway.ts') + read('src/lib/supabase/proxy.ts');
  const dal = read('src/lib/auth/require-tournament-access.ts');
  const page = read('src/app/tournament/[tournamentId]/page.tsx');
  assert.match(proxy, /getClaims/);
  assert.match(proxy, /invalid_origin/);
  assert.match(proxy, /private, no-store/);
  assert.match(proxy, /operation_unavailable/);
  assert.match(proxy, /await updateSession/);
  assert.match(proxy, /catch/);
  assert.match(proxy, /"\/api\/v1\/:path\*"/);
  assert.match(proxy, /response\.cookies\.set/);
  assert.match(proxy, /refreshedHeaders/);
  assert.match(proxy, /setAll\(cookiesToSet, headersToSet\)/);
  assert.match(proxy, /cache-control/);
  assert.match(proxy, /private, no-store/);
  assert.doesNotMatch(proxy, /x-supabase-session-refresh/);
  assert.match(proxy, /matcher/);
  assert.match(dal, /getClaims/);
  assert.match(dal, /claimsError/);
  assert.doesNotMatch(dal, /getUser/);
  assert.match(dal, /\.rpc\("get_tournament_role"/);
  assert.match(dal, /notFound/);
  assert.match(page, /requireTournamentAccess/);
  assert.match(page, /director.*co_director/);
  assert.match(page, /\/roster/);
});

test('API v1 mutation origin decision rejects only unsafe cross-origin writes', async () => {
  const { apiMutationOriginMatcher, apiMutationOriginRejection, rejectsApiMutationOrigin } = await import(pathToFileURL(path.join(root, 'src/lib/api/mutation-origin-gateway.ts')).href);
  const { isSameOriginRequest } = await import(pathToFileURL(path.join(root, 'src/lib/api/same-origin.ts')).href);
  const requestOrigin = 'https://example.test';
  const check = (pathname, method, origin, fetchSite = null) => rejectsApiMutationOrigin({ pathname, method, origin, fetchSite, requestOrigin });
  assert.equal(apiMutationOriginMatcher, '/api/v1/:path*');
  assert.deepEqual(apiMutationOriginRejection, {
    body: { error: 'invalid_origin' },
    init: { status: 403, headers: { 'cache-control': 'private, no-store' } },
  });
  assert.equal(check('/api/v1/games/example/submissions', 'POST', 'https://other.example'), true);
  assert.equal(check('/api/v1/registration/example.jpg', 'POST', 'https://other.example'), true);
  assert.equal(check('/api/v1/games/example/submissions', 'POST', null), true);
  assert.equal(check('/api/v1/games/example/submissions', 'POST', requestOrigin), false);
  assert.equal(check('/api/v1/games/example/submissions', 'POST', requestOrigin, 'same-origin'), false);
  assert.equal(check('/api/v1/games/example/submissions', 'POST', requestOrigin, 'cross-site'), true);
  assert.equal(check('/api/v1/games/example/submissions', 'GET', null), false);
  assert.equal(check('/api/v1/games/example/submissions', 'HEAD', null), false);
  assert.equal(check('/api/v1/games/example/submissions', 'OPTIONS', null), false);
  assert.equal(check('/api/v2/games/example/submissions', 'POST', 'https://other.example'), false);
  const request = (origin, fetchSite = null) => new Request(requestOrigin + '/api/v1/fixture', { headers: new Headers([["origin", origin], ...(fetchSite ? [["sec-fetch-site", fetchSite]] : [])]) });
  assert.equal(isSameOriginRequest(request(requestOrigin)), true);
  assert.equal(isSameOriginRequest(request(requestOrigin, 'same-origin')), true);
  assert.equal(isSameOriginRequest(request(requestOrigin, 'cross-site')), false);
  assert.equal(isSameOriginRequest(request('https://other.example', 'same-origin')), false);
});

test('every API v1 route uses a private no-store response boundary', () => {
  const routes = collectRoutes(path.join(root, 'src/app/api/v1'));
  assert.ok(routes.length > 0);
  for (const route of routes) {
    const source = fs.readFileSync(route, 'utf8');
    assert.ok(
      /apiJson|privateNoStore/.test(source)||directPrivateResponseBoundary(source)||usesConsyAddonNoStore(route,source)||usesConsyAddonNoStore(route,source,read('src/lib/api/satellite-finance-handlers-v1.ts'),'createSatelliteFinanceHandlersV1','src/lib/api/satellite-finance-handlers-v1.ts')||usesConsyAddonNoStore(route,source,read('src/lib/api/registration-resolution-handlers-v1.ts'),'createRegistrationResolutionHandlersV1','src/lib/api/registration-resolution-handlers-v1.ts')||usesConsyAddonNoStore(route,source,read('src/lib/api/mrp-membership-manual-review-v1.ts'),'createMrpMembershipManualReviewHandlersV1','src/lib/api/mrp-membership-manual-review-v1.ts')||usesGameReopenNoStore(route,source)||usesSharedBootstrapWorkflowNoStore(route,source)||usesSharedPilotNoStore(route,source)||usesSharedMixedNoStore(route,source)||usesSharedRosterNoStore(route,source)||usesSharedReviewedNoStore(route,source)||usesSharedOperationalProviderNoStore(route,source)||usesSharedOperationalAdoptionNoStore(route,source)||usesSharedPrizeProposalNoStore(route,source),
      `${path.relative(root, route)} must use the private no-store response boundary`,
    );
  }
});

test('game correction route audit follows its actual private response factory',()=>{
 const route=path.join(root,'src/app/api/v1/tournaments/[id]/rehearsal/[eventId]/corrections/[startId]/[gameId]/operations/route.ts'),source=fs.readFileSync(route,'utf8'),handler=read('src/lib/api/native-mixed-game-reopen-v1.ts');
 assert.equal(usesGameReopenNoStore(route,source,handler),true);
 assert.equal(usesGameReopenNoStore(route,source.replace('handlers.reconcilePOST','unsafe.POST'),handler),false);
 assert.equal(usesGameReopenNoStore(route,source,handler.replace('private, no-store','public, max-age=60')),false);
 assert.equal(usesGameReopenNoStore(route,source,handler.replace("return json({error:'not_found'},404)","return Response.json({error:'not_found'})")),false);
});

test('shared mixed route response audit follows actual factory wiring and rejects unsafe substitutions',()=>{
 const route=path.join(root,'src/app/api/v1/tournaments/[id]/events/[eventId]/synthetic-mixed-capability/route.ts'),source=fs.readFileSync(route,'utf8');
 assert.equal(usesSharedMixedNoStore(route,source)||usesSharedRosterNoStore(route,source)||usesSharedReviewedNoStore(route,source),true);
 assert.equal(usesSharedMixedNoStore(route,source.replace('handlers.capabilityGET','unsafeHandler')),false);
 assert.equal(usesSharedMixedNoStore(route,source,read('src/lib/api/synthetic-mixed-production.ts').replace('json:apiJson','json:unsafeJson')),false);
 assert.equal(usesSharedMixedNoStore(route,source,'// apiJson withApiFailureBoundary createMixedProductionHandlers'),false);
});

test('operational provider wrappers resolve the actual private response boundary chain',()=>{
 const route=path.join(root,'src/app/api/v1/tournaments/[id]/event-settings-v3/operations/[operationId]/route.ts');
 const source=fs.readFileSync(route,'utf8');
 const production=read('src/lib/api/operational-provider-production-v1.ts');
 const handlers=read('src/lib/api/operational-provider-handlers-v1.ts');
 assert.equal(usesSharedOperationalProviderNoStore(route,source,production,handlers),true);
 assert.equal(usesSharedOperationalProviderNoStore(route,source.replace('handlers.eventSettingsOperationGET','unsafeHandler'),production,handlers),false);
 assert.equal(usesSharedOperationalProviderNoStore(route,source,production.replace('json:apiJson','json:unsafeJson'),handlers),false);
 assert.equal(usesSharedOperationalProviderNoStore(route,source,production.replace('boundary:withApiFailureBoundary','boundary:unsafeBoundary'),handlers),false);
 assert.equal(usesSharedOperationalProviderNoStore(route,source,production,handlers.replace("'private, no-store'","'public, max-age=60'")),false);
 assert.equal(usesSharedOperationalProviderNoStore(route,'// operationalProviderHandlersV1 apiJson withApiFailureBoundary',production,handlers),false);
});

test('prize proposal routes resolve shared no-store wiring and reject unsafe substitutions',()=>{
 const production=read('src/lib/api/playoff-prize-proposal-production-v2.ts'),handlers=read('src/lib/api/playoff-prize-proposal-handlers-v2.ts');
 for(const tail of ['route.ts','operation/route.ts']){
  const route=path.join(root,'src/app/api/v1/tournaments/[id]/events/[eventId]/prize-proposal',tail),source=fs.readFileSync(route,'utf8');
  assert.equal(usesSharedPrizeProposalNoStore(route,source,production,handlers),true);
  assert.equal(usesSharedPrizeProposalNoStore(route,source.replace("'force-dynamic'","'force-static'"),production,handlers),false);
  assert.equal(usesSharedPrizeProposalNoStore(route,source.replace(/=playoffPrizeProposalHandlersV2\./g,'=unsafe.'),production,handlers),false);
  assert.equal(usesSharedPrizeProposalNoStore(route,source,production.replace('json:apiJson','json:unsafeJson'),handlers),false);
  assert.equal(usesSharedPrizeProposalNoStore(route,source,production.replace('boundary:withApiFailureBoundary','boundary:unsafeBoundary'),handlers),false);
  assert.equal(usesSharedPrizeProposalNoStore(route,source,production.replace('json:apiJson','json:apiJson,...unsafeDependencies'),handlers),false);
  assert.equal(usesSharedPrizeProposalNoStore(route,source,production.replace('json:apiJson','json:apiJson,json:unsafeJson'),handlers),false);
  assert.equal(usesSharedPrizeProposalNoStore(route,source,production.replace('./route-boundary.ts','./unsafe-boundary.ts'),handlers),false);
  assert.equal(usesSharedPrizeProposalNoStore(route,source,production,handlers.replaceAll('d.json(','unsafeJson(')),false);
  assert.equal(usesSharedPrizeProposalNoStore(route,source,production,handlers.replaceAll('d.boundary(','unsafeBoundary(')),false);
  assert.equal(usesSharedPrizeProposalNoStore(route,source,'// apiJson withApiFailureBoundary createPlayoffPrizeProposalHandlersV2',handlers),false);
  assert.equal(usesSharedPrizeProposalNoStore(route,'// playoffPrizeProposalHandlersV2 apiJson withApiFailureBoundary',production,handlers),false);
 }
});

test('every API v1 mutation remains behind the shared origin gate and RPC-only data boundary', () => {
  const proxy = read('src/proxy.ts');
  const routes = collectRoutes(path.join(root, 'src/app/api/v1'));
  assert.match(proxy, /rejectsApiMutationOrigin\(/);
  assert.match(proxy, /"\/api\/v1\/:path\*"/);
  assert.ok(routes.length > 0);
  for (const route of routes) {
    const source = fs.readFileSync(route, 'utf8');
    assert.doesNotMatch(source, /\b(?:supabase|admin|client)\.from\(/, `${path.relative(root, route)} must not query an application table directly`);
    if (/export async function POST/.test(source)) {
      assert.ok(/withApiFailureBoundary|catch\s*\{[\s\S]*?apiJson\(\{error:['"](?:temporarily_unavailable|outcome_unknown|unavailable)['"]\},\{status:503\}\)|catch\s*\{[\s\S]*?operation_unavailable/.test(source)||directPrivateUnavailableBoundary(source)||sharedApiUnavailableBoundary(source), `${path.relative(root, route)} must preserve a private unavailable-operation failure boundary`);
    }
  }
});

test('protected screens offer a recovery-preserving sign-out and a safe clear boundary', () => {
  const control = read('src/components/shared-device-sign-out.tsx');
  const storage = read('src/lib/client-session-storage.ts');
  const signOut = read('src/app/auth/sign-out/route.ts');
  const protectedScreens = [
    'src/app/tournament/[tournamentId]/page.tsx',
    'src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx',
    'src/app/tournament/[tournamentId]/corrections/page.tsx',
    'src/app/tournament/[tournamentId]/how-to/page.tsx',
  ].map(read).join('\n');
  assert.match(protectedScreens, /SharedDeviceSignOut/);
  assert.match(control, /countAppSessionStorageRecords/);
  assert.match(control, /fetch\("\/auth\/sign-out"/);
  assert.match(control, /window\.location\.replace\(destination\.toString\(\)\)/);
  assert.match(control, /Sign out is appropriate on a personal device/);
  assert.match(control, /does not delete saved tournament records, personal files, browser history, or other websites&apos; data/);
  assert.match(control, /Clear safe app data and sign out/);
  assert.match(control, /localState\.status !== "safe"/);
  assert.match(signOut, /isSameOriginRequest\(request\)/);
  assert.match(signOut, /private, no-store/);
  assert.match(signOut, /auth\.signOut\(\{ scope: "local" \}\)/);
  assert.doesNotMatch(signOut, /headers\.set\("Clear-Site-Data"/);
  assert.match(control, /beginSafeRecoverySwitch/);
  assert.match(control, /clearRecoveryStorageOwner/);
  assert.match(signOut, /cache-control/);
  assert.doesNotMatch(signOut, /source\.headers\.forEach/);
  assert.match(storage, /"acc-score:"/);
  assert.match(storage, /"acc-correction:"/);
  assert.match(storage, /"registration-operation:"/);
  assert.match(storage, /"manual-roster-operation:"/);
  assert.match(storage, /"roster-csv-operation:"/);
  assert.match(storage, /"qualification-finalization:"/);
  assert.match(storage, /"tournament-setup:"/);
  assert.match(storage, /"tournament-activation:"/);
  assert.match(storage, /"device-recovery:"/);
  assert.match(storage, /storage\.removeItem\(key\)/);
  // Inline review has one render path; every protected screen retains its own sign-out.
  for (const file of ["src/app/tournament/[tournamentId]/page.tsx", "src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx", "src/app/tournament/[tournamentId]/corrections/page.tsx", "src/app/tournament/[tournamentId]/how-to/page.tsx"]) assert.match(read(file), /<SharedDeviceSignOut \/>/);
});

test('shared-device cleanup recognizes the actual registration key and propagates storage failures', async () => {
  const storage = await import(pathToFileURL(path.join(root, 'src/lib/client-session-storage.ts')).href);
  const removed = [];
  const fixture = {
    get length() { return 3; },
    key(index) { return ['registration-operation:opaque-token', 'acc-score:opaque-operation', 'unrelated'][index] ?? null; },
    removeItem(key) { removed.push(key); if (key.startsWith('acc-score:')) throw new Error('storage unavailable'); },
  };
  assert.throws(() => storage.clearAppSessionStorage(fixture), /storage unavailable/);
  assert.deepEqual(removed, ['acc-score:opaque-operation']);
});

test('shared-device cleanup removes manual and CSV roster retry envelopes', async () => {
  const storage = await import(pathToFileURL(path.join(root, 'src/lib/client-session-storage.ts')).href);
  const values = [
    'manual-roster-operation:actor:tournament',
    'roster-csv-operation:actor:tournament',
    'unrelated',
  ];
  const removed = [];
  const fixture = {
    get length() { return values.length; },
    key(index) { return values[index] ?? null; },
    removeItem(key) { removed.push(key); values.splice(values.indexOf(key), 1); },
  };
  storage.clearAppSessionStorage(fixture);
  assert.deepEqual(removed.sort(), [
    'manual-roster-operation:actor:tournament',
    'roster-csv-operation:actor:tournament',
  ]);
});

test('shared-device safe state counts only app-owned retry records', async () => {
  const storage = await import(pathToFileURL(path.join(root, 'src/lib/client-session-storage.ts')).href);
  const fixture = {
    get length() { return 3; },
    key(index) { return ['registration-operation:opaque-token', 'unrelated', 'tournament-setup:actor:event'][index] ?? null; },
  };
  assert.equal(storage.countAppSessionStorageRecords(fixture), 2);
  assert.doesNotMatch(read('src/components/shared-device-sign-out.tsx'), /window\.confirm/);
});

test('ambiguous score submission locks one exact persisted retry envelope', async () => {
  const retry = await import(pathToFileURL(path.join(root, 'src/lib/score-retry-envelope.ts')).href);
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  const envelope = { version: 1, kind: 'submission', actorId: 'actor-1', tournamentId: 'tournament-1', gameId: 'game-1', playerSide: 'a', submissionId: 'submission-1', idempotencyKey: 'operation-1', submissionSlot: 1, winnerSide: 'a', margin: 31 };
  assert.equal(retry.writePendingScoreSubmission(storage, envelope), false, 'uncoordinated writers fail closed; happy path is exercised in the real browser');
  assert.equal(values.size, 0);
  values.set(retry.scoreSubmissionStorageKey('actor-1', 'tournament-1', 'game-1', 'a'), JSON.stringify(envelope));
  assert.deepEqual(retry.readPendingScoreSubmission(storage, 'actor-1', 'tournament-1', 'game-1', 'a'), envelope);
  assert.equal(retry.readPendingScoreSubmission(storage, 'actor-2', 'tournament-1', 'game-1', 'a'), null);
  values.set(retry.scoreSubmissionStorageKey('actor-2', 'tournament-1', 'game-1', 'a'), JSON.stringify(envelope));
  assert.equal(retry.readPendingScoreSubmission(storage, 'actor-2', 'tournament-1', 'game-1', 'a'), null);
  assert.equal(values.has(retry.scoreSubmissionStorageKey('actor-2', 'tournament-1', 'game-1', 'a')), true, 'unknown ownership is preserved, not erased');
  assert.equal(retry.readPendingScoreSubmission(storage, 'actor-1', 'tournament-1', 'game-1', 'b'), null);
  values.set(retry.scoreSubmissionStorageKey('actor-1', 'tournament-1', 'game-1', 'a'), JSON.stringify({ ...envelope, margin: 122 }));
  assert.equal(retry.readPendingScoreSubmission(storage, 'actor-1', 'tournament-1', 'game-1', 'a'), null);
  assert.equal(values.size, 2, 'malformed recovery stays retained and blocks switching');
  assert.deepEqual(retry.pendingSubmissionRecovery(envelope, {id:'different-server-submission',winnerSide:envelope.winnerSide,margin:envelope.margin}), { action: 'conflict', envelope });
  assert.deepEqual(retry.pendingSubmissionRecovery(envelope, null), { action: 'retry', envelope });
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'not_assigned' }, 'game-1', 'submission'), true);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'duplicate_submission' }, 'game-1', 'submission'), true);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'duplicate_submission' }, 'game-1', 'confirmation'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'confirmation_rejected' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'confirmation_rejected' }, 'game-1', 'confirmation'), true);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'duplicate_confirmation' }, 'game-1', 'confirmation'), true);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'wrong-game', code: 'duplicate_submission' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'duplicate_submission', internal_detail: 'mixed' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'unknown_code' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'wrong-game', code: 'not_assigned' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(409, { status: 'rejected', game_id: 'game-1', code: 'not_assigned', submission_id: 'mixed' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(401, { error: 'unauthorized' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(429, { error: 'rate_limited' }, 'game-1', 'submission'), false);
  assert.equal(retry.isDefinitiveScoreMutationFailure(404, { error: 'not_found' }, 'game-1', 'submission'), false);
  assert.match(read('src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx'), /Retry This Same Entry/);
  assert.match(read('src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx'), /could not safely save the offline entry/);
});

test('route callback propagates refreshed cookies and membership function is narrowly granted', () => {
  const callback = read('src/app/auth/callback/route.ts');
  const server = read('src/lib/supabase/server.ts');
  const migration = read('database/migrations/0002_pilot_membership_authorization.sql');
  const envExample = read('.env.example');
  const isolated = read('src/lib/auth/recovery-auth-route.ts');
  assert.match(callback, /recoveryAuthPost/);
  assert.match(isolated, /createRouteClient/);
  assert.match(isolated, /result\.accepted && cookieResponse/);
  assert.match(isolated, /source\.cookies\.getAll/);
  assert.match(callback, /private, no-store/);
  assert.match(server, /const response = new NextResponse\(null\)/);
  assert.doesNotMatch(server, /NextResponse\.next/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /revoke all on function/);
  assert.match(migration, /create or replace function public\.get_tournament_role/);
  assert.match(migration, /grant execute on function public\.get_tournament_role\(uuid\) to authenticated/);
  assert.match(migration, /revoke all on function public\.get_tournament_role\(uuid\) from public, anon/);
  assert.match(migration, /from app\.tournament_roles/);
  assert.doesNotMatch(migration, /grant (select|insert|update|delete|all) on table/i);
  assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_URL=\s*$/m);
  assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\s*$/m);
  assert.doesNotMatch(envExample, /service_role|secret|eyJ[a-zA-Z0-9_-]+\./i);
});

test('legacy public registration is retired before the fragment-only replacement exists', () => {
  const migration = read('database/migrations/0013_public_registration_claims.sql');
  const immutableRepair = read('database/migrations/0016_public_registration_immutable.sql');
  const hardening = read('database/migrations/0017_public_registration_replay_and_rate_limits.sql');
  const fingerprintRepair = read('database/migrations/0018_public_registration_fingerprint_repair.sql');
  const retirement = read('database/migrations/0070_retire_legacy_public_registration_surface.sql');
  assert.match(migration, /add column if not exists registration_status/);
  assert.match(migration, /create table app\.tournament_registration_links/);
  assert.match(migration, /token_hash text not null unique/);
  assert.match(migration, /create table app\.registration_claims/);
  assert.match(migration, /status in \('pending_review', 'needs_review', 'accepted', 'rejected', 'withdrawn'\)/);
  assert.match(migration, /needs_review/);
  assert.match(migration, /registration_status = 'open'/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /unique \(tournament_id, client_operation_id\)/);
  assert.match(migration, /request_fingerprint text not null/);
  assert.match(migration, /jsonb_build_array\('public_registration'/);
  assert.doesNotMatch(migration, /concat_ws\('\|', 'public_registration'/);
  assert.match(migration, /idempotency_conflict/);
  assert.match(migration, /max_claims_per_hour/);
  assert.match(migration, /registration_rate_limited/);
  assert.match(migration, /registration_claims_registration_link_id_idx/);
  assert.match(migration, /revoke all on table app\.registration_claims from anon, authenticated/);
  assert.match(migration, /registration_claims_immutable/);
  assert.match(immutableRepair, /drop trigger if exists registration_claims_immutable/);
  assert.match(hardening, /request_fingerprint/);
  assert.match(hardening, /idempotency_conflict/);
  assert.match(hardening, /registration_capacity_reached/);
  assert.match(hardening, /registration_rate_limited/);
  assert.match(hardening, /registration_claims_link_submitted_at_idx/);
  assert.match(hardening, /drop trigger if exists registration_claims_immutable/);
  assert.match(hardening, /pg_catalog\.pg_constraint/);
  assert.match(hardening, /jsonb_build_array\('public_registration'/);
  assert.doesNotMatch(hardening, /concat_ws\('\|', 'public_registration'/);
  assert.match(fingerprintRepair, /drop trigger if exists registration_claims_immutable/);
  assert.match(fingerprintRepair, /jsonb_build_array\('public_registration'/);
  assert.match(retirement, /legacy registration-link history is incoherent/);
  assert.match(retirement, /set enabled = false/);
  assert.match(retirement, /revoke all on function public\.get_public_registration_context/);
  assert.match(retirement, /revoke all on function public\.submit_public_registration_claim/);
  assert.match(retirement, /drop function public\.get_public_registration_context/);
  assert.match(retirement, /drop function public\.submit_public_registration_claim/);
  assert.doesNotMatch(migration, /insert into app\.(event_participants|tournament_roles|card_scorelines)/);
  for (const file of [
    'src/app/api/v1/registration/[token]/route.ts',
    'src/app/register/[token]/page.tsx',
    'src/app/register/[token]/registration-form.tsx',
    'src/lib/api/public-registration.ts',
  ]) assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must not retain a path-token surface`);
});

test('v2 registration lifecycle stores only digest material and is service-role-only', () => {
  const lifecycle = read('database/migrations/0071_secure_registration_link_lifecycle_v2.sql');
  assert.match(lifecycle, /token_version smallint not null default 1/);
  assert.match(lifecycle, /token_salt bytea/);
  assert.match(lifecycle, /token_digest bytea/);
  assert.match(lifecycle, /octet_length\(token_salt\) = 32/);
  assert.match(lifecycle, /octet_length\(token_digest\) = 32/);
  assert.match(lifecycle, /create table app\.tournament_registration_link_heads/);
  assert.match(lifecycle, /create table app\.registration_link_lifecycle_events/);
  assert.match(lifecycle, /create table app\.registration_link_operation_conflicts/);
  assert.match(lifecycle, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/);
  assert.match(lifecycle, /app\.fixed_32_byte_equal/);
  assert.match(lifecycle, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(lifecycle, /public\.issue_registration_link_v2/);
  assert.match(lifecycle, /public\.rotate_registration_link_v2/);
  assert.match(lifecycle, /public\.close_registration_link_v2/);
  assert.match(lifecycle, /public\.get_registration_link_redemption_material_v2/);
  assert.match(lifecycle, /public\.submit_registration_claim_v2/);
  assert.match(lifecycle, /revoke all on function public\.issue_registration_link_v2[\s\S]*from public, anon, authenticated/);
  assert.match(lifecycle, /grant execute on function public\.issue_registration_link_v2[\s\S]*to service_role/);
  assert.doesNotMatch(lifecycle, /p_token\s+text/i);
  assert.doesNotMatch(lifecycle, /grant execute[\s\S]*to anon, authenticated/);
});

test('director registration-link issuance is a strict same-origin server-only boundary', () => {
  const route = read('src/app/api/v1/tournaments/[id]/registration-links/route.ts');
  const contract = read('src/lib/api/registration-link.ts');
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /registrationLinkManagementEnabled/);
  assert.match(route, /if \(!registrationLinkManagementEnabled\(\)\)/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /registrationContactReadiness/);
  assert.match(route, /get_tournament_setup_workspace/);
  assert.match(route, /registration_contact_required/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /issueRegistrationLink/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE/);
  assert.match(contract, /Object\.keys\(value\)\.length === keys\.length/);
  assert.match(contract, /maxClaims.*<= 2000/);
  assert.match(contract, /maxClaimsPerHour.*<= 1000/);
  assert.match(route, /credential_unavailable/);
  assert.match(route, /status: 201/);
  assert.match(read('src/lib/registration-link-issuer.ts'), /new Date\(value\)\.valueOf\(\) === expected\.valueOf\(\)/);
  assert.match(route, /readRegistrationLinkJson/);
  assert.match(contract, /registrationLinkRequestBodyLimit = 2048/);
  assert.match(contract, /readBoundedJson\(request, registrationLinkRequestBodyLimit\)/);
  assert.doesNotMatch(contract, /request\.text\(\)/);
});

test('registration-link lifecycle conflicts are durable business outcomes, never bearer retries', () => {
  const repair = read('database/migrations/0074_registration_link_conflict_receipts.sql');
  assert.match(repair, /prior_receipt_tournament_id/);
  assert.match(repair, /foreign key \(prior_receipt_id, prior_receipt_tournament_id\)/);
  assert.match(repair, /return jsonb_build_object\('status', 'rejected', 'code', 'idempotency_conflict'\)/);
  assert.match(repair, /return jsonb_build_object\('status', 'rejected', 'code', 'active_link_exists'\)/);
  assert.doesNotMatch(repair, /raise exception using errcode = 'P0001', message = 'idempotency conflict'/);
  assert.doesNotMatch(repair, /raise exception using errcode = 'P0001', message = 'active registration link exists'/);
});

test('director registration-link state read is service-only, strict, and excludes secret material', () => {
  const route = read('src/app/api/v1/tournaments/[id]/registration-links/route.ts');
  const contract = read('src/lib/api/registration-link.ts');
  const migration = read('database/migrations/0075_registration_link_state_reader.sql');
  assert.match(route, /export async function GET/);
  assert.match(route, /get_registration_link_state_v2/);
  assert.match(route, /isRegistrationLinkState/);
  assert.match(route, /registrationLinkManagementEnabled/);
  assert.match(contract, /status: "none"/);
  assert.match(contract, /Object\.keys\(value\)\.length === keys\.length/);
  assert.match(migration, /perform app\.registration_v2_service_only\(\)/);
  assert.match(migration, /role in \('director', 'co_director'\)/);
  assert.match(migration, /revoke all on function public\.get_registration_link_state_v2.*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_registration_link_state_v2.*to service_role/);
  assert.doesNotMatch(migration, /token_salt|token_digest|credential|registration_claims/);
});

test('registration-link state cannot call disabled, retired, or registration-closed links open or expired', () => {
  const repair = read('database/migrations/0077_registration_link_expired_state_repair.sql');
  assert.match(repair, /v_link\.lifecycle_state = 'issued'/);
  assert.match(repair, /v_link\.enabled/);
  assert.match(repair, /v_tournament\.status in \('draft', 'open'\)/);
  assert.match(repair, /v_tournament\.registration_status = 'open'/);
  assert.match(repair, /v_link\.expires_at <= now\(\).*v_tournament\.status in \('draft', 'open'\).*registration_status = 'open' then 'expired'/s);
  assert.match(repair, /else 'closed'/);
});

test('registration-link close is a service-only compare-and-swap with durable safe replays', () => {
  const close = read('database/migrations/0078_registration_link_close_compare_and_swap.sql');
  const headRepair = read('database/migrations/0079_registration_link_close_head_presence_repair.sql');
  assert.match(close, /p_expected_link_id uuid/);
  assert.match(close, /p_expected_version integer/);
  assert.match(close, /v_head\.registration_link_id <> p_expected_link_id/);
  assert.match(close, /v_head\.version <> p_expected_version/);
  assert.match(close, /operation_type <> 'registration_link_close_v3'/);
  assert.match(close, /outcome, response_payload.*\n.*'rejected'/s);
  assert.match(close, /revoke all on function public\.close_registration_link_v2.*from public, anon, authenticated/);
  assert.match(close, /grant execute on function public\.close_registration_link_v2.*to service_role/);
  assert.match(headRepair, /v_head_found := found/);
  assert.match(headRepair, /v_link_found := found/);
  assert.match(headRepair, /not v_head_found or not v_link_found/);
  assert.match(headRepair, /revoke all on function public\.close_registration_link_v2.*from public, anon, authenticated/);
  assert.match(headRepair, /grant execute on function public\.close_registration_link_v2.*to service_role/);
});

test('registration-link rotation is a service-only compare-and-swap that cannot recreate a stale credential', () => {
  const rotate = read('database/migrations/0080_registration_link_rotate_compare_and_swap.sql');
  const retryRepair = read('database/migrations/0081_registration_link_rotate_stable_retry_hash.sql');
  assert.match(rotate, /p_expected_link_id uuid/);
  assert.match(rotate, /p_expected_version integer/);
  assert.match(rotate, /v_head\.registration_link_id <> p_expected_link_id/);
  assert.match(rotate, /v_head\.version <> p_expected_version/);
  assert.match(rotate, /v_head_found := found/);
  assert.match(rotate, /v_previous_found := found/);
  assert.match(rotate, /not v_head_found or not v_previous_found/);
  assert.match(rotate, /operation_type <> 'registration_link_rotate_v3'/);
  assert.match(rotate, /'registration_link_rotate_v3'/);
  assert.match(rotate, /revoke all on function public\.rotate_registration_link_v2.*from public, anon, authenticated/);
  assert.match(rotate, /grant execute on function public\.rotate_registration_link_v2.*to service_role/);
  assert.match(retryRepair, /'registration_link_v2', 'rotate', p_actor_id::text, p_tournament_id::text,[\s\S]*p_expected_link_id::text, p_expected_version, p_expires_at,[\s\S]*p_max_claims, p_max_claims_per_hour, p_operation_id::text/s);
  assert.doesNotMatch(retryRepair.match(/v_hash :=[\s\S]*?perform pg_catalog\.pg_advisory_xact_lock/)?.[0] ?? '', /p_link_id::text|encode\(p_salt|encode\(p_digest/);
});

test('director close route is release-gated, strict, and server-only', () => {
  const route = read('src/app/api/v1/tournaments/[id]/registration-links/close/route.ts');
  const contract = read('src/lib/api/registration-link.ts');
  assert.match(route, /registrationLinkManagementEnabled/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /readRegistrationLinkJson/);
  assert.match(route, /isRegistrationLinkCloseRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /close_registration_link_v2/);
  assert.match(route, /isRegistrationLinkCloseResult/);
  assert.match(contract, /status: "closed"; linkId: string; state: "closed"; version: number/);
  assert.doesNotMatch(route, /from\("tournament_registration_link/);
});

test('director rotation route is release-gated, strict, server-only, and returns a credential only on a new exact receipt', () => {
  const route = read('src/app/api/v1/tournaments/[id]/registration-links/rotate/route.ts');
  const contract = read('src/lib/api/registration-link.ts');
  assert.match(route, /registrationLinkManagementEnabled/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /readRegistrationLinkJson/);
  assert.match(route, /isRegistrationLinkRotateRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /rotateRegistrationLink/);
  assert.match(route, /registrationContactReadiness/);
  assert.match(route, /registration_contact_required/);
  assert.match(route, /credential_unavailable/);
  assert.match(route, /canonicalToken/);
  assert.doesNotMatch(route, /from\("tournament_registration_link/);
  assert.match(contract, /status: "rotated"; linkId: string; state: "open"; expiresAt: string; version: number/);
});

test('director QR registration workspace is role-gated and holds a one-time credential only in memory', () => {
  const page = read('src/app/tournament/[tournamentId]/registration/page.tsx');
  const client = read('src/app/tournament/[tournamentId]/registration/registration-link-client.tsx');
  const workspace = read('src/lib/registration-link-workspace.ts');
  const tournament = read('src/app/tournament/[tournamentId]/page.tsx');
  assert.match(page, /registrationLinkManagementEnabled\(\)/);
  assert.match(page, /requireTournamentAccess/);
  assert.match(page, /\["director", "co_director"\]/);
  assert.match(page, /getRegistrationLinkWorkspace/);
  assert.match(page, /Registration link management is temporarily unavailable/);
  assert.match(page, /No link was created or changed/);
  assert.match(workspace, /import "server-only"/);
  assert.match(workspace, /get_registration_link_state_v2/);
  assert.match(client, /save the current Tournament Setup\. Only the player-facing Director information deliberately entered there can appear on registration/);
  assert.match(client, /QRCode\.toDataURL/);
  assert.match(client, /\/register#\$\{result\.credential\}/);
  assert.match(client, /setOneTimeLink\(null\)/);
  assert.match(client, /isRegistrationLinkState/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
  assert.match(client, /Date\.now\(\) \+ 30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(tournament, /Registration QR code and link/);
  assert.match(tournament, /registrationLinkManagementEnabled\(\)/);
});

test('director link management and public registration have separate default-off release gates', () => {
  const gates = read('src/lib/api/public-registration-v2.ts');
  assert.match(gates, /publicRegistrationEnabled[\s\S]*ACC_PUBLIC_REGISTRATION_V2 === "enabled"/);
  assert.match(gates, /registrationLinkManagementEnabled[\s\S]*ACC_REGISTRATION_LINK_MANAGEMENT_V2 === "enabled"/);
  assert.doesNotMatch(gates.match(/function registrationLinkManagementEnabled[\s\S]*?\n\}/)?.[0] ?? '', /ACC_PUBLIC_REGISTRATION_V2/);
  assert.doesNotMatch(gates.match(/function publicRegistrationEnabled[\s\S]*?\n\}/)?.[0] ?? '', /ACC_REGISTRATION_LINK_MANAGEMENT_V2/);
});

test('registration closure atomically closes its active link and is exposed only through the protected server boundary', () => {
  const close = read('database/migrations/0082_atomic_tournament_registration_close.sql');
  const route = read('src/app/api/v1/tournaments/[id]/registration-close/route.ts');
  const contract = read('src/lib/api/registration-link.ts');
  assert.match(close, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(close, /update app\.tournaments set registration_status = 'closed'/);
  assert.match(close, /update app\.tournament_registration_links[\s\S]*lifecycle_state = 'closed', enabled = false/s);
  assert.match(close, /update app\.tournament_registration_link_heads[\s\S]*state = 'closed', version = version \+ 1/s);
  assert.match(close, /revoke all on function public\.close_tournament_registration_v2.*from public, anon, authenticated/);
  assert.match(close, /grant execute on function public\.close_tournament_registration_v2.*to service_role/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /readRegistrationLinkJson/);
  assert.match(route, /isRegistrationCloseRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /close_tournament_registration_v2/);
  assert.doesNotMatch(route, /from\("tournaments/);
  assert.match(contract, /status: "registration_closed"; registrationClosed: true; linkClosed: boolean/);
});

test('public registration remains release-gated and sends only a derived digest to Supabase', () => {
  const route = read('src/app/api/v1/registration/claims/route.ts');
  const contract = read('src/lib/api/public-registration-v2.ts');
  assert.match(contract, /ACC_PUBLIC_REGISTRATION_V2 === "enabled"/);
  assert.match(route, /if \(!publicRegistrationEnabled\(\)\)/);
  assert.match(route, /parseRegistrationLinkCredential/);
  assert.match(route, /digestRegistrationLinkCredential/);
  assert.match(route, /p_digest: bytea\(digest\)/);
  assert.doesNotMatch(route, /p_credential|canonicalToken.*rpc/);
});

test('registration page clears its fragment before hydration and uses no browser persistence', () => {
  const bootstrap = read('public/registration-bootstrap.js'); const page = read('src/app/register/page.tsx'); const form = read('src/app/register/registration-form.tsx'); const config = read('next.config.ts'); const proxy = read('src/proxy.ts'); const sessionProxy = read('src/lib/supabase/proxy.ts');
  assert.match(bootstrap, /history\.replaceState/); assert.match(page, /publicRegistrationEnabled/); assert.match(page, /if \(!publicRegistrationEnabled\(\)\) notFound\(\)/); assert.match(page, /strategy="beforeInteractive"/); assert.match(form, /delete window\.__accRegistrationCredential/);
  assert.doesNotMatch(bootstrap + form, /localStorage|sessionStorage/); assert.match(config, /Referrer-Policy/);
  assert.doesNotMatch(form, /useState<string/); assert.match(form, /const \[canRegister, setCanRegister\] = useState\(false\)/); assert.match(form, /credentialRef\.current = null/); assert.match(form, /setCanRegister\(false\)/); assert.match(form, /window\.addEventListener\("pagehide", onPageHide\)/); assert.match(form, /requestRef\.current\?\.abort\(\)/); assert.match(form, /dropCredential\(\);/); assert.match(form, /signal: controller\.signal/);
  assert.match(page, /await connection\(\)/); assert.match(proxy, /registrationContentSecurityPolicy/); assert.match(proxy, /request\.nextUrl\.pathname === "\/activate"/); assert.match(proxy, /requestHeaders\.set\("x-nonce", nonce\)/); assert.match(proxy, /response\.headers\.set\("Content-Security-Policy", policy\)/); assert.match(proxy, /'strict-dynamic'/); assert.match(proxy, /base-uri 'none'/); assert.match(sessionProxy, /requestHeaders = new Headers\(request\.headers\)/); assert.match(sessionProxy, /NextResponse\.next\(\{ request: \{ headers: requestHeaders \} \}\)/);
});

test('protected hybrid guidance preserves the independent-entry verification boundary', () => {
  const guide = read('src/app/tournament/[tournamentId]/how-to/page.tsx');
  assert.match(guide, /One paper card and one digital card/);
  assert.match(guide, /digital player submits the result/);
  assert.match(guide, /original paper card/);
  assert.match(guide, /One independent cross checker/);
  assert.match(guide, /second distinct authorized official independently re-enters and confirms both sources/);
  assert.match(guide, /does not count until that exact second confirmation/);
  assert.match(guide, /mismatch stays unresolved/);
  assert.match(guide, /requireTournamentAccess/);
});

test('protected Rulebook reference provides dated cached and online ACC sources without treating quick help as a rule decision', () => {
  const page = read('src/app/tournament/[tournamentId]/rulebook/page.tsx');
  const reference = read('src/app/tournament/[tournamentId]/rulebook/rulebook-reference.tsx');
  const workspace = read('src/app/tournament/[tournamentId]/page.tsx');
  const guide = read('src/app/tournament/[tournamentId]/how-to/page.tsx');
  assert.match(page, /requireTournamentAccess/);
  assert.match(page, /isUuid/);
  assert.match(page, /ACC Rulebook Cached/);
  assert.match(page, /ACC Rulebook Online/);
  assert.match(reference, /Digital player submits their own result/);
  assert.match(reference, /Paper player keeps the original paper scorecard and does not need an app account/);
  assert.match(reference, /assigned cross-checker matches the sources/);
  assert.match(reference, /second distinct authorized non-playing official independently re-enters and confirms both/);
  assert.match(reference, /Missing evidence or a mismatch stays unresolved/);
  assert.match(page, /acc-rulebook-2025\.pdf/);
  assert.match(page, /DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD/);
  assert.match(page, /rel="noreferrer"/);
  assert.match(reference, /Search a Topic or Rule Word/);
  assert.match(reference, /does not replace the dated ACC Rulebook/);
  assert.match(workspace, /\/rulebook/);
  assert.match(guide, /Open ACC Rulebook/);
});

function usesSharedRosterNoStore(route,source){return usesSharedMixedNoStore(route,source,read('src/lib/api/roster-random-draw-production.ts'),{factory:'createRosterDrawProductionHandlers',file:'src/lib/api/roster-random-draw-production.ts',handler:'createRosterDrawHandlers',methods:['workspaceGET','operationGET','POST']});}
test('roster draw wrappers resolve real no-store boundary wiring, not comments',()=>{const route=path.join(root,'src/app/api/v1/tournaments/[id]/random-seating/route.ts'),source=fs.readFileSync(route,'utf8');assert.equal(usesSharedRosterNoStore(route,source),true);assert.equal(usesSharedRosterNoStore(route,source.replace('handlers.workspaceGET','unsafeHandler')),false);});

function usesSharedReviewedNoStore(route,source,production=read('src/lib/api/reviewed-native-seating-production.ts')){return usesSharedMixedNoStore(route,source,production,{factory:'createReviewedNativeProductionHandlers',file:'src/lib/api/reviewed-native-seating-production.ts',handler:'createReviewedNativeHandlers',methods:['GET','operationGET','POST']});}
test('reviewed native wrappers resolve actual private response wiring',()=>{for(const rel of ['src/app/api/v1/tournaments/[id]/reviewed-seating/route.ts','src/app/api/v1/tournaments/[id]/reviewed-seating/operations/[operationId]/route.ts']){const route=path.join(root,rel),source=fs.readFileSync(route,'utf8');assert.equal(usesSharedReviewedNoStore(route,source),true);assert.equal(usesSharedReviewedNoStore(route,source.replace(/handlers\.(GET|operationGET|POST)/g,'unsafeHandler')),false);assert.equal(usesSharedReviewedNoStore(route,source,read('src/lib/api/reviewed-native-seating-production.ts').replace('json: apiJson','json: unsafeJson')),false);assert.equal(usesSharedReviewedNoStore(route,source,'// apiJson withApiFailureBoundary'),false);}});

test('pilot response audit follows the actual disabled production factories',()=>{
 for(const tail of ['cancel','preparation']){
 const route=path.join(root,'src/app/api/v1/tournaments/[id]/rehearsal/[eventId]/'+tail+'/route.ts'),source=fs.readFileSync(route,'utf8'),production=read('src/lib/api/native-mixed-pilot-director-production-v1.ts');
 assert.equal(usesSharedPilotNoStore(route,source,production),true);
 assert.equal(usesSharedPilotNoStore(route,source,production.replaceAll('json:apiJson','json:unsafeJson')),false);
 assert.equal(usesSharedPilotNoStore(route,source.replace("'force-dynamic'","'force-static'"),production),false);
 assert.equal(usesSharedPilotNoStore(route,source.replace(/handlers\./g,'unsafe.'),production),false);
 }
});
test('bootstrap workflow route boundary follows the actual disabled factory',()=>{
 const route=path.join(root,'src/app/api/v1/tournaments/[id]/rehearsal/[eventId]/bootstrap/[mode]/[operationId]/route.ts'),source=fs.readFileSync(route,'utf8'),production=read('src/lib/api/native-mixed-bootstrap-production-v1.ts');
 assert(usesSharedBootstrapWorkflowNoStore(route,source,production));assert(!usesSharedBootstrapWorkflowNoStore(route,source,production.replace('json:apiJson','json:unsafe')));assert(!usesSharedBootstrapWorkflowNoStore(route,source.replace('handlers.writePOST','unsafe'),production));
});

test('consolation receipt route audit follows actual factory and rejects public substitutions',()=>{const pathName=path.join(root,'src/app/api/v1/tournaments/[id]/events/[eventId]/consolation-payments/reconcile/route.ts'),source=fs.readFileSync(pathName,'utf8'),handler=read('src/lib/api/consy-addon-director-handlers-v1.ts');assert.equal(usesConsyAddonNoStore(pathName,source,handler),true);assert.equal(usesConsyAddonNoStore(pathName,source.replace('.reconcilePOST','.unsafePOST'),handler),false);assert.equal(usesConsyAddonNoStore(pathName,source,handler.replace('private, no-store','public, max-age=60')),false);});
