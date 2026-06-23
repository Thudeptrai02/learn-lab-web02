import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple env loader
async function loadEnv() {
  try {
    const content = await fs.readFile(path.join(__dirname, '../.env'), 'utf-8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2 && !line.startsWith('#')) {
        process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    });
  } catch (e) {}
}

const RAW_VOCAB_PATH = path.join(__dirname, 'raw_vocab.txt');
const OUTPUT_VOCAB_DIR = path.join(__dirname, '../src/data/TOEIC_900_VOCABULARY');
const OUTPUT_PASSAGE_DIR = path.join(__dirname, '../src/data/passages');

const TOPICS = [
  "Marketing",
  "Personnel",
  "Management Issues",
  "Travel",
  "Entertainment",
  "Health"
];

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {}
}

async function parseRawTxt() {
  const text = await fs.readFile(RAW_VOCAB_PATH, 'utf-8');
  
  const words = [];
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  for (const line of lines) {
    const regex = /^\s*(\d+)\.\s+(.+?)\s+(np|n|v|adj|adv|vp|Phrase)\s+\/([^/]+)\/\s+(.+)$/;
    const match = line.match(regex);
    if (!match) {
      console.warn("Failed to parse line:", line);
      continue;
    }
    
    const num = parseInt(match[1]);
    const word = match[2].trim();
    let pos = match[3].trim();
    const ipa = '/' + match[4].trim() + '/';
    const meaning = match[5].trim();
    
    const posMap = {
      'np': 'Noun Phrase',
      'n': 'Noun',
      'v': 'Verb',
      'adj': 'Adjective',
      'adv': 'Adverb',
      'vp': 'Verb Phrase',
      'Phrase': 'Phrase'
    };
    
    words.push({
      num,
      word,
      ipa,
      partOfSpeech: posMap[pos] || pos,
      meaning,
      example: "", 
      band: "900+",
      section: "Mixed",
      part: "Vocabulary",
      topic: "toeic-900"
    });
  }
  
  console.log(`Parsed ${words.length} words from TXT.`);
  
  // Group into topics.
  for (let i = 0; i < TOPICS.length; i++) {
    const topic = TOPICS[i];
    const topicWords = words.slice(i * 100, (i + 1) * 100);
    
    for (let p = 0; p < 4; p++) {
      const partWords = topicWords.slice(p * 25, (p + 1) * 25);
      const partName = `${topic}_Part_${p + 1}`;
      
      const filePath = path.join(OUTPUT_VOCAB_DIR, `${partName}.json`);
      const finalWords = partWords.map(w => ({...w, topic: partName}));
      
      await fs.writeFile(filePath, JSON.stringify(finalWords, null, 2), 'utf-8');
      console.log(`Saved ${filePath} with ${finalWords.length} words.`);
    }
  }
}

async function generatePassageForPart(vocabList, topicName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No GEMINI_API_KEY found in .env");
    return;
  }
  
  const wordsStr = vocabList.map(v => v.word).join(', ');
  const prompt = `Bạn là một chuyên gia ra đề thi TOEIC. 
Nhiệm vụ:
1. Viết một đoạn văn tiếng Anh (định dạng TOEIC Part 7: email, bài báo, thông báo, thư tín...) khoảng 150-200 từ. 
    Chủ đề: ${topicName}.
    BẮT BUỘC SỬ DỤNG TẤT CẢ HOẶC GẦN NHƯ TẤT CẢ (ít nhất 15 từ) các từ vựng sau một cách tự nhiên: ${wordsStr}.
2. Cung cấp bản dịch tiếng Việt cho đoạn văn đó.
3. Tạo 3 câu hỏi trắc nghiệm (A, B, C, D) bằng tiếng Anh kiểm tra đọc hiểu dựa trên đoạn văn đó.
4. Cung cấp chỉ mục đáp án đúng (từ 0 đến 3) và lời giải thích ngắn gọn bằng tiếng Việt.

QUAN TRỌNG: TRẢ VỀ ĐÚNG 1 KHỐI JSON. TUYỆT ĐỐI KHÔNG thêm Markdown \`\`\`json hay bất kỳ văn bản nào khác.
Định dạng JSON:
{
  "passage_en": "Nội dung đoạn văn tiếng Anh...",
  "passage_vi": "Bản dịch tiếng Việt...",
  "questions": [
    {
      "question": "Câu hỏi số 1?",
      "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
      "correct_answer_index": 0,
      "explanation": "Giải thích..."
    }
  ]
}`;

  console.log(`Generating passage for ${topicName}...`);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    let aiText = data.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(aiText);
    const filePath = path.join(OUTPUT_PASSAGE_DIR, `${topicName}.json`);
    await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
    console.log(`Saved passage ${filePath}`);
    
  } catch (error) {
    console.error(`Error generating passage for ${topicName}:`, error.message);
  }
}

async function generateAllPassages() {
  const files = await fs.readdir(OUTPUT_VOCAB_DIR);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const topicName = file.replace('.json', '');
    const vocabData = JSON.parse(await fs.readFile(path.join(OUTPUT_VOCAB_DIR, file), 'utf-8'));
    
    const passagePath = path.join(OUTPUT_PASSAGE_DIR, file);
    try {
      await fs.access(passagePath);
      console.log(`Passage ${passagePath} already exists, skipping.`);
    } catch {
      await generatePassageForPart(vocabData, topicName);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

async function main() {
  await loadEnv();
  await ensureDir(OUTPUT_VOCAB_DIR);
  await ensureDir(OUTPUT_PASSAGE_DIR);
  
  await parseRawTxt();
  await generateAllPassages();
  console.log("Done!");
}

main().catch(console.error);
