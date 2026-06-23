import fs from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

async function run() {
  console.log('pdf export:', pdf);
  const pdfFn = typeof pdf === 'function' ? pdf : pdf.default || pdf.pdf;
  const data = await pdfFn(await fs.readFile('C:\\Users\\egree\\OneDrive\\Desktop\\TỪ VỰNG 900 TOEIC.pdf'));
  let text = data.text;
  
  // Clean up line breaks inside IPAs or words
  text = text.replace(/\n(?=[^\n]*\/)/g, '');
  
  console.log(text.substring(0, 1500));
}
run().catch(console.error);
