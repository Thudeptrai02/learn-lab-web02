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
        // Biến tất cả tên cột về chữ thường để Astro dễ gọi
        const safeKey = key.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
        cleanRow[safeKey] = row[key] ? row[key].toString().trim() : '';
      }

      const maDe = cleanRow['ma_de'] ? cleanRow['ma_de'].toLowerCase() : '';
      if (maDe) {
        if (!groupedData[maDe]) groupedData[maDe] = [];
        // GIỮ NGUYÊN TẤT CẢ CÁC CỘT (so_cau, cau_hoi, a, b, c, doan_van...)
        groupedData[maDe].push(cleanRow);
      }
    });

    return groupedData;
  } catch (err) {
    console.error("Lỗi fetch dữ liệu từ Sheet:", err);
    return {};
  }
}