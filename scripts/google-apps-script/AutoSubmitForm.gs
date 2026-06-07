/**
 * ============================================================
 *  HỆ THỐNG ĐIỀN GOOGLE FORMS TỰ ĐỘNG TỪ DỮ LIỆU SPSS
 *  Google Apps Script — Phiên bản hoàn chỉnh
 *
 *  Cách dùng:
 *    1. Tạo file Google Sheets mới, đặt tên "Bo_Chay_SPSS".
 *    2. Vào menu Extensions > Apps Script, dán code này vào.
 *    3. Tạo tab `SPSS_Data` với cấu trúc:
 *       - Hàng 1: mã entry.xxxx (từ link pre-filled)
 *       - Hàng 2: tên câu hỏi (bị script bỏ qua)
 *       - Hàng 3+: dữ liệu SPSS (sạch, đã xuất Excel)
 *    4. Sửa các hằng số CẤU HÌNH bên dưới.
 *    5. Chạy hàm `superAutoSubmitApp()` lần đầu để kích hoạt.
 * ============================================================
 */

// ===================== CẤU HÌNH =====================

/** Link Google Form — dạng /viewform hoặc /formResponse đều được */
var FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfbEl7aX0XD02ILJgkOE3QzIUCKhr6lFuUrcM2hUFVldjy_0Q/viewform";

/** Thời gian chờ tối thiểu giữa các đơn (phút) */
var MIN_MINUTES = 10;

/** Thời gian chờ tối đa giữa các đơn (phút) */
var MAX_MINUTES = 30;

/** Giờ bắt đầu cho phép gửi (0-23) */
var START_HOUR = 8;

/** Giờ kết thúc cho phép gửi (0-23) */
var END_HOUR = 22;

/** Tên tab chứa dữ liệu SPSS trong file "mồi" */
var SHEET_NAME = "SPSS_Data";

/** Tên hàm chính — dùng để quản lý Trigger */
var MAIN_FUNC = "superAutoSubmitApp";

// =====================================================


/**
 * Hàm chính — thực hiện toàn bộ logic
 */
function superAutoSubmitApp() {
  try {
    // ---- Bước 1: Đọc dữ liệu ----
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) { Logger.log("LỖI: Không tìm thấy tab \"" + SHEET_NAME + "\"!"); return; }

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) { Logger.log("Đã gửi hết dữ liệu nghiên cứu!"); xoaTatCaTrigger(); return; }

    // ---- Bước 2: Kiểm tra khung giờ ----
    var now = new Date();
    var currentHour = now.getHours();
    if (currentHour < START_HOUR || currentHour >= END_HOUR) {
      Logger.log("Ngoài khung giờ (" + START_HOUR + "h-" + END_HOUR + "h). Hiện tại: " + currentHour + "h");
      xoaTatCaTrigger();
      var nextRun = new Date(now);
      nextRun.setHours(START_HOUR, 0, 0, 0);
      if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
      ScriptApp.newTrigger(MAIN_FUNC).timeBased().after(nextRun.getTime() - now.getTime()).create();
      Logger.log("Đã hẹn chạy lại lúc " + nextRun.toLocaleString());
      return;
    }

    // ---- Bước 3: Đọc entry codes & dữ liệu ----
    var numCols = sheet.getLastColumn();
    var entryRow = sheet.getRange(1, 1, 1, numCols).getValues()[0];
    var dataRow = sheet.getRange(3, 1, 1, numCols).getValues()[0];

    // ---- Bước 4: Lấy fbzx thật từ form ----
    Logger.log("Đang lấy fbzx từ form...");
    var formId = FORM_URL.match(/\/d\/e\/([^/]+)/);
    if (!formId) { Logger.log("LỖI: Không tìm thấy Form ID trong URL"); return; }
    var fid = formId[1];

    // GET form page để lấy fbzx token thật
    var formPage = UrlFetchApp.fetch("https://docs.google.com/forms/d/e/" + fid + "/viewform", {
      muteHttpExceptions: true,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    var formHtml = formPage.getContentText();

    // Tìm fbzx trong HTML
    var fbzxMatch = formHtml.match(/fbzx["']?\s*:\s*["']([^"']+)["']/);
    var fbzx = fbzxMatch ? fbzxMatch[1] : "-1";
    Logger.log("fbzx: " + fbzx);

    // ---- DEBUG: So sánh entry ID từ HTML với Sheet ----
    var htmlEntryIds = [];
    var entryRegex = /entry\.(\d+)/g;
    var m;
    while ((m = entryRegex.exec(formHtml)) !== null) {
      if (htmlEntryIds.indexOf("entry." + m[1]) < 0) htmlEntryIds.push("entry." + m[1]);
    }
    Logger.log("ENTRY ID từ HTML Form (" + htmlEntryIds.length + "): " + JSON.stringify(htmlEntryIds));
    Logger.log("HTML length: " + formHtml.length + " ký tự");

    // Tìm tất cả entry.XXXXX hoặc "entry":number trong HTML
    var allEntryMatches = formHtml.match(/[eE]ntry[=\.]["']?\d+/g) || [];
    var uniqueEntries = [];
    allEntryMatches.forEach(function(e) { 
      var num = e.match(/\d+/); 
      if (num) { var s = "entry." + num[0]; if (uniqueEntries.indexOf(s) < 0) uniqueEntries.push(s); }
    });
    Logger.log("Entry IDs tìm thấy trong HTML (" + uniqueEntries.length + "): " + JSON.stringify(uniqueEntries));

    // Tìm action URL
    var actionMatch = formHtml.match(/action=["']([^"']*formResponse[^"']*)["']/);
    if (actionMatch) Logger.log("Form action URL: " + actionMatch[1]);

    // Tìm các số 8-10 chữ số trong HTML (có thể là entry ID)
    var allNums = formHtml.match(/\b\d{8,10}\b/g) || [];
    var uniqueNums = [];
    allNums.forEach(function(n) { if (uniqueNums.indexOf(n) < 0) uniqueNums.push(n); });
    Logger.log("Các số 8-10 digit trong HTML (" + uniqueNums.length + "): " + JSON.stringify(uniqueNums.slice(0, 30)));
    Logger.log("HTML đoạn 40000-40800:\n" + formHtml.substring(40000, 40800));
    Logger.log("HTML đoạn 50000-50800:\n" + formHtml.substring(50000, 50800));
    Logger.log("HTML đoạn cuối 500:\n" + formHtml.substring(formHtml.length - 500));
    Logger.log("Từ 'entry' trong HTML: " + (formHtml.indexOf("entry") >= 0 ? "CÓ (vị trí " + formHtml.indexOf("entry") + ")" : "KHÔNG"));
    var sheetEntries = [];
    for (var ci = 0; ci < numCols; ci++) {
      var e = String(entryRow[ci]).trim();
      if (e) sheetEntries.push(e);
    }
    Logger.log("ENTRY ID từ Sheet Hàng 1 (" + sheetEntries.length + "): " + JSON.stringify(sheetEntries));
    // So sánh
    if (JSON.stringify(htmlEntryIds) !== JSON.stringify(sheetEntries)) {
      Logger.log("⚠️ KHÔNG KHỚP! Entry ID trong Sheet khác với Form!");
    } else {
      Logger.log("✅ Entry ID khớp hoàn toàn!");
    }

    // ---- Bước 5: Xây payload & gửi ----
    var payload = {};
    for (var col = 0; col < numCols; col++) {
      var entryCode = String(entryRow[col]).trim();
      var value = dataRow[col];
      if (!entryCode || entryCode === "") continue;
      payload[entryCode] = (value === null || value === undefined) ? "" : String(value);
    }
    payload.fbzx = fbzx;
    payload.fvv = "1";

    Logger.log("Đang gửi " + Object.keys(payload).length + " tham số...");

    var resp = UrlFetchApp.fetch("https://docs.google.com/forms/d/e/" + fid + "/formResponse", {
      method: "post",
      payload: payload,
      muteHttpExceptions: true,
      followRedirects: false,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Origin": "https://docs.google.com",
        "Referer": "https://docs.google.com/forms/d/e/" + fid + "/viewform"
      }
    });

    var code = resp.getResponseCode();
    var headers = resp.getHeaders();
    Logger.log("Phản hồi: " + code + " | Location: " + (headers.Location || "N/A"));

    if (code === 200 || code === 302 || code === 303) {
      Logger.log("✅ Gửi thành công!");
    } else {
      Logger.log("⚠️ Mã lạ: " + code);
    }

    // ---- Bước 6: Xoá hàng 3 ----
    sheet.deleteRow(3);
    Logger.log("Đã xoá hàng 3.");

    // ---- Bước 7: Trigger mới ----
    xoaTatCaTrigger();
    taoTriggerNgauNhien();

  } catch (error) {
    Logger.log("LỖI: " + error.message + "\nStack: " + error.stack);
  }
}

function xoaTatCaTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === MAIN_FUNC) ScriptApp.deleteTrigger(triggers[i]);
  }
}

function taoTriggerNgauNhien() {
  var randomMinutes = Math.floor(Math.random() * (MAX_MINUTES - MIN_MINUTES + 1)) + MIN_MINUTES;
  ScriptApp.newTrigger(MAIN_FUNC).timeBased().after(randomMinutes * 60 * 1000).create();
  Logger.log("Trigger mới sau " + randomMinutes + " phút.");
}

function stopAutoSubmit() {
  xoaTatCaTrigger();
  Logger.log("ĐÃ DỪNG: Toàn bộ trigger đã bị xoá.");
}

function kiemTraTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log("Số trigger: " + triggers.length);
}
