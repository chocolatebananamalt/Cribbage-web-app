"""Local simulation-only packet renderer. No app imports, network or writes except NEW output files."""
import argparse, hashlib, json, re
from functools import partial
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfgen.canvas import Canvas
from pypdf import PdfReader
VERSION='fictional-paper-packet-v1'
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='PacketBody',fontName='Helvetica',fontSize=12,leading=16,spaceAfter=9))
styles.add(ParagraphStyle(name='PacketSmall',fontName='Helvetica',fontSize=9,leading=12,spaceAfter=6))
styles.add(ParagraphStyle(name='PacketHeading',fontName='Helvetica-Bold',fontSize=19,leading=23,spaceAfter=12))
styles.add(ParagraphStyle(name='PacketCenter',fontName='Helvetica-Bold',fontSize=14,leading=18,alignment=TA_CENTER,spaceAfter=8))
def para(text,style='PacketBody'):return Paragraph(escape(str(text)).replace('\n','<br/>'),styles[style])
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def amount(cents):return f'${cents/100:,.2f}'
def number(value):return '' if value is None or value==0 else f'{value:02d}'
def signed(value):return '' if value is None else f'{value:+d}' if value else '0'
def integer(value):return isinstance(value,int) and not isinstance(value,bool)
def validate_key(key):
    if not isinstance(key,dict) or key.get('version')!='independent-18-mock-oracle-v1' or not re.fullmatch('[a-f0-9]{64}',key.get('planHash','')):raise ValueError('A bound independent oracle answer-key is required')
    for field in ['inputHash','drawHash','seedHash','planHash']:
        if not re.fullmatch('[a-f0-9]{64}',str(key.get(field,''))):raise ValueError('Canonical source hash required')
    plan={'version':key['version'],'drawHash':key['drawHash'],'seedHash':key['seedHash'],'syntheticGamePlan':key.get('syntheticGamePlan')}
    if not isinstance(plan['syntheticGamePlan'],list) or digest(plan)!=key['planHash']:raise ValueError('Synthetic plan binding mismatch')
    cards=key.get('paperCards')
    if not isinstance(cards,list) or len(cards)!=12:raise ValueError('Exactly12 fictional paper cards required')
    seen=set()
    for card in cards:
        if card.get('mode')!='paper' or card.get('fictional') is not True or not re.fullmatch('[A-Z]-(?:[1-9]|1[0-8])',card.get('tournamentId','')) or card['tournamentId'] in seen:raise ValueError('Invalid/duplicate fictional paper identity')
        seen.add(card['tournamentId']);rows=card.get('rows')
        if not isinstance(rows,list) or len(rows)!=12 or sorted(r.get('round',0) for r in rows)!=list(range(1,13)):raise ValueError('All12 paper rows required')
        points=wins=plus=minus=0
        for row in rows:
            gp,p,m=row.get('gamePoints'),row.get('plusPoints'),row.get('minusPoints')
            if row.get('kind') not in ['PP','PD'] or row.get('synthetic') is not True or not all(integer(n) for n in [gp,p,m]) or not (0<=p<=121 and 0<=m<=121) or (p>0)==(m>0):raise ValueError('Invalid scripted paper row')
            expected=0 if m>0 else 3 if p>=31 else 2
            if gp!=expected:raise ValueError('Independent paper row game-point mismatch')
            if not re.fullmatch('[A-Z]-(?:[1-9]|1[0-8])',str(row.get('currentSeat',''))) or not re.fullmatch('[A-Z]-(?:[1-9]|1[0-8])',str(row.get('opponentTournamentId',''))):raise ValueError('Invalid seat/opponent ID')
            points+=gp;wins+=p>0;plus+=p;minus+=m
        expected={'knownGames':12,'pendingGames':0,'gamePoints':points,'wins':wins,'plusPoints':plus,'minusPoints':minus,'netSpreadPoints':plus-minus}
        if card.get('totals')!=expected:raise ValueError('Independent PDF tally disagrees with oracle card totals')
        if not isinstance(card.get('displayName'),str) or not card['displayName'].strip() or len(card['displayName'])>160 or re.search(r'[\x00-\x1f\x7f]',card['displayName']):raise ValueError('Invalid fictional name')
        binding={field:card[field] for field in ['participantId','tournamentId','rows','totals']}
        binding.update(version=key['version'],planHash=key['planHash'])
        if not re.fullmatch('[a-f0-9]{64}',str(card.get('cardHash',''))) or digest(binding)!=card['cardHash']:raise ValueError('Paper card binding mismatch')
    return key

