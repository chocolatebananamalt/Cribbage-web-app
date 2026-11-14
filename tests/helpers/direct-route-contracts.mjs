import ts from 'typescript';

const parse = source => ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function nodes(source, predicate) {
  const tree = parse(source), found = [];
  const visit = node => { if (predicate(node, tree)) found.push(node); ts.forEachChild(node, visit); };
  visit(tree); return {tree, found};
}

/** Recognize actual Response calls using an immutable private cache header. */
export function directPrivateResponseBoundary(source) {
  const {tree, found: declarations} = nodes(source, n => ts.isVariableDeclaration(n) && n.name.getText() === 'headers');
  if (declarations.length !== 1) return false;
  const value = declarations[0].initializer;
  if (!value || !ts.isObjectLiteralExpression(value) || !value.properties.some(p => ts.isPropertyAssignment(p)
    && p.name.getText(tree).replace(/['"]/g, '') === 'cache-control' && ts.isStringLiteral(p.initializer)
    && p.initializer.text === 'private, no-store')) return false;
  if (/headers\s*(?:\[.*?\]|\.[a-zA-Z]+)\s*=|headers\.(?:set|delete|append)\(/.test(source)) return false;
  const {found: calls} = nodes(source, n => ts.isCallExpression(n) && n.expression.getText() === 'Response.json'
    || ts.isNewExpression(n) && n.expression.getText() === 'Response');
  if (!calls.length) return false;
  return calls.every(call => {
    const options = call.arguments?.[1];
    return options && ts.isObjectLiteralExpression(options) && options.properties.some(p =>
      ts.isShorthandPropertyAssignment(p) && p.name.text === 'headers'
      || ts.isPropertyAssignment(p) && p.name.getText(tree) === 'headers'
        && (ts.isIdentifier(p.initializer) && p.initializer.text === 'headers'
          || ts.isObjectLiteralExpression(p.initializer) && p.initializer.properties.some(h => ts.isSpreadAssignment(h) && h.expression.getText(tree) === 'headers')));
  });
}

export function directPrivateUnavailableBoundary(source) {
  if (!directPrivateResponseBoundary(source)) return false;
  const {found: wrappers}=nodes(source,n=>ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&ts.isArrowFunction(n.initializer)&&ts.isCallExpression(n.initializer.body)&&n.initializer.body.expression.getText()==='Response.json');
  return unavailableCatch(source,new Set(['Response.json',...wrappers.map(n=>n.name.text)]));
}

function unavailableCatch(source,callees){
  const {tree,found}=nodes(source,n=>ts.isCatchClause(n));
  return found.some(clause=>{
    let accepted=false;
    const visit=n=>{
      if(ts.isReturnStatement(n)&&n.expression&&ts.isCallExpression(n.expression)&&callees.has(n.expression.expression.getText(tree))){
        const [body,options]=n.expression.arguments;
        const error=body&&ts.isObjectLiteralExpression(body)&&body.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(tree)==='error');
        const status=options&&(ts.isNumericLiteral(options)?options.text:ts.isObjectLiteralExpression(options)?options.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(tree)==='status')?.initializer?.getText(tree):null);
        if(error&&ts.isStringLiteral(error.initializer)&&['operation_unavailable','temporarily_unavailable','outcome_unknown','unavailable'].includes(error.initializer.text)&&status==='503')accepted=true;
      }
      ts.forEachChild(n,visit);
    };visit(clause);return accepted;
  });
}

export function sharedApiUnavailableBoundary(source){
  const tree=parse(source);
  const imported=tree.statements.some(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&/\/route-boundary(?:\.ts)?$/.test(n.moduleSpecifier.text)&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)&&n.importClause.namedBindings.elements.some(e=>e.name.text==='apiJson'));
  return imported&&unavailableCatch(source,new Set(['apiJson']));
}

// Follow the POST request through local named helpers and the known boundary
// callback. Uncalled functions and unrelated GET readers do not count.
function postContexts(source) {
  const tree=parse(source), definitions=new Map();
  const discover=n=>{if(ts.isFunctionDeclaration(n)&&n.name)definitions.set(n.name.text,n);if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&ts.isFunctionLike(n.initializer))definitions.set(n.name.text,n.initializer);ts.forEachChild(n,discover);};discover(tree);
  const root=definitions.get('POST');if(!root||!root.parameters[0]||!ts.isIdentifier(root.parameters[0].name))return{tree,contexts:[]};
  const contexts=[],seen=new Set(),queue=[{fn:root,aliases:new Set([root.parameters[0].name.text]),booleans:new Map(),parent:null,via:null}];
  while(queue.length){const context=queue.shift(),key=context.fn.pos+':'+[...context.aliases].sort().join()+':'+JSON.stringify([...context.booleans]);if(seen.has(key))continue;seen.add(key);contexts.push(context);context.calls=[];context.ifs=[];
    const visit=n=>{if(ts.isFunctionLike(n))return;if(ts.isIfStatement(n))context.ifs.push(n);if(ts.isCallExpression(n)){
      context.calls.push(n);const name=n.expression.getText(tree),target=definitions.get(name);
      if(target&&target!==context.fn){const aliases=new Set(),booleans=new Map();target.parameters.forEach((p,i)=>{if(!ts.isIdentifier(p.name))return;const argument=n.arguments[i];if(argument&&ts.isIdentifier(argument)&&context.aliases.has(argument.text))aliases.add(p.name.text);if(argument?.kind===ts.SyntaxKind.TrueKeyword||argument?.kind===ts.SyntaxKind.FalseKeyword)booleans.set(p.name.text,argument.kind===ts.SyntaxKind.TrueKeyword);else if(argument&&ts.isIdentifier(argument)&&context.booleans.has(argument.text))booleans.set(p.name.text,context.booleans.get(argument.text));});if(aliases.size)queue.push({fn:target,aliases,booleans,parent:context,via:n});}
      if(name==='withApiFailureBoundary')for(const argument of n.arguments)if(ts.isArrowFunction(argument)||ts.isFunctionExpression(argument))queue.push({fn:argument,aliases:new Set(context.aliases),booleans:new Map(context.booleans),parent:context,via:n});
    }ts.forEachChild(n,visit);};visit(context.fn.body);
  }return{tree,contexts};
}

