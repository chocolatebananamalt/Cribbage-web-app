from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "full-rehearsal-2026-09-16-runbook.pdf"

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="RunTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=colors.HexColor("#123B63"), alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle(name="RunSub", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13, alignment=TA_CENTER, textColor=colors.HexColor("#3B5165"), spaceAfter=14))
styles.add(ParagraphStyle(name="RunH", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=colors.HexColor("#123B63"), spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name="RunH3", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=colors.HexColor("#123B63"), spaceBefore=6, spaceAfter=3))
styles.add(ParagraphStyle(name="RunBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.2, leading=12.2, spaceAfter=4))
styles.add(ParagraphStyle(name="RunSmall", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.8, leading=10.2))
styles.add(ParagraphStyle(name="RunCheck", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.2, leading=12.4, leftIndent=0, firstLineIndent=0, spaceAfter=4))

def p(text, style="RunBody"):
    return Paragraph(text, styles[style])

def checkbox(text):
    # Use ordinary Helvetica characters so the empty box prints reliably on
    # every PDF reader (the Unicode ballot-box glyph is not embedded by the
    # standard PDF fonts).
    return p(f"[&nbsp;&nbsp;]&nbsp;&nbsp;{text}", "RunCheck")

def section(title):
    return [Spacer(1, 3), p(title, "RunH")]

def table(data, widths, header=True, small=False):
    converted = []
    for row in data:
        converted.append([p(str(cell), "RunSmall" if small else "RunBody") for cell in row])
    result = Table(converted, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#AEBCCA")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        commands += [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#123B63")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ]
    for index in range(1 if header else 0, len(data)):
        if index % 2:
            commands.append(("BACKGROUND", (0, index), (-1, index), colors.HexColor("#F4F8FB")))
    result.setStyle(TableStyle(commands))
    return result

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#AEBCCA"))
    canvas.line(0.6 * inch, 0.48 * inch, 7.9 * inch, 0.48 * inch)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#52677A"))
    canvas.drawString(0.6 * inch, 0.31 * inch, "Private rehearsal runbook — fictional test identities only")
    canvas.drawRightString(7.9 * inch, 0.31 * inch, f"Page {doc.page}")
    canvas.restoreState()

story = [
    p("Full Rehearsal — 09-16-2026", "RunTitle"),
    p("Private printable checklist for the ACC Tournament Desk device rehearsal", "RunSub"),
    p("Purpose: prove the complete Main, Consy, Digital/Paper team, verification, recovery, financial, and results workflow before the October 3 pilot. Use this rehearsal only; do not alter Pilot Tournament or October 3 Pilot Tournament.", "RunBody"),
]

story += section("Before you begin")
for item in [
    "Have six blank paper scorecards, one camera phone, and a small test CSV. Use only fictional ACC numbers RH-01 through RH-06 and test cash/check entries.",
    "Use three tables with four seats each. Confirm that the tournament draft is <b>Full Rehearsal — 09-16-2026</b>.",
    "Every device must sign in and open the rehearsal before either outage test. Do not put sign-in links, email addresses, or credentials in this runbook or in a screenshot.",
    "Do not clear app data until each device reports an empty local queue and the server has acknowledged every locally initiated score operation.",
]:
    story.append(checkbox(item))

story += section("People, devices, and assigned test roles")
story.append(table([
    ["Person", "App role", "Device", "Singles", "Team rehearsal assignment"],
    ["Daron", "Owner · primary director · player", "PC laptop", "Digital", "Digital Team Alpha captain/scorer with Luke"],
    ["Maryn", "Co-director · player", "Samsung phone (Wi-Fi/data)", "Digital", "Digital Team Bravo captain with Gabe"],
    ["Gabe", "Cross-checker · player", "Wi-Fi iPad", "Digital", "Digital Team Bravo designated scorer; offline-test device"],
    ["Ian", "Player", "Wi-Fi Samsung phone", "Paper", "Paper Team Charlie with Shonni"],
    ["Shonni", "Cross-checker · player", "Wi-Fi MacBook", "Paper", "Paper Team Charlie with Ian"],
    ["Luke", "Player", "Wi-Fi MacBook", "Paper", "Digital Team Alpha partner with Daron"],
], [0.78*inch, 1.4*inch, 1.22*inch, 0.56*inch, 3.15*inch], small=True))
story.append(Spacer(1, 6))
story.append(p("Team scorecard choice is separate from a person’s Singles choice. Luke is Paper for Singles and Digital with Team Alpha. For the Paper Team Practice Satellite, Daron/Luke and Maryn/Gabe re-form as Paper teams.", "RunBody"))

story += section("Four rehearsal events")
story.append(table([
    ["Event", "Configuration", "Pass focus"],
    ["Main Event", "Standard Singles · 12 games · two Q Pools", "Automatic Main MRP; verified standings and qualifiers"],
    ["Consolation", "Standard Singles · 7 games · Main non-qualifiers", "Automatic Consy MRP; independent event lifecycle"],
    ["Canadian Doubles Satellite", "3 games · Digital Team Alpha, Digital Team Bravo, Paper Team Charlie", "Digital/Digital and Digital/Paper team scoring; MRP not applicable"],
    ["Paper Team Practice Satellite", "3 games · Paper teams Daron/Luke and Maryn/Gabe", "Paper/Paper team scoring; MRP not applicable"],
], [1.55*inch, 2.7*inch, 3.0*inch], small=True))

story += section("MRP source boundary")
story.append(p("Main and Consolation calculations use the currently published ACC schedules: <b>MainMRPs2017ver2.pdf</b> and <b>ConsMRPs2017ver2.pdf</b>, each marked effective <b>August 1, 2016</b>. The app records source version <b>acc-published-mrp-2016-08-01</b> and the effective date in the calculation/export. Every qualifier needs a recorded playoff exit round. Satellite reports must show <b>MRPs: Not applicable</b>; they do not qualify anyone for Main or Consy.", "RunBody"))

story.append(PageBreak())
story += section("Run the rehearsal — setup and intake")
steps_one = [
    "Sign in as Daron. In <b>Your tournaments</b>, open Full Rehearsal — 09-16-2026. Confirm Daron is primary director; do not open a Pilot Tournament.",
    "Use <b>Set Up Tournament</b> to enter name, date, city/location, cash/check payment methods, fees, notes, Main, Consy, Canadian Doubles Satellite, and Paper Team Practice Satellite. Add two Q Pools to Main and retain notes as needed.",
    "Create the rehearsal registration link and QR code. Capture a screenshot of the safe registration landing page only (no credentials or magic links).",
    "Test roster intake: Maryn uses the QR code; Gabe and Ian use the registration URL; import Shonni and Luke with the test CSV; add Daron as a manual walk-in/player. Attempt one duplicate registration and verify the director rejects it.",
    "Review/approve claims and promote the six fictional identities to the roster. Have every account sign in on its assigned device. Complete the required two-official player-account activation using Daron and Maryn.",
    "Assign Gabe and Shonni as cross-checkers. Verify a player cannot self-assign or use a cross-checker action outside the rehearsal.",
    "Record test cash/check intentions and director receipts. Include one partial payment, a correction/void, and a corrected replacement receipt. Verify payment status is separate from check-in and scoring authorization.",
    "Check in all six players. Close registration and prove another signup is rejected. Record the result before continuing.",
    "Publish seating for three tables × four seats. On every device, verify the own starting Table/Seat and permanent Verification ID. Search by a name and a test ACC number; print the paper-card preparation list.",
    "Create the three teams; complete partner claims; set Alpha and Bravo Digital and Charlie Paper; set Gabe as Bravo’s designated digital scorer. Verify Paper/Paper practice teams can be created separately without changing the prior team identities.",
    "Enroll entries in their events and publish schedules. Try invalid capacity, duplicate participant, and missing-opponent changes and verify rejection. Start <b>Main</b> and <b>Canadian Doubles Satellite</b> separately; confirm starting one event does not start the others.",
]
for number, item in enumerate(steps_one, 1):
    story.append(checkbox(f"<b>{number}.</b> {item}"))

story += section("Run the rehearsal — scoring and verification")
steps_two = [
    "Singles Digital/Digital: Maryn vs Gabe. Record matching independent submissions and two eligible confirmations. Verify score becomes authoritative only after the required independent evidence.",
    "Singles Digital/Paper: Daron vs Ian. Use the paper card and the digital entry/cross-check workflow. Capture the pending state and final verified state.",
    "Singles Paper/Paper: Shonni vs Luke. Record independent official paper evidence and complete the cross-check.",
    "Across Singles, test a skunk, a deliberately mismatched result, self-confirmation rejection, an audited correction, and that pending/mismatched scores stay out of standings.",
    "Team Digital/Digital: Team Alpha vs Team Bravo. Confirm all four members display, permanent team Verification IDs persist, reciprocal cards agree, and a scorer cannot confirm their own entry.",
    "Team Digital/Paper: a Digital team vs Paper Team Charlie. Test paper transcription/review, mismatch, correction, and independent completion.",
    "Team Paper/Paper: use the Paper Team Practice Satellite. Confirm separate paper-team records, cross-checking, and no MRP effect.",
]
for number, item in enumerate(steps_two, 12):
    story.append(checkbox(f"<b>{number}.</b> {item}"))

story.append(PageBreak())
story += section("Run the rehearsal — outage and recovery")
for number, item in enumerate([
    "<b>Single-device outage (Gabe’s iPad):</b> disconnect Wi-Fi; enter a result; reload; reconnect; confirm exactly one synchronized entry and no duplicate. Screenshot the stored-local/pending indication and the recovered receipt.",
    "<b>Whole-venue outage:</b> first open the active games on every device. Disable mobile data on Maryn’s phone. Remove router/hotspot internet (or otherwise disconnect the shared Wi-Fi’s internet). Record separate digital and paper results; verify each digital device reports local storage awaiting synchronization.",
    "Restore internet. Confirm queued entries synchronize once, no entries are missing or duplicated, and reconstruction can use an opposing device or paper card. Confirm games become verified only after independent submissions/confirmations arrive.",
    "If one simulated phone becomes unavailable, use the recovery workspace and independent evidence to reconstruct only the affected result; record the audit receipt and preserve the original device record.",
], 19):
    story.append(checkbox(f"<b>{number}.</b> {item}"))

story += section("Run the rehearsal — results, pools, finance, and reports")
for number, item in enumerate([
    "Complete the Main schedule with verified results. Inspect standings, qualifiers in qualifying-rank order, the High Non-Qualifier, playoff entries, recorded playoff exit rounds, and automatic Main MRP results.",
    "Enroll Main non-qualifiers in Consy, publish the Consy schedule, Start Play, complete result/qualification/playoff data, and verify automatic Consy MRPs are separately calculated.",
    "Complete Satellite placements, payouts, optional special-hand evidence, and cross-check evidence for cashing cards. Confirm both Satellites state MRP not applicable and have no Main/Consy qualification effect.",
    "Create zero through six uniquely named Side Pools. Verify a seventh pool and a duplicate normalized name are rejected. Test elections, cash/check receipts, a correction, a void, payouts, exact-cent reconciliation, CSV, event PDF, and combined PDF.",
    "Produce the post-event reports: verified standings, qualifier list and High Non-Qualifier, playoff results, automatic Main/Consy MRP source evidence, Satellite no-MRP report, Side Pool report, financial reconciliation, and director export. Review the totals against the entered test data.",
    "Save screenshots of each pass/fail state, offline queue, recovery result, and any defect. Record failures precisely; do not hide a failed scenario by retrying without noting it.",
], 23):
    story.append(checkbox(f"<b>{number}.</b> {item}"))

story += section("Final pass checklist")
pass_items = [
    "QR, URL, CSV, manual walk-in, duplicate-registration, account activation, cross-checker assignment, and role boundaries passed.",
    "Check-in, registration closure, seating, name/ACC-number lookup, paper-card list, event enrollment, schedule publication, and independent Start Play passed.",
    "Digital/Digital, Digital/Paper, and Paper/Paper Singles plus supported team paths passed; self-review is denied; two independent submissions plus two confirmations are required before verification.",
    "Skunk, mismatch, correction, audit history, pending-score standings exclusion, single-device outage, venue-wide outage, reload, exact-once sync, and recovery evidence passed.",
    "Main/Consy MRP source-versioned calculation, Satellite no-MRP enforcement, qualifier ordering, High Non-Qualifier placement, playoffs distinct from qualifying rank, financial/Side Pool conservation, CSV/PDF, and director export passed.",
    "All device queues are empty and acknowledged before any local app data is cleared. Record the final pass/fail decision and every defect before leaving the rehearsal.",
]
for item in pass_items:
    story.append(checkbox(item))

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(str(OUTPUT), pagesize=letter, leftMargin=0.6*inch, rightMargin=0.6*inch, topMargin=0.55*inch, bottomMargin=0.65*inch, title="Full Rehearsal — 09-16-2026")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
