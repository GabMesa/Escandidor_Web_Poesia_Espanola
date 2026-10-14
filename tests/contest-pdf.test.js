import test from 'node:test';
import assert from 'node:assert/strict';
import { extractContestPdf } from '../functions/_lib/contest-pdf.js';

function document(text) {
  const stream = `BT /F1 12 Tf 40 750 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const [index, value] of objects.entries()) { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${value}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
test('production PDF reader extracts contest requirements without Python', async () => {
  const pdf = await extractContestPdf(document('Bases: maximo 100 versos. Entrega en PDF. Fuente Arial 12.'));
  assert.equal(pdf.pages, 1);
  assert.equal(pdf.sparsePages, 0);
  assert.match(pdf.text, /maximo 100 versos/);
});
test('production PDF reader flags sparse pages instead of inventing OCR text', async () => {
  const pdf = await extractContestPdf(document(''));
  assert.equal(pdf.sparsePages, 1);
  assert.equal(pdf.text.trim(), '');
});