export function directBoundedBodyReader(source) {
  const {tree,contexts}=postContexts(source), readers = new Map();
  for (const n of tree.statements) {
    if (!ts.isImportDeclaration(n) || !ts.isStringLiteral(n.moduleSpecifier)
      || !/\/(?:bounded-json|route-boundary|registration-link)(?:\.ts)?$/.test(n.moduleSpecifier.text)
      || !n.importClause?.namedBindings || !ts.isNamedImports(n.importClause.namedBindings)) continue;
    for (const e of n.importClause.namedBindings.elements) if (/^read(?:Small|Medium|Large|Bounded|RegistrationLink)Json$/.test(e.propertyName?.text ?? e.name.text)) readers.set(e.name.text,e.propertyName?.text??e.name.text);
  }
  return contexts.some(context=>context.calls.some(n=>readers.has(n.expression.getText(tree))&&n.arguments[0]&&ts.isIdentifier(n.arguments[0])&&context.aliases.has(n.arguments[0].text)
    &&(readers.get(n.expression.getText(tree))!=='readBoundedJson'||n.arguments.length===2&&ts.isNumericLiteral(n.arguments[1])&&+n.arguments[1].text>0&&+n.arguments[1].text<=8*1024*1024)));
}

/** Parameter spelling is irrelevant, but an actual imported call before a
 * client factory is required. Comments do not satisfy this inventory. */
export function directOriginBeforeClient(source) {
  const {tree,contexts}=postContexts(source);
  if (!tree.statements.some(n => ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)
    && /\/same-origin(?:\.ts)?$/.test(n.moduleSpecifier.text) && n.importClause?.namedBindings
    && ts.isNamedImports(n.importClause.namedBindings) && n.importClause.namedBindings.elements.some(e => e.name.text === 'isSameOriginRequest'))) return false;
  const abrupt=n=>!!n&&(ts.isReturnStatement(n)||ts.isThrowStatement(n)||ts.isBlock(n)&&n.statements.length>0&&abrupt(n.statements.at(-1))||ts.isIfStatement(n)&&abrupt(n.thenStatement)&&abrupt(n.elseStatement));
  const guards=new Map();let actualGuard=false;
  for(const context of contexts){const origin=n=>ts.isCallExpression(n)&&n.expression.getText(tree)==='isSameOriginRequest'&&n.arguments.length===1&&ts.isIdentifier(n.arguments[0])&&context.aliases.has(n.arguments[0].text);
    const evaluate=n=>{if(ts.isParenthesizedExpression(n))return evaluate(n.expression);if(origin(n))return false;if(n.kind===ts.SyntaxKind.TrueKeyword)return true;if(n.kind===ts.SyntaxKind.FalseKeyword)return false;if(ts.isIdentifier(n)&&context.booleans.has(n.text))return context.booleans.get(n.text);if(ts.isPrefixUnaryExpression(n)&&n.operator===ts.SyntaxKind.ExclamationToken){const v=evaluate(n.operand);return v===null?null:!v;}if(ts.isBinaryExpression(n)){const left=evaluate(n.left),right=evaluate(n.right);if(n.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken)return left===false||right===false?false:left===true&&right===true?true:null;if(n.operatorToken.kind===ts.SyntaxKind.BarBarToken)return left===true||right===true?true:left===false&&right===false?false:null;}return null;};
    const valid=context.ifs.filter(statement=>{let contains=false;const visit=n=>{if(origin(n))contains=true;ts.forEachChild(n,visit);};visit(statement.expression);if(!contains)return false;const value=evaluate(statement.expression);if(!(value===true&&abrupt(statement.thenStatement)||value===false&&abrupt(statement.elseStatement)))return false;
      let child=statement;for(let parent=statement.parent;parent&&parent!==context.fn.body;child=parent,parent=parent.parent){if(ts.isIfStatement(parent)){const outer=evaluate(parent.expression);if(!(outer===true&&parent.thenStatement===child||outer===false&&parent.elseStatement===child))return false;}if(ts.isIterationStatement(parent,false)||ts.isSwitchStatement(parent))return false;}return true;
    });guards.set(context,valid);if(valid.length)actualGuard=true;
  }
  if(!actualGuard)return false;
  const guarded=(context,position)=>guards.get(context).some(guard=>guard.end<position)||(context.parent?guarded(context.parent,context.via.pos):false);
  return contexts.every(context=>context.calls.filter(n=>/^(?:createClient|createServerOnlyAdminClient)$/.test(n.expression.getText(tree))).every(call=>guarded(context,call.pos)));
}
