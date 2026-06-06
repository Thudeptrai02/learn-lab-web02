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

/** Link Google Form — nhớ đuôi /formResponse */
var baseFormUrl = "LINK_GOOGLE_FORM_CUA_BAN/formResponse";

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
 * Hàm chính — thực hiện toàn bộ logic:
 *   1. Kiểm tra dữ liệu còn không
 *   2. Kiểm tra khung giờ hoạt động
 *   3. Gửi dữ liệu lên Form
 *   4. Xoá hàng vừa gửi
 *   5. Tự động tạo Trigger mới với thời gian ngẫu nhiên
 */
function superAutoSubmitApp() {
  try {
    // ---- Bước 1: Đọc dữ liệu từ tab SPSS_Data ----
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      Logger.log("LỖI: Không tìm thấy tab \"" + SHEET_NAME + "\"!");
      return;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      Logger.log("Đã gửi hết dữ liệu nghiên cứu!");
      xoaTatCaTrigger();
      return;
    }

    // ---- Bước 2: Kiểm tra khung giờ hoạt động ----
    var now = new Date();
    var currentHour = now.getHours();

    if (currentHour < START_HOUR || currentHour >= END_HOUR) {
      Logger.log("Ngoài khung giờ hoạt động (" + START_HOUR + "h-" + END_HOUR + "h). Hiện tại: " + currentHour + "h");

      // Xoá Trigger cũ
      xoaTatCaTrigger();

      // Tính thời gian đến START_HOUR sáng hôm sau
      var tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(START_HOUR, 0, 0, 0);

      // Nếu vẫn còn trong hôm nay (ví dụ: 3h sáng, START_HOUR=8) thì đặt vào hôm nay
      var nextRun = new Date(now);
      nextRun.setHours(START_HOUR, 0, 0, 0);
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      var delayMs = nextRun.getTime() - now.getTime();
      ScriptApp.newTrigger(MAIN_FUNC).timeBased().after(delayMs).create();
      Logger.log("Đã hẹn Trigger chạy lại lúc " + nextRun.toLocaleString());
      return;
    }

    // ---- Bước 3: Đọc entry codes (Hàng 1) và dữ liệu (Hàng 3) ----
    var numCols = sheet.getLastColumn();
    if (numCols < 1) {
      Logger.log("LỖI: Không có dữ liệu cột nào!");
      return;
    }

    var entryRow = sheet.getRange(1, 1, 1, numCols).getValues()[0];
    var dataRow = sheet.getRange(3, 1, 1, numCols).getValues()[0];

    // ---- Bước 4: Xây chuỗi tham số URL ----
    var params = [];
    for (var col = 0; col < numCols; col++) {
      var entryCode = String(entryRow[col]).trim();
      var value = dataRow[col];

      // Bỏ qua cột rỗng
      if (!entryCode || entryCode === "") continue;

      // Chuyển value về string, xử lý null/undefined
      var strValue = (value === null || value === undefined) ? "" : String(value);

      params.push(encodeURIComponent(entryCode) + "=" + encodeURIComponent(strValue));
    }

    var finalFormUrl = baseFormUrl + "?" + params.join("&");
    Logger.log("Đang gửi: " + finalFormUrl);

    // ---- Bước 5: Gửi request đến Google Form ----
    var response = UrlFetchApp.fetch(finalFormUrl, {
      method: "post",
      followRedirects: false,
      muteHttpExceptions: true
    });

    var statusCode = response.getResponseCode();
    if (statusCode === 200 || statusCode === 302 || statusCode === 303) {
      Logger.log("Gửi thành công! Mã phản hồi: " + statusCode);
    } else {
      Logger.log("CẢNH BÁO: Form trả về mã " + statusCode + ". Vẫn tiếp tục...");
    }

    // ---- Bước 6: Xoá hàng 3 (dòng vừa gửi) ----
    sheet.deleteRow(3);
    Logger.log("Đã xoá hàng 3. Còn " + (sheet.getLastRow() - 2) + " dòng dữ liệu.");

    // ---- Bước 7: Xoá Trigger cũ và tạo Trigger mới ngẫu nhiên ----
    xoaTatCaTrigger();
    taoTriggerNgauNhien();

  } catch (error) {
    Logger.log("LỖI NGHIÊM TRỌNG: " + error.message + "\nStack: " + error.stack);
  }
}


/**
 * Xoá TẤT CẢ trigger có tên superAutoSubmitApp trong dự án
 * để tránh nhân bản luồng chạy.
 */
function xoaTatCaTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === MAIN_FUNC) {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
    Logger.log("Đã xoá tất cả trigger cũ.");
  } catch (error) {
    Logger.log("LỖI khi xoá trigger: " + error.message);
  }
}


/**
 * Tạo một trigger mới với thời gian chờ ngẫu nhiên
 * trong khoảng MIN_MINUTES ~ MAX_MINUTES phút.
 */
function taoTriggerNgauNhien() {
  try {
    var randomMinutes = Math.floor(Math.random() * (MAX_MINUTES - MIN_MINUTES + 1)) + MIN_MINUTES;
    var delayMs = randomMinutes * 60 * 1000;

    ScriptApp.newTrigger(MAIN_FUNC).timeBased().after(delayMs).create();
    Logger.log("Đã tạo trigger mới — sẽ chạy lại sau " + randomMinutes + " phút (" + delayMs + "ms).");
  } catch (error) {
    Logger.log("LỖI khi tạo trigger: " + error.message);
  }
}


/**
 * Hàm tiện ích — dừng toàn bộ hệ thống.
 * Chạy hàm này nếu muốn tắt hẳn quá trình tự động gửi.
 */
function stopAutoSubmit() {
  try {
    xoaTatCaTrigger();
    Logger.log("ĐÃ DỪNG: Toàn bộ trigger đã bị xoá.");
  } catch (error) {
    Logger.log("LỖI khi dừng: " + error.message);
  }
}


/**
 * Hàm tiện ích — kiểm tra trạng thái trigger hiện tại.
 */
function kiemTraTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    Logger.log("Số trigger hiện tại: " + triggers.length);

    if (triggers.length === 0) {
      Logger.log("Không có trigger nào đang chạy.");
    } else {
      for (var i = 0; i < triggers.length; i++) {
        var t = triggers[i];
        Logger.log("Trigger #" + (i + 1) + " → Hàm: " + t.getHandlerFunction() +
                   ", Nguồn: " + t.getTriggerSource() + ", Loại: " + t.getEventType());
      }
    }
  } catch (error) {
    Logger.log("LỖI khi kiểm tra trigger: " + error.message);
  }
}
