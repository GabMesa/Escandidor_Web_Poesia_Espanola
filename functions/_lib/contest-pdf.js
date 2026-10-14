import { getDocumentProxy } from 'unpdf';

export async function extractContestPdf(bytes) {
  const pdf = await getDocumentProxy(bytes, { isEvalSupported: false });
  try {
    if (pdf.numPages > 40) throw Error('El PDF supera el límite de 40 páginas.');
    const pages = [];
    let sparsePages = 0;
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      const text = content.items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join('');
      if (text.trim().length < 40) sparsePages++;
      pages.push(text);
      page.cleanup();
    }
    return { text: pages.join('\n').slice(0, 60000), pages: pdf.numPages, sparsePages, imagePages: sparsePages };
  } finally { await pdf.destroy(); }
}
