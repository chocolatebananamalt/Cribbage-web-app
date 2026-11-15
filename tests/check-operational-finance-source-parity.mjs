/** Check an actual disposable-local SQL getter receipt; never reads a provider. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {assembleNativeOperationalFinanceV1} from '../src/lib/finance/operational-finance-native-assembler-v1.ts';
import {validateOperationalFinanceProposalRequestV1} from '../src/lib/finance/operational-finance-proposal-request-v1.ts';
const [sourcePath,requestPath,outputPath]=process.argv.slice(2);
if(!sourcePath||!requestPath||!outputPath)throw Error('Supply local source JSON, request JSON, and result JSON paths.');
const raw=JSON.parse(await readFile(resolve(sourcePath),'utf8'));
const scope={actorId:raw.actorId,tournamentId:raw.tournamentId,eventId:raw.eventId};
const result=assembleNativeOperationalFinanceV1(raw,scope);
if(!result)throw Error('Actual SQL basis differs from independent native assembler.');
const request=JSON.parse(await readFile(resolve(requestPath),'utf8'));
if(!validateOperationalFinanceProposalRequestV1(request,result.basis,result.basisDigest))throw Error('Actual SQL save request fails independent editor and source binding validation.');
await writeFile(resolve(outputPath),JSON.stringify({status:'passed',source:'disposable-local-postgresql',independentBasisParity:true,requestValidated:true,historyRecords:result.basis.workspace.history.length,grossEntryMinor:result.basis.workspace.grossEntryMinor,recordedFundAvailable:false,moneyMoved:false,payoutAuthorized:false},null,2)+'\n','utf8');