def blank_key():
    return {'version':VERSION,'template':True,'paperCards':[{'displayName':f'FICTIONAL PAPER {i:02d}','tournamentId':None,'rows':[{'round':n} for n in range(1,13)],'totals':None,'cardHash':None} for i in range(1,13)],'digitalDigitalLog':[],'funds':{'status':'not-configured','reports':[]},'claims':{'moneyMoved':False,'independentWitnessClaimed':False}}

def verify_answer_key_bytes(data,expected_sha256):
    actual=hashlib.sha256(data).hexdigest()
    if not re.fullmatch('[a-f0-9]{64}',str(expected_sha256)) or actual!=expected_sha256:raise ValueError('Answer-key file SHA256 mismatch')
    key=json.loads(data.decode('utf-8'));validate_key(key);return key,actual

def render(key,output,calculation_sample=False,source_file_sha256=None):
    template=key.get('template') is True
    if not template:
        validate_key(key)
        if not re.fullmatch('[a-f0-9]{64}',str(source_file_sha256)):raise ValueError('Verified answer-key file binding required')
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    binding='UNBOUND TEMPLATE - actual random draw not supplied' if template else key['planHash']
    story=[]
    def page(canvas,doc):
        canvas.saveState();canvas.setFillColor(colors.black);canvas.rect(36,742,540,24,fill=1,stroke=0);canvas.setFillColor(colors.white);canvas.setFont('Helvetica-Bold',12);canvas.drawCentredString(306,750,'LAYOUT SAMPLE - NOT AN EVENT DRAW' if calculation_sample else 'SIMULATION ONLY - FICTIONAL PAPER EVIDENCE')
        canvas.setFillColor(colors.black);canvas.setFont('Helvetica',8);canvas.drawString(36,26,'No official results, payment, physical-play or independent-witness claim.');canvas.drawRightString(576,26,f'Page {doc.page}');canvas.restoreState()
    story += [para('18-player mock: fictional paper-card packet','PacketHeading'),para('UNBOUND TEMPLATE' if template else 'CALCULATION SAMPLE - NOT EVENT DRAW' if calculation_sample else 'DRAW-BOUND SCRIPTED PACKET','PacketCenter'),para('Six Digital participants and twelve fictional Paper identities. Twelve qualifying games per identity. Actual seating and digital/digital results must come from the eventual draw and user-supplied outcomes.'),para('This tool never selects the real digital/digital winner. Missing digital/digital results remain pending. Paper/paper and paper/digital entries are synthetic scripts; they are not evidence that a physical game was played.'),para('Packet binding: '+binding,'PacketSmall')]
    if not template:
        pending=sum(r.get('winnerId') is None for r in key['digitalDigitalLog'])
        story += [para(f'{len(key["digitalDigitalLog"])} scheduled Digital/Digital games; {pending} result inputs still pending.'),para('Answer-key file SHA256: '+source_file_sha256,'PacketSmall'),para('Draw hash: '+key.get('drawHash',''),'PacketSmall'),para('Input revision hash: '+key.get('inputHash',''),'PacketSmall')]
    story += [para('How to use this packet','PacketHeading'),para('1. Do not assign these blank templates until the actual draw is supplied. A bound packet prints the fixed starting Tournament ID and the current seat for each round.'),para('2. Keep each fictional card with its fictional Tournament ID while moving it to the current seat shown for the next round. Do not replace Tournament IDs with current seat numbers or ACC numbers.'),para('3. PP means scripted Paper/Paper; PD means scripted Paper/Digital. DD results come from the real played games and both players use their own accounts. Use only the separately reviewed mixed-simulation workflow for fictional evidence.'),para('4. Compare the two sides independently. Leave all check/review initials blank until a person actually performs that step. This packet performs no app confirmation, review, score entry or payment.'),para('Physical-layout limit: one opposed odd/even 18-seat arrangement with Seat1 anchor. Room capacity and walking paths still require a real walkthrough. Payout policy remains unresolved unless separately reviewed.','PacketSmall'),PageBreak()]
    head=['Game','Current\nseat','Opponent\nTournament ID','Type','Game\npoints','+ Spread\npoints','- Spread\npoints']
    widths=[40,68,110,42,64,108,108]
    for index,card in enumerate(key['paperCards'],1):
        story += [para(f'FICTIONAL PAPER CARD {index:02d}','PacketHeading'),para('Fictional alias: '+(card['displayName'][:64]+('...' if len(card['displayName'])>64 else '')),'PacketBody'),para('Starting Tournament ID#: '+(card['tournamentId'] or '________________'),'PacketCenter'),para('SCRIPTED FICTIONAL CARD - not a player attestation.','PacketSmall')]
        rows=[[para(h,'PacketSmall') for h in head]]
        for row in sorted(card['rows'],key=lambda r:r['round']):
            rows.append([str(row['round']),row.get('currentSeat',''),row.get('opponentTournamentId',''),row.get('kind',''),'' if template else str(row['gamePoints']),'' if template else number(row['plusPoints']),'' if template else number(row['minusPoints'])])
        totals=card.get('totals')
        rows.append(['TOTAL - scripted entries only','','','', '' if template else str(totals['gamePoints']),'' if template else number(totals['plusPoints']),'' if template else number(totals['minusPoints'])])
        rows.append(['NET SPREAD POINTS','','','','','' if template else signed(totals['netSpreadPoints']),''])
        table=Table(rows,colWidths=widths,rowHeights=[36]+[29]*12+[32,32],hAlign='LEFT')
        table.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.7,colors.black),('FONTNAME',(0,1),(-1,-1),'Helvetica'),('FONTSIZE',(0,1),(-1,-1),14),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ALIGN',(0,1),(-1,-1),'CENTER'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eeeeee')),('SPAN',(0,13),(3,13)),('SPAN',(0,14),(4,14)),('SPAN',(5,14),(6,14)),('FONTNAME',(0,13),(-1,14),'Helvetica-Bold'),('FONTSIZE',(0,13),(3,13),11),('ALIGN',(0,13),(3,13),'LEFT')]))
        story += [table,Spacer(1,10),para('Checker initials: ____________   Date: ____________   (blank until actually checked)','PacketSmall'),para('GP is game points: 2 for a normal win, 3 for a skunk win, 0 for a loss. Spread columns contain positive magnitudes; net spread is signed. PP/PD entries are scripted, never independently witnessed by this tool.','PacketSmall'),para('Card binding: '+(card.get('cardHash') or 'unbound - no scores or opponents preassigned'),'PacketSmall'),PageBreak()]
    story += [para('Digital/Digital result capture','PacketHeading'),para('Record the actual game result after play. Do not choose winners to match an answer key. Supplied values are inputs, not proof of app verification. No generated DD outcome is provided.')]
    log=key.get('digitalDigitalLog',[])
    data=[['Game ID / round','Starting ID A','Starting ID B','Winner ID','Spread points']]
    for row in log:
        data.append([f'{row["gameId"]}\nGame {row["round"]}',row['sides'][0]['tournamentId'],row['sides'][1]['tournamentId'],next((side['tournamentId'] for side in row['sides'] if side['participantId']==row.get('winnerId')),''),str(row['spreadPoints']) if row.get('spreadPoints') is not None else ''])
    if template:data += [['','','','',''] for _ in range(15)]
    table=Table([[para(x,'PacketSmall') for x in row] for row in data],colWidths=[170,95,95,90,90],repeatRows=1,hAlign='LEFT');table.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.7,colors.black),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eeeeee'))]));story += [table,para('The eventual draw determines the number of DD games (at most15 distinct pairs among six Digital people). Blank lines are not scheduled games.','PacketSmall'),PageBreak()]
    story += [para('Independent reconciliation checklist','PacketHeading'),para('Scores: for all18 cards together, wins equal known games; total game points equal two per known game plus one per skunk; positive spread equals negative spread and the net sum is zero. The twelve-paper-card subset alone need not have net zero because PD counterparts are Digital.'),para('Standings: compare game points, games won, net spread points, then positive spread points. Equal numeric records stay tied pending the applicable head-to-head/deciding-game process. A card cut determines first deal, not who qualifies. Missing DD results prevent final qualification.'),para('App comparison: '+('not supplied - no app comparison performed' if template else str(key.get('appComparison',{}).get('status','not-compared')))),para('Simulated funds - arithmetic only','PacketHeading')]
    funds=key.get('funds',{})
    if funds.get('status')=='not-configured':story.append(para('No simulated contribution, expense or payout plan was supplied. This is NOT a zero-income event or completed accounting. Enter the reviewed assumptions later; no payout policy is selected by the generator.'))
    else:
        for fund in funds.get('reports',[]):
            story += [para('Fund '+fund['fundId'],'PacketCenter')]
            data=[['Simulated inflow',amount(fund['incomeMinor'])],['Expenses',amount(fund['expenseMinor'])],['Proposed awards',amount(fund['awardMinor'])],['Declared retained balance',amount(fund['retainedMinor'])],['Unallocated (+) / overallocated (-)',amount(fund['differenceMinor'])],['Balance / $5 award increments',str(fund['balance'])+' / '+str(fund['fiveDollarAwards'])],['Declared method check',str(fund['methodCompliance'])],['Policy status',fund['policyStatus']]]
            table=Table([[para(x,'PacketSmall') for x in r] for r in data],colWidths=[320,220],hAlign='LEFT');table.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.black),('VALIGN',(0,0),(-1,-1),'TOP')]));story += [table,Spacer(1,10)]
    story += [para('Physical seating, mixed-evidence handling, independent-role checks, payouts and funding require their separate approved workflows. A balanced simulation does not establish actual payment, official results or ACC approval.','PacketSmall')]
    with output.open('xb') as file:
        doc=SimpleDocTemplate(file,pagesize=letter,rightMargin=36,leftMargin=36,topMargin=70,bottomMargin=48,title='Simulation-only fictional paper-card packet',author='Local mock preparation tool')
        doc.build(story,onFirstPage=page,onLaterPages=page,canvasmaker=partial(Canvas,invariant=1))
    reader=PdfReader(output);summary={'version':VERSION,'template':template,'calculationSample':calculation_sample,'answerKeyFileSha256':source_file_sha256,'pages':len(reader.pages),'paperCards':len(key['paperCards']),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'simulationOnly':True,'databaseActions':False,'sent':False}
    if template and len(reader.pages)!=15:raise ValueError('Unexpected template page count; inspect layout')
    for index,card in enumerate(key['paperCards'],1):
        text=reader.pages[index].extract_text()
        if f'FICTIONAL PAPER CARD {index:02d}' not in text or 'TOTAL - scripted entries only' not in text or 'NET SPREAD POINTS' not in text or 'Checker initials:' not in text:raise ValueError('Paper card did not fit its identity-bound page')
        if not template and card['cardHash'] not in text:raise ValueError('Paper binding moved off its card page')
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__);group=parser.add_mutually_exclusive_group(required=True);group.add_argument('--template',action='store_true');group.add_argument('--answer-key',type=Path);parser.add_argument('--output',required=True,type=Path);parser.add_argument('--calculation-sample',action='store_true');parser.add_argument('--expected-answer-key-sha256');args=parser.parse_args()
    file_sha=None
    if args.template:key=blank_key()
    else:
        expected=args.expected_answer_key_sha256
        if expected is None:
            manifest=json.loads((args.answer_key.parent/'hashes.json').read_text(encoding='utf-8'));expected=manifest.get(args.answer_key.name)
        key,file_sha=verify_answer_key_bytes(args.answer_key.read_bytes(),expected)
    print(json.dumps(render(key,args.output,args.calculation_sample,file_sha),sort_keys=True))
if __name__=='__main__':main()
