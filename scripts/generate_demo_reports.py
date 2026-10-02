from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public' / 'reports'

REPORTS = {
    'CL-1042-demo-report.pdf': [
        'CARELOOP - SYNTHETIC COORDINATION SUMMARY',
        'DEMO DOCUMENT - NOT A REAL PATIENT REPORT',
        'Patient fixture: CL-1042 | Ramesh Kumar',
        'Care program: Diabetes care | Department: General Medicine',
        'Assigned doctor: Dr. K. Sathwik',
        '',
        'LAST KNOWN CARE ACTIVITY',
        'Appointment: 13 Aug 2026 - attended (demo fixture)',
        'Investigation: 17 Aug 2026 - result recorded (demo fixture)',
        'Milestone: Quarterly review is due today',
        'Contact: Reminder sent 22 Sep 2026; no response recorded',
        '',
        'COORDINATION NEXT STEP',
        'Priority: HIGH - transparent workflow cue, not a clinical prediction',
        'Reason: No recorded care activity for 42 days; review is due today.',
        'Suggested team action: Contact patient and coordinate review.',
        '',
        'Data in this document is fictional and exists only for demonstration.',
    ],
    'CL-2088-demo-report.pdf': [
        'CARELOOP - SYNTHETIC COORDINATION SUMMARY',
        'DEMO DOCUMENT - NOT A REAL PATIENT REPORT',
        'Patient fixture: CL-2088 | Meena Sharma',
        'Care program: Maternal health | Department: Maternal health',
        'Assigned doctor: Dr. Priya Rao | Team owner: Ananya Menon',
        '',
        'LAST KNOWN CARE ACTIVITY',
        'Appointment: 06 Sep 2026 - antenatal review (demo fixture)',
        'Investigation: 06 Sep 2026 - routine panel recorded (demo fixture)',
        'Milestone: Next antenatal review due 01 Oct 2026',
        'Contact: Patient requested an afternoon appointment',
        '',
        'COORDINATION NEXT STEP',
        'Priority: MEDIUM - transparent workflow cue, not a clinical prediction',
        'Reason: Patient requested a new time for the upcoming review.',
        'Suggested team action: Review request and confirm a suitable time.',
        '',
        'Data in this document is fictional and exists only for demonstration.',
    ],
    'CL-3315-demo-report.pdf': [
        'CARELOOP - SYNTHETIC COORDINATION SUMMARY',
        'DEMO DOCUMENT - NOT A REAL PATIENT REPORT',
        'Patient fixture: CL-3315 | Arjun Rao',
        'Care program: Cancer follow-up | Department: Oncology',
        'Assigned doctor: Dr. Priya Rao',
        '',
        'LAST KNOWN CARE ACTIVITY',
        'Appointment: 17 Sep 2026 - review completed (demo fixture)',
        'Investigation: 17 Sep 2026 - follow-up panel recorded (demo fixture)',
        'Milestone: Next surveillance review planned for 12 Oct 2026',
        'Contact: No contact attempt needed',
        '',
        'COORDINATION NEXT STEP',
        'Priority: LOW - transparent workflow cue, not a clinical prediction',
        'Reason: Recent activity recorded; next review is on track.',
        'Suggested team action: Continue routine follow-up plan.',
        '',
        'Data in this document is fictional and exists only for demonstration.',
    ],
    'CL-4170-demo-report.pdf': [
        'CARELOOP - SYNTHETIC COORDINATION SUMMARY',
        'DEMO DOCUMENT - NOT A REAL PATIENT REPORT',
        'Patient fixture: CL-4170 | Asha Nair',
        'Care program: Maternal health | Department: Maternal health',
        'Assigned doctor: Dr. K. Sathwik | Team owner: Unassigned',
        '',
        'LAST KNOWN CARE ACTIVITY',
        'Appointment: 04 Aug 2026 - antenatal review (demo fixture)',
        'Investigation: 08 Aug 2026 - test result recorded (demo fixture)',
        'Milestone: Follow-up review missed on 22 Sep 2026',
        'Contact: Reminder sent 21 Sep 2026; no response recorded',
        '',
        'COORDINATION NEXT STEP',
        'Priority: HIGH - transparent workflow cue, not a clinical prediction',
        'Reason: Review is overdue and no contact is assigned to an owner.',
        'Suggested team action: Assign an owner and coordinate contact.',
        '',
        'Data in this document is fictional and exists only for demonstration.',
    ],
}


def pdf_escape(value: str) -> str:
    return value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def build_pdf(lines: list[str]) -> bytes:
    commands = ['BT', '/F1 10 Tf', '48 754 Td', '14 TL']
    for index, line in enumerate(lines):
        if index:
            commands.append('T*')
        commands.append(f'({pdf_escape(line)}) Tj')
    commands.append('ET')
    stream = ('\n'.join(commands) + '\n').encode('ascii')
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Length ' + str(len(stream)).encode('ascii') + b' >>\nstream\n' + stream + b'endstream',
    ]
    result = bytearray(b'%PDF-1.4\n%CareLoop synthetic demo report\n')
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(result))
        result.extend(f'{number} 0 obj\n'.encode('ascii'))
        result.extend(obj)
        result.extend(b'\nendobj\n')
    xref = len(result)
    result.extend(f'xref\n0 {len(offsets)}\n'.encode('ascii'))
    result.extend(b'0000000000 65535 f \n')
    for offset in offsets[1:]:
        result.extend(f'{offset:010d} 00000 n \n'.encode('ascii'))
    result.extend(f'trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode('ascii'))
    return bytes(result)


DEST.mkdir(parents=True, exist_ok=True)
for filename, lines in REPORTS.items():
    target = DEST / filename
    target.write_bytes(build_pdf(lines))
    print(f'Created {target.relative_to(ROOT)} ({target.stat().st_size} bytes)')
