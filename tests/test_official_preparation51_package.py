"""Source-integrity checks; these do not prove the CLI transaction protocol."""
from pathlib import Path
import hashlib,json,sys,unittest
sys.path.insert(0,str(Path(__file__).parent/'helpers'))
from atomic_sql_source import without_transactions,statements,code

class OfficialPreparationPackage(unittest.TestCase):
 def setUp(self):
  self.manifest=json.loads(Path('database/release-packages/native-preparation51/manifest.json').read_text())
  self.source=Path('test-results/native-mixed-bootstrap-atomic51-20261107/closed-install.sql').read_bytes()
  self.candidate=Path(self.manifest['file']).read_bytes()
 def test_hashes(self):
  self.assertEqual(hashlib.sha256(self.source).hexdigest(),self.manifest['sourceAtomicSha256'])
  self.assertEqual(hashlib.sha256(self.candidate).hexdigest(),self.manifest['sha256'])
 def test_only_outer_transaction_removed(self):
  body,removed=without_transactions(self.source.decode())
  self.assertEqual(removed,{'beginsRemoved':1,'commitsRemoved':1})
  header='-- Local preparation package; no hosted application or enablement authorized.\n-- The official migration runner must supply the sole transaction boundary.\n-- No explicit BEGIN/COMMIT: source bodies and final379 revokes remain intact.\n'
  self.assertEqual(self.candidate,(header+body).encode())
 def test_no_inner_commit_or_begin(self):
  self.assertFalse(any(code(s).lower()in('begin;','commit;')for s in statements(self.candidate.decode())))
 def test_final_privileges_preserved(self):
  tail=self.candidate.decode().split('-- FINAL_CLOSED_PRIVILEGES',1)[1]
  self.assertEqual(tail.count('revoke all on function '),379)
  self.assertNotIn('grant execute',tail.lower())
 def test_release_is_held(self):
  self.assertEqual(self.manifest['status'],'STAGING_SCHEMA_AND_PREPARATION_PREVIEW_READY_COHORT_CLOSED')
  self.assertTrue(self.manifest['restoredActualHistoryContinuityVerified'])
  restored=json.loads(Path(self.manifest['restoredActualHistoryCompatibilityReport']).read_text())
  self.assertTrue(restored['verified'] and restored['localOnly'])
  self.assertFalse(restored['hostedChanges'])
  proof=restored['candidateTest']
  self.assertEqual(proof['candidateSha256'],self.manifest['sha256'])
  self.assertTrue(proof['passed'] and proof['oldHistoryExact'] and proof['repeatNoOp'] and proof['oldRowsExact'])
  self.assertEqual((proof['historyBefore'],proof['historyAfter']),(292,293))
  self.assertTrue(proof['baseline']['actualNonSuperuserSession'])
  self.assertEqual(proof['effectiveTableColumnDenials'],354)
  self.assertTrue(restored['cleanup']['IndependentCleanupVerified'] and restored['cleanup']['ArchiveHashUnchanged'])
  self.assertFalse(self.manifest['requiresOfficialRunnerAtomicityProof'])
  self.assertTrue(self.manifest['candidateInstallationVerified'])
  self.assertTrue(self.manifest['hostedApplication'])
  self.assertTrue(self.manifest['realStagingHistoryContinuityVerified'])
  self.assertTrue(self.manifest['managedNonSuperuserVerified'])
  installed=json.loads(Path(self.manifest['candidateInstallationEvidence']).read_text())
  self.assertTrue(installed['fullCandidateVerified'] and installed['cliCleanupVerified'] and installed['databaseAndVolumeCleanupVerified'])
  self.assertEqual(installed['exactCliFileSha256'],self.manifest['sha256'])
  self.assertEqual(installed['effectiveNewTableAndColumnDenials'],354)
  self.assertTrue(installed['capturedRoleModelVerified'])
  self.assertFalse(installed['roleBefore']['isSuper'])
  self.assertFalse(installed['roleAfter']['isSuper'])
  self.assertTrue(self.manifest['capturedNonSuperuserModelVerified'])
  report=json.loads(Path(self.manifest['officialCliAtomicityProbe']).read_text())
  self.assertTrue(report['passed'] and report['cleanupVerified'])
  self.assertEqual(report['network'],'none')
  self.assertEqual(len(report['checks']),4)
  hosted=json.loads(Path(self.manifest['hostedInstallationEvidence']).read_text())
  self.assertTrue(hosted['schemaInstalledVerified'] and hosted['allFunctionDefinitionsOwnersACLsMatch'])
  self.assertEqual(hosted['historyCount'],293)
  self.assertTrue(hosted['codeDeployment'])
  self.assertFalse(hosted['cohortEnabled'] or hosted['productionChanges'])
  self.assertEqual(hosted['publicationStatus'],'PUBLIC_SOURCE_COMMITTED_CI_PASSED_PREVIEW_READY_COHORT_CLOSED')
  self.assertTrue(self.manifest['codeDeployment'])
  release=json.loads(Path(self.manifest['previewReleaseEvidence']).read_text())
  self.assertEqual(release['deploymentState'],'READY')
  self.assertTrue(all(x['conclusion']=='success' for x in release['ci']))
  self.assertFalse(release['productionChanged'] or release['cohortActivated'])
  for key in ('cohortOrAccessCreation',):self.assertFalse(self.manifest[key])

if __name__=='__main__':unittest.main()
