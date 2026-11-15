from pathlib import Path
from shutil import copyfile

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "qualifiers-summary.pdf"
PUBLIC_COPY = ROOT / "public" / "sample" / "qualifiers-summary.pdf"


def paragraph(value, style):
    return Paragraph(value, style)


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_COPY.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT), pagesize=letter, rightMargin=0.55 * inch,
        leftMargin=0.55 * inch, topMargin=0.55 * inch, bottomMargin=0.5 * inch,
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=19, leading=23, textColor=colors.HexColor("#10233f"), spaceAfter=4)
    subtitle = ParagraphStyle("Subtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leading=14, textColor=colors.HexColor("#52627a"), spaceAfter=14)
    warning = ParagraphStyle("Warning", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=14, textColor=colors.HexColor("#a33f2e"), spaceAfter=9)
    section = ParagraphStyle("Section", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=colors.HexColor("#10233f"), spaceBefore=12, spaceAfter=6)
    normal = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5, leading=13)
    table_header = ParagraphStyle("TableHeader", parent=normal, fontName="Helvetica-Bold", textColor=colors.white)

    story = [
        Paragraph("ACC Tournament Desk", subtitle),
        Paragraph("Sample Qualification Summary", title),
        Paragraph("Sample Cribbage Classic - Demo City, ST - January 15, 2030 - Main Event", subtitle),
        Paragraph("SAMPLE - NOT OFFICIAL", warning),
        Paragraph("Event Results", section),
    ]
    results = [
        ["Placement", "Player", "Award"],
        ["Winner", "Example Qualifier Two", "Illustrative"],
        ["Runner-up", "Example Qualifier Three", "Illustrative"],
    ]
    qualifiers = [
        ["Qualifier", "Master Rating Points", "Q Pool Award"],
        ["1. Example Qualifier One", "10", "$50.00"],
        ["2. Example Qualifier Two", "8", "$35.00"],
        ["3. Example Qualifier Three", "6", "$25.00"],
        ["High Non-Qualifier: Example Non-Qualifier", "Not a qualifier", "-"],
    ]

    def styled_table(data, widths):
        table = Table([[paragraph(str(cell), table_header if row_index == 0 else normal) for cell in row] for row_index, row in enumerate(data)], colWidths=widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#10233f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd7e5")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f9fc")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        return table

    story += [styled_table(results, [1.55 * inch, 3.2 * inch, 1.65 * inch]), Spacer(1, 10)]
    qualifier_table = styled_table(qualifiers, [3.0 * inch, 1.9 * inch, 1.5 * inch])
    qualifier_table.setStyle(TableStyle([
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#fff4d6")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 1.1, colors.HexColor("#bf7b12")),
    ]))
    story += [Paragraph("Qualifiers", section), qualifier_table, Spacer(1, 12)]
    story += [Paragraph("Illustrative Q Pool total: $110.00", normal), Spacer(1, 6)]
    story += [Paragraph("Synthetic sample data only. MRP/byes and Q Pool payout/rounding fixtures are not approved in this prototype. A production report may be generated only from reconciled, director-approved published event results and approved award fields.", subtitle)]
    document.build(story)
    copyfile(OUTPUT, PUBLIC_COPY)


if __name__ == "__main__":
    build()
