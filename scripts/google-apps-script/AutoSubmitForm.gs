/**
 * HỆ THỐNG ĐIỀN GOOGLE FORMS TỰ ĐỘNG TỪ DỮ LIỆU SPSS
 * Phiên bản dùng HTTP POST — đã tối ưu
 */

var FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfbEl7aX0XD02ILJgkOE3QzIUCKhr6lFuUrcM2hUFVldjy_0Q/viewform";
var MIN_MINUTES = 2;
var MAX_MINUTES = 5;
var START_HOUR = 8;
var END_HOUR = 22;
var SHEET_NAME = "SPSS_Data";
var MAIN_FUNC = "superAutoSubmitApp";

function superAutoSubmitApp() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) { Logger.log("LỖI: Không tìm thấy tab!"); return; }

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) { Logger.log("Đã gửi hết dữ liệu!"); xoaTatCaTrigger(); return; }

    // Kiểm tra giờ
    var now = new Date();
    var currentHour = now.getHours();
    if (currentHour < START_HOUR || currentHour >= END_HOUR) {
      xoaTatCaTrigger();
      var nextRun = new Date(now);
      nextRun.setHours(START_HOUR, 0, 0, 0);
      if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
      ScriptApp.newTrigger(MAIN_FUNC).timeBased().after(nextRun.getTime() - now.getTime()).create();
      Logger.log("Hẹn chạy lại lúc " + nextRun.toLocaleString());
      return;
    }

    // Đọc dữ liệu
    var numCols = sheet.getLastColumn();
    var entryRow = sheet.getRange(1, 1, 1, numCols).getValues()[0];
    var dataRow = sheet.getRange(3, 1, 1, numCols).getValues()[0];

    var fid = FORM_URL.match(/\/d\/e\/([^/]+)/);
    if (!fid) { Logger.log("LỖI: URL không hợp lệ"); return; }

    // Xây payload
    var payloadParts = [];
    for (var col = 0; col < numCols; col++) {
      var entryCode = String(entryRow[col]).trim();
      if (!entryCode) continue;
      var value = dataRow[col];
      value = (value === null || value === undefined) ? "" : String(value);
      payloadParts.push(encodeURIComponent(entryCode) + "=" + encodeURIComponent(value));
    }
    payloadParts.push("fbzx=-1");
    payloadParts.push("fvv=1");
    payloadParts.push("pageHistory=0");
    payloadParts.push("draftResponse=%5Bnull%2Cnull%2C%22-1%22%5D");
    payloadParts.push("submit=Submit");

    var payloadStr = payloadParts.join("&");

    var postUrl = "https://docs.google.com/forms/d/e/" + fid[1] + "/formResponse";

    var options = {
      method: "post",
      payload: payloadStr,
      contentType: "application/x-www-form-urlencoded",
      muteHttpExceptions: true,
      followRedirects: false,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Origin": "https://docs.google.com",
        "Referer": "https://docs.google.com/forms/d/e/" + fid[1] + "/viewform"
      }
    };

    Logger.log("Đang gửi...");
    var resp = UrlFetchApp.fetch(postUrl, options);
    var code = resp.getResponseCode();
    var headers = resp.getHeaders();
    var loc = headers.Location || "N/A";
    Logger.log("Mã: " + code + " | Location: " + loc);

    // Thử với followRedirects=true nếu lần đầu thất bại
    if (code === 302 || code === 303) {
      options.followRedirects = true;
      var resp2 = UrlFetchApp.fetch(postUrl, options);
      Logger.log("Redirect: " + resp2.getResponseCode());
    }

    if (code === 200 || code === 302 || code === 303) {
      Logger.log("✅ Gửi thành công!");
      sheet.deleteRow(3);
      xoaTatCaTrigger();
      taoTriggerNgauNhien();
    } else {
      Logger.log("⚠️ Lỗi " + code + " — " + resp.getContentText().substring(0, 300));
    }

  } catch (error) {
    Logger.log("LỖI: " + error.message);
  }
}

function xoaTatCaTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === MAIN_FUNC)
      ScriptApp.deleteTrigger(triggers[i]);
  }
}

function taoTriggerNgauNhien() {
  var randomMinutes = Math.floor(Math.random() * (MAX_MINUTES - MIN_MINUTES + 1)) + MIN_MINUTES;
  ScriptApp.newTrigger(MAIN_FUNC).timeBased().after(randomMinutes * 60 * 1000).create();
  Logger.log("Trigger sau " + randomMinutes + " phút.");
}

function stopAutoSubmit() { xoaTatCaTrigger(); Logger.log("Đã dừng."); }
function kiemTraTrigger() { Logger.log("Số trigger: " + ScriptApp.getProjectTriggers().length); }
