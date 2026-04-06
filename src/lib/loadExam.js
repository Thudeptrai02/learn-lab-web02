import Papa from 'papaparse';

// 🟢 LINK MASTER SHEET MỚI CỦA SẾP
const MASTER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1zJmz2pqzkcKA1SZVMM19fwm8f5mf2xDyr9fwc0Of7gU/export?format=csv'; 

export async function getExamCatalog() {
  try {
    const res = await fetch(MASTER_SHEET_URL);
    const csvString = await res.text();
    const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
    
    const catalog = {};
    parsed.data.forEach(row => {
      // Bao thầu cả trường hợp tên cột bị viết thường
      const id = (row.id || row.ID || row.Id || '').toString().trim();
      const url = (row.url || row.URL || row.Url || '').toString().trim();

      if (id && url) {
        catalog[id] = {
          title: row.title || row.Title || 'Chưa đặt tên',
          category: row.category || row.Category || 'TOEIC',
          series: row.series || row.Series || 'Tổng hợp',
          year: row.year || row.Year || '',
          duration: parseInt(row.duration || row.Duration) || 120,
          url: url
        };
      }
    });
    return catalog;
  } catch (err) {
    console.error("❌ Lỗi khi fetch Danh mục đề thi:", err);
    return {};
  }
}

// 🟢 AI ĐỌC DỮ LIỆU TỪNG ĐỀ (Đã bọc thép chống trượt cột)
export async function getFullExamData(csvUrl) {
  try {
    const res = await fetch(csvUrl);
    const csvString = await res.text();
    const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true, dynamicTyping: true });
    
    const rawData = parsed.data;
    const examSets = [];
    const groups = {};

    // Hàm tiện ích để dò nhiều tên cột khác nhau
    const getVal = (obj, keys) => {
      for (let k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
          return obj[k].toString().trim();
        }
      }
      return "";
    };

    rawData.forEach(item => {
      // Dò mã Group hoặc Số thứ tự câu
      const qNum = getVal(item, ['Q_Num', 'q_num', 'qnum', 'Question_Num']);
      const gId = getVal(item, ['Group_ID', 'group_id', 'GroupID', 'group']) || `single-${qNum}`;
      
      if (!groups[gId]) {
        groups[gId] = {
          part: parseInt(getVal(item, ['Part', 'part'])) || 7, 
          audio: getVal(item, ['Audio_URL', 'audio_url', 'Audio', 'audio', 'Audio_Link']), 
          image: getVal(item, ['Image_URL', 'image_url', 'Image', 'image', 'Image_Link']),
          passage: getVal(item, ['Passage', 'passage', 'Text', 'text']),
          questions: []
        };
        examSets.push(groups[gId]);
      }

      if (qNum) {
        // Dò 4 đáp án
        let optA = getVal(item, ['Opt_A', 'opt_a', 'A', 'a']);
        let optB = getVal(item, ['Opt_B', 'opt_b', 'B', 'b']);
        let optC = getVal(item, ['Opt_C', 'opt_c', 'C', 'c']);
        let optD = getVal(item, ['Opt_D', 'opt_d', 'D', 'd']);

        let opts = [optA, optB, optC, optD];
        
        // Nếu không có đáp án (Thường là Part 2)
        if (opts.every(o => o === "")) {
          if (groups[gId].part === 2) {
            opts = ["Nghe Audio và chọn A", "Nghe Audio và chọn B", "Nghe Audio và chọn C"];
          } else {
            opts = ["Chọn đáp án A", "Chọn đáp án B", "Chọn đáp án C", "Chọn đáp án D"];
          }
        } else {
          opts = opts.filter(o => o !== "");
        }
        
        groups[gId].questions.push({
          qNum: parseInt(qNum),
          questionText: getVal(item, ['Question', 'question', 'Q_Text', 'q_text']),
          options: opts,
          correct: getVal(item, ['Correct', 'correct', 'Answer', 'answer']),
          
          // 👇 ĐÂY LÀ CHÌA KHÓA: Hút sạch sẽ Giải thích & Phụ đề dù tên cột là gì
          explanation: getVal(item, ['Explanation', 'explanation', 'Explain', 'explain', 'Giai_thich']),
          transcript: getVal(item, ['Transcript', 'transcript', 'Phu_de', 'Script'])
        });
      }
    });

    return examSets;
  } catch (err) {
    console.error("❌ Lỗi khi fetch CSV đề thi:", err);
    return [];
  }
}