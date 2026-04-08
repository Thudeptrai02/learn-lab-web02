import Papa from 'papaparse';

// 🟢 LINK CSV KHO TỔNG CAMBRIDGE CỦA SẾP:
const CAMBRIDGE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTdQHavh6IvNa_ZTKm8brzGMY28wcdsWjJBkzJafDxXY7yxHlwZg4sOW-nROFduuDYO-KBp59yx-_2a/pub?gid=0&single=true&output=csv'; 

export async function getCambridgeData() {
  try {
    console.log("⏳ Đang kéo dữ liệu Cambridge từ Google Sheets...");
    const res = await fetch(CAMBRIDGE_CSV_URL);
    const csvString = await res.text();
    
    if (csvString.trim().toLowerCase().startsWith("<!doctype") || csvString.trim().toLowerCase().startsWith("<html")) {
      console.error("❌ BÁO ĐỘNG ĐỎ: Sai link CSV! Sếp kiểm tra lại link nhé.");
      return {};
    }

    const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
    
    if (parsed.data.length > 0) {
      console.log("✅ Các cột hiện có trong file CSV là:", Object.keys(parsed.data[0]));
    }

    const groupedData = {};

    parsed.data.forEach((row, index) => {
      // Quét tự động tất cả các kiểu tên cột (Tiếng Việt, Tiếng Anh, có dấu, không dấu)
      const keys = Object.keys(row);
      const getVal = (possibleNames) => {
        const key = keys.find(k => possibleNames.includes(k.trim()));
        return key ? (row[key] || '').toString().trim() : '';
      };

      const maDe = getVal(['Ma_De', 'ma_de', 'MA_DE']);
      const part = getVal(['Part', 'part', 'PART']);
      const noiDung = getVal(['Noi_Dung_HTML', 'Nội Dung Đề (HTML)', 'noi_dung_html']);
      const dapAn = getVal(['Dap_An', 'Đáp Án Lõi', 'dap_an', 'Đáp Án']);

      // Cảnh báo nếu dòng nào bị sếp bỏ quên chưa điền Mã Đề
      if (!maDe && part) {
         console.log(`⚠️ CẢNH BÁO: Dòng ${index + 2} (Part: ${part}) đang để trống cột Ma_De trên Google Sheets!`);
      }

      // Nếu có đủ Mã Đề và Part thì mới gom vào
      if (maDe && part) {
        if (!groupedData[maDe]) {
          groupedData[maDe] = [];
        }
        groupedData[maDe].push({ Part: part, Noi_Dung: noiDung, Dap_An: dapAn });
      }
    });

    console.log(`✅ Đã gom thành công ${Object.keys(groupedData).length} bộ đề Cambridge!`);
    return groupedData;
    
  } catch (err) {
    console.error("❌ Lỗi Server khi fetch dữ liệu Cambridge:", err);
    return {};
  }
}