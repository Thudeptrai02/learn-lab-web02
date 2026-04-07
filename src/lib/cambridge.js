import Papa from 'papaparse';

// 🟢 DÁN LINK CSV KHO TỔNG CAMBRIDGE CỦA SẾP VÀO ĐÂY:
const CAMBRIDGE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTdQHavh6IvNa_ZTKm8brzGMY28wcdsWjJBkzJafDxXY7yxHlwZg4sOW-nROFduuDYO-KBp59yx-_2a/pub?gid=0&single=true&output=csv'; 

export async function getCambridgeData() {
  try {
    const res = await fetch(CAMBRIDGE_CSV_URL);
    const csvString = await res.text();
    const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
    
    const groupedData = {};

    parsed.data.forEach(row => {
      // Dò tìm tên cột (phòng khi sếp lỡ gõ hoa/thường)
      const maDe = (row.Ma_De || row.ma_de || row.MA_DE || '').toString().trim();
      const part = (row.Part || row.part || row.PART || '').toString().trim();
      const noiDung = (row.Noi_Dung_HTML || row.noi_dung_html || '').toString().trim();
      const dapAn = (row.Dap_An || row.dap_an || '').toString().trim();

      if (maDe && part) {
        if (!groupedData[maDe]) {
          groupedData[maDe] = [];
        }
        // Nhét Part vào đúng mã đề của nó
        groupedData[maDe].push({ Part: part, Noi_Dung: noiDung, Dap_An: dapAn });
      }
    });

    return groupedData;
  } catch (err) {
    console.error("❌ Lỗi khi fetch dữ liệu Cambridge:", err);
    return {};
  }
}