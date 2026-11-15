import assert from 'node:assert/strict';
import ts from 'typescript';

export function assertFictionalGateSource(source, gateName) {
  const tree=ts.createSourceFile('gates.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const aliases=tree.statements.filter(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&/\/integrated-test-target\.ts$/.test(n.moduleSpecifier.text)&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings))
    .flatMap(n=>n.importClause.namedBindings.elements).filter(e=>(e.propertyName?.text??e.name.text)==='integratedTestUiEnabled'&&!e.isTypeOnly).map(e=>e.name.text);
  const declaration=tree.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]).find(n=>ts.isIdentifier(n.name)&&n.name.text===gateName);
  assert(declaration?.initializer&&ts.isArrowFunction(declaration.initializer),gateName+' must be an explicit availability function');
  const body=declaration.initializer.body;
  assert(body.kind===ts.SyntaxKind.FalseKeyword||ts.isCallExpression(body)&&ts.isIdentifier(body.expression)&&aliases.includes(body.expression.text)&&body.arguments.length===0,gateName+' must remain closed or delegate solely to the tested fictional target binding');
}

export function hasServerOnlyImport(source) {
  return ts.createSourceFile('source.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS).statements.some(n=>ts.isImportDeclaration(n)&&!n.importClause&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text==='server-only');
}

/** Exercise real availability exports; this does not authorize an operation. */
export function assertFictionalTargetAvailability(gates) {
  const local = {
    NEXT_PUBLIC_CRIBBAGE_TEST_APP: 'fictional',
    NEXT_PUBLIC_SUPABASE_URL: 'https://localhost:54321',
    NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL: 'https://localhost:54321',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public',
    SUPABASE_SECRET_KEY: 'sb_secret_fixture',
  };
  const keys = [...Object.keys(local), 'VERCEL_ENV'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    for (const gate of gates) assert.equal(gate(), false, 'unconfigured target is closed');
    Object.assign(process.env, local);
    for (const gate of gates) assert.equal(gate(), true, 'explicit fictional target supplies availability');
    process.env.VERCEL_ENV = 'production';
    for (const gate of gates) assert.equal(gate(), false, 'Production cannot use test availability');
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL = 'https://wrong.invalid';
    for (const gate of gates) assert.equal(gate(), false, 'mismatched target is closed');
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
