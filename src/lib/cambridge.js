import Papa from 'papaparse';

const CAMBRIDGE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTdQHavh6IvNa_ZTKm8brzGMY28wcdsWjJBkzJafDxXY7yxHlwZg4sOW-nROFduuDYO-KBp59yx-_2a/pub?gid=0&single=true&output=csv';

export async function getCambridgeData() {
  try {
    const res = await fetch(CAMBRIDGE_CSV_URL);
    let csvString = await res.text();
    csvString = csvString.replace(/^\uFEFF/, '').trim();

    const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
    const groupedData = {};

    parsed.data.forEach((row) => {
      const cleanRow = {};
      for (let key in row) {
        const safeKey = key.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
        cleanRow[safeKey] = row[key] ? row[key].toString().trim() : '';
      }

      let html = cleanRow['noi_dung_html'] || '';
      
      // ✂️ CHIÊU CUỐI: CẮT BỎ FOOTER VÀ SECTION RÁC CỦA DIVI
      // Thường nội dung chính kết thúc trước khi các section footer xuất hiện
      if (html.includes('et_pb_section')) {
        const sections = html.split('et_pb_section');
        // Chỉ lấy 2-3 section đầu tiên (thường chứa đề bài)
        html = sections.slice(0, 3).join('et_pb_section');
      }

      const maDe = cleanRow['ma_de'];
      if (maDe && cleanRow['part']) {
        if (!groupedData[maDe]) groupedData[maDe] = [];
        groupedData[maDe].push({ 
          Part: cleanRow['part'], 
          Noi_Dung: html, 
          Dap_An: cleanRow['dap_an'] || '' 
        });
      }
    });

    return groupedData;
  } catch (err) {
    return {};
  }
}