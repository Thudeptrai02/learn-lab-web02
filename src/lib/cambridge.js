import Papa from 'papaparse';

// Link chuẩn 100% của sếp
const CAMBRIDGE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTdQHavh6IvNa_ZTKm8brzGMY28wcdsWjJBkzJafDxXY7yxHlwZg4sOW-nROFduuDYO-KBp59yx-_2a/pub?gid=0&single=true&output=csv';

export async function getCambridgeData() {
  try {
    const res = await fetch(CAMBRIDGE_CSV_URL);
    let csvString = await res.text();
    
    // 🗡️ CHIÊU CUỐI DIỆT KÝ TỰ TÀNG HÌNH (BOM) TỪ GOOGLE SHEETS
    csvString = csvString.replace(/^\uFEFF/, '').trim();

    const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
    const groupedData = {};

    parsed.data.forEach((row) => {
      // 🛡️ MÁY LỌC BỌC THÉP: Xóa sạch mọi ký tự lạ, đưa tất cả tên cột về chữ thường không dấu cách
      const cleanRow = {};
      for (let key in row) {
        const safeKey = key.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
        cleanRow[safeKey] = row[key] ? row[key].toString().trim() : '';
      }

      // Bây giờ gọi tên cột cực kỳ an toàn, không sợ sai lệch 1 milimet nào
      const maDe = cleanRow['ma_de'];
      const part = cleanRow['part'];
      const noiDung = cleanRow['noi_dung_html'] || cleanRow['nội dung đề (html)'];
      const dapAn = cleanRow['dap_an'] || cleanRow['đáp án lõi'];

      if (maDe && part) {
        if (!groupedData[maDe]) {
          groupedData[maDe] = [];
        }
        groupedData[maDe].push({ Part: part, Noi_Dung: noiDung, Dap_An: dapAn });
      }
    });

    return groupedData;
    
  } catch (err) {
    console.error("❌ Lỗi Server khi fetch dữ liệu Cambridge:", err);
    return {};
  }
}