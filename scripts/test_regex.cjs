const fs = require('fs');
const pdf = require('pdf-parse');

async function run() {
  console.log('pdf type:', typeof pdf);
  const dataBuffer = fs.readFileSync('C:\\Users\\egree\\OneDrive\\Desktop\\TỪ VỰNG 900 TOEIC.pdf');
  const data = await pdf(dataBuffer);
  let text = data.text;
  text = text.replace(/\n(?=[^\n]*\/)/g, '');
  console.log(text.substring(0, 1500));
}
run().catch(console.error);
