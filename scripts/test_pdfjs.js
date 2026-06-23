import fs from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function run() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  
  const dataBuffer = await fs.readFile('C:\\Users\\egree\\OneDrive\\Desktop\\TỪ VỰNG 900 TOEIC.pdf');
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(dataBuffer) });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    // basic reconstruction
    fullText += strings.join(' ') + '\n';
  }
  
  // Format output slightly to reconstruct lines
  console.log(fullText.substring(0, 1500));
}
run().catch(console.error);
