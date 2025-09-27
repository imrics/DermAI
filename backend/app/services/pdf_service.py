from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from datetime import datetime
from typing import List
import os
from app.models import Entry, HairlineEntry, MoleEntry, AcneEntry, User

async def generate_user_report(user_id: str) -> str:
    user = await User.find_one(User.user_id == user_id)
    if not user:
        raise ValueError("User not found")
    
    # Get all entries for user
    entries = await Entry.find(Entry.user_id == user_id).sort(-Entry.created_at).to_list()
    
    filename = f"reports/dermatology_report_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    os.makedirs("reports", exist_ok=True)
    
    doc = SimpleDocTemplate(filename, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=1  # Center
    )
    story.append(Paragraph("Dermatological Assessment Report", title_style))
    story.append(Spacer(1, 20))
    
    # Patient Information
    story.append(Paragraph("Patient Information", styles['Heading2']))
    patient_data = [
        ['Name:', user.name],
        ['Patient ID:', user_id],
        ['Report Date:', datetime.now().strftime('%B %d, %Y')],
        ['Total Entries:', str(len(entries))]
    ]
    patient_table = Table(patient_data, colWidths=[2*inch, 4*inch])
    patient_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(patient_table)
    story.append(Spacer(1, 30))
    
    # Group entries by type
    hairline_entries = [e for e in entries if isinstance(e, HairlineEntry)]
    acne_entries = [e for e in entries if isinstance(e, AcneEntry)]
    mole_entries = [e for e in entries if isinstance(e, MoleEntry)]
    
    # Hairline Section
    if hairline_entries:
        story.append(Paragraph("Hairline Assessment", styles['Heading2']))
        for entry in hairline_entries:
            story.extend(_format_hairline_entry(entry, styles))
        story.append(Spacer(1, 20))
    
    # Acne Section
    if acne_entries:
        story.append(Paragraph("Acne Assessment", styles['Heading2']))
        for entry in acne_entries:
            story.extend(_format_acne_entry(entry, styles))
        story.append(Spacer(1, 20))
    
    # Mole Section
    if mole_entries:
        story.append(Paragraph("Mole Assessment", styles['Heading2']))
        for entry in mole_entries:
            story.extend(_format_mole_entry(entry, styles))
    
    doc.build(story)
    return filename

def _format_hairline_entry(entry: HairlineEntry, styles) -> List:
    elements = []
    
    # Entry header
    elements.append(Paragraph(f"Entry Date: {entry.created_at.strftime('%B %d, %Y')}", styles['Heading3']))
    elements.append(Paragraph(f"Sequence ID: {entry.sequence_id}", styles['Normal']))
    
    if entry.norwood_score:
        elements.append(Paragraph(f"Norwood Score: {entry.norwood_score}", styles['Normal']))
    
    if entry.ai_comments:
        elements.append(Paragraph("AI Analysis:", styles['Heading4']))
        elements.append(Paragraph(entry.ai_comments, styles['Normal']))
    
    if entry.recommendations:
        elements.append(Paragraph("Recommendations:", styles['Heading4']))
        elements.append(Paragraph(entry.recommendations, styles['Normal']))
    
    if entry.user_notes:
        elements.append(Paragraph("Patient Notes:", styles['Heading4']))
        elements.append(Paragraph(entry.user_notes, styles['Normal']))
    
    elements.append(Spacer(1, 20))
    return elements

def _format_acne_entry(entry: AcneEntry, styles) -> List:
    elements = []
    
    elements.append(Paragraph(f"Entry Date: {entry.created_at.strftime('%B %d, %Y')}", styles['Heading3']))
    elements.append(Paragraph(f"Sequence ID: {entry.sequence_id}", styles['Normal']))
    
    if entry.severity_level:
        elements.append(Paragraph(f"Severity Level: {entry.severity_level}", styles['Normal']))
    
    if entry.ai_comments:
        elements.append(Paragraph("AI Analysis:", styles['Heading4']))
        elements.append(Paragraph(entry.ai_comments, styles['Normal']))
    
    if entry.recommendations:
        elements.append(Paragraph("Recommendations:", styles['Heading4']))
        elements.append(Paragraph(entry.recommendations, styles['Normal']))
    
    if entry.user_notes:
        elements.append(Paragraph("Patient Notes:", styles['Heading4']))
        elements.append(Paragraph(entry.user_notes, styles['Normal']))
    
    elements.append(Spacer(1, 20))
    return elements

def _format_mole_entry(entry: MoleEntry, styles) -> List:
    elements = []
    
    elements.append(Paragraph(f"Entry Date: {entry.created_at.strftime('%B %d, %Y')}", styles['Heading3']))
    elements.append(Paragraph(f"Sequence ID: {entry.sequence_id}", styles['Normal']))
    
    if entry.irregularities_detected is not None:
        status = "Yes" if entry.irregularities_detected else "No"
        elements.append(Paragraph(f"Irregularities Detected: {status}", styles['Normal']))
    
    if entry.ai_comments:
        elements.append(Paragraph("AI Analysis:", styles['Heading4']))
        elements.append(Paragraph(entry.ai_comments, styles['Normal']))
    
    if entry.recommendations:
        elements.append(Paragraph("Recommendations:", styles['Heading4']))
        elements.append(Paragraph(entry.recommendations, styles['Normal']))
    
    if entry.user_notes:
        elements.append(Paragraph("Patient Notes:", styles['Heading4']))
        elements.append(Paragraph(entry.user_notes, styles['Normal']))
    
    elements.append(Spacer(1, 20))
    return elements
