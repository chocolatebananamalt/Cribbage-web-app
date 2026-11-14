import copy, importlib.util, json, unittest, subprocess, os
from pathlib import Path
spec=importlib.util.spec_from_file_location('packet_renderer',Path(__file__).resolve().parents[1]/'scripts/render-mock-paper-packet.py');renderer=importlib.util.module_from_spec(spec);spec.loader.exec_module(renderer)
class PacketIntegrity(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  roster=[{'participantId':f'calculation-person-{i}','tournamentId':f'A-{i}','displayName':f'FICTIONAL PAPER {i}' if i>6 else f'CALCULATION DIGITAL {i}','mode':'paper' if i>6 else 'digital','fictional':i>6}for i in range(1,19)]
  at={i:f'calculation-person-{i}'for i in range(1,19)};moves=[1,3,5,2,7,4,9,6,11,8,13,10,15,12,17,14,18,16];games=[]
  for round in range(1,13):
   for seat in range(1,18,2):games.append({'gameId':f'calculation-game-{round}-{seat}','round':round,'sides':[{'participantId':at[seat],'currentSeat':f'A-{seat}'},{'participantId':at[seat+1],'currentSeat':f'A-{seat+1}'}]})
   at={moves[seat-1]:person for seat,person in at.items()}
  data={'version':'mock-trial-oracle-input-v1','seed':'non-secret-renderer-unit-input','draw':{'anchor':{'participantId':roster[0]['participantId'],'seatId':'A-1'},'roster':roster,'games':games},'digitalResults':[],'funds':[]}
  code="import{buildAnswerKey}from'./scripts/mock-trial-oracle.mjs';let text='';for await(const chunk of process.stdin)text+=chunk;process.stdout.write(JSON.stringify(buildAnswerKey(JSON.parse(text))));"
  completed=subprocess.run([os.environ.get('MOCK_ORACLE_NODE','node'),'--input-type=module','-e',code],input=json.dumps(data),text=True,capture_output=True,check=True,cwd=Path(__file__).resolve().parents[1]);cls.key=json.loads(completed.stdout)
 def test_valid_card_and_plan_bindings(self):renderer.validate_key(self.key)
 def test_missing_card_hash_rejected(self):
  key=copy.deepcopy(self.key);del key['paperCards'][0]['cardHash']
  with self.assertRaises(ValueError):renderer.validate_key(key)
 def test_altered_row_and_matching_totals_do_not_adopt_old_card_hash(self):
  key=copy.deepcopy(self.key);card=key['paperCards'][0];row=card['rows'][0]
  field='plusPoints' if row['plusPoints'] else 'minusPoints';old=row[field];delta=-1 if old in [30,121] else 1;row[field]+=delta;card['totals'][field]+=delta;card['totals']['netSpreadPoints']+=delta if field=='plusPoints' else -delta
  with self.assertRaisesRegex(ValueError,'Paper card binding mismatch'):renderer.validate_key(key)
 def test_changed_plan_rejected(self):
  key=copy.deepcopy(self.key);key['syntheticGamePlan'][0]['spreadPoints']+=1
  with self.assertRaises(ValueError):renderer.validate_key(key)
 def test_whole_file_binding_rejects_ancillary_fund_or_dd_edits(self):
  data=json.dumps(self.key,sort_keys=True).encode();expected=renderer.hashlib.sha256(data).hexdigest();renderer.verify_answer_key_bytes(data,expected)
  key=copy.deepcopy(self.key);key['funds']={'status':'altered'}
  with self.assertRaisesRegex(ValueError,'file SHA256 mismatch'):renderer.verify_answer_key_bytes(json.dumps(key,sort_keys=True).encode(),expected)
  key=copy.deepcopy(self.key);key['digitalDigitalLog'][0]['winnerId']='tampered'
  with self.assertRaisesRegex(ValueError,'file SHA256 mismatch'):renderer.verify_answer_key_bytes(json.dumps(key,sort_keys=True).encode(),expected)
 def test_template_contains_no_outcomes_or_assigned_ids(self):
  key=renderer.blank_key();self.assertEqual(len(key['paperCards']),12)
  for card in key['paperCards']:
   self.assertIsNone(card['tournamentId']);self.assertIsNone(card['totals']);self.assertEqual(card['rows'],[{'round':n} for n in range(1,13)])
 def test_long_fictional_alias_does_not_change_id_or_card_binding(self):
  key=copy.deepcopy(self.key);key['paperCards'][0]['displayName']='W'*160;renderer.validate_key(key)
if __name__=='__main__':unittest.main()
