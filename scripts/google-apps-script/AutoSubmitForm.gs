/**
 * HỆ THỐNG ĐIỀN GOOGLE FORMS TỰ ĐỘNG TỪ DỮ LIỆU SPSS
 * POST với cookie handling
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
    if (lastRow < 3) { Logger.log("Đã gửi hết!"); xoaTatCaTrigger(); return; }

    var now = new Date();
    var h = now.getHours();
    if (h < START_HOUR || h >= END_HOUR) {
      xoaTatCaTrigger();
      var nr = new Date(now);
      nr.setHours(START_HOUR, 0, 0, 0);
      if (nr <= now) nr.setDate(nr.getDate() + 1);
      ScriptApp.newTrigger(MAIN_FUNC).timeBased().after(nr.getTime() - now.getTime()).create();
      return;
    }

    var fid = FORM_URL.match(/\/d\/e\/([^/]+)/);
    if (!fid) { Logger.log("LỖI URL"); return; }
    var formId = fid[1];

    var numCols = sheet.getLastColumn();
    var entryRow = sheet.getRange(1, 1, 1, numCols).getValues()[0];
    var dataRow = sheet.getRange(3, 1, 1, numCols).getValues()[0];

    // Bước 1: GET form page để lấy cookie + fbzx
    var viewUrl = "https://docs.google.com/forms/d/e/" + formId + "/viewform";
    var getResp = UrlFetchApp.fetch(viewUrl, {
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    // Lấy cookie từ response
    var allHeaders = getResp.getHeaders();
    var cookieStr = "";
    if (allHeaders["Set-Cookie"]) {
      var cookies = allHeaders["Set-Cookie"];
      if (Array.isArray(cookies)) {
        cookieStr = cookies.map(function(c) { return c.split(";")[0]; }).join("; ");
      } else {
        cookieStr = String(cookies).split(";")[0];
      }
    }
    Logger.log("Cookie: " + (cookieStr ? "Có (" + cookieStr.length + " chars)" : "Không"));

    // Lấy fbzx từ HTML
    var html = getResp.getContentText();
    var fbzx = "-1";
    // fbzx trong js code: fbzx = "XXXXX" hoặc "fbzx":"XXXXX"
    var fbMatch = html.match(/fbzx['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
    if (fbMatch) fbzx = fbMatch[1];
    // Thử tìm trong FB_PUBLIC_LOAD_DATA_
    if (fbzx === "-1") {
      fbzx = html.match(/"fbzx"\s*:\s*"([^"]+)"/);
      if (fbzx) { fbzx = fbzx[1]; } else { fbzx = "-1"; }
    }
    // Thử tìm dạng: fbzx=XXXXX trong URL hoặc script inline
    if (fbzx === "-1") {
      fbzx = html.match(/fbzx=([a-zA-Z0-9_-]+)/);
      if (fbzx) { fbzx = fbzx[1]; } else { fbzx = "-1"; }
    }
    Logger.log("fbzx: " + fbzx);

    // Bước 2: Tìm entry.XXXXX trong HTML dưới mọi format
    // Google Forms mới lưu entry IDs trong FB_PUBLIC_LOAD_DATA_
    var entryIdsFromHtml = [];
    var ldMatch = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.+?\])\s*;/);
    if (ldMatch) {
      try {
        var ldData = JSON.parse(ldMatch[1]);
        // Tìm entry IDs trong cấu trúc nested array
        function findEntries(arr, depth) {
          if (!Array.isArray(arr) || depth > 10) return;
          for (var i = 0; i < arr.length; i++) {
            if (Array.isArray(arr[i])) {
              findEntries(arr[i], depth + 1);
            } else if (typeof arr[i] === 'number' && arr[i] > 100000000 && String(arr[i]).length >= 8) {
              // Các số 8-10 digit nghi ngờ là entry ID
            }
          }
        }
        findEntries(ldData, 0);
        Logger.log("✅ FB_PUBLIC_LOAD_DATA_ tìm thấy, độ dài: " + ldMatch[1].length);
      } catch(e) {
        Logger.log("FB_PUBLIC_LOAD_DATA_ parse lỗi: " + e.message);
      }
    } else {
      Logger.log("❌ Không tìm thấy FB_PUBLIC_LOAD_DATA_");
    }

    // Tìm entry IDs từ Sheet trong FB_PUBLIC_LOAD_DATA_
    var ldJson = ldMatch ? ldMatch[1] : "";
    var entryIdsFromSheet = [];
    for (var ci = 0; ci < numCols; ci++) {
      var e = String(entryRow[ci]).trim().replace("entry.", "");
      if (e) entryIdsFromSheet.push(e);
    }
    Logger.log("Entry ID Sheet (" + entryIdsFromSheet.length + "): " + JSON.stringify(entryIdsFromSheet));

    // Tìm từng entry ID trong FB_PUBLIC_LOAD_DATA_
    var foundInLd = [];
    var notFoundInLd = [];
    for (var ei = 0; ei < entryIdsFromSheet.length; ei++) {
      if (ldJson.indexOf('"' + entryIdsFromSheet[ei] + '"') >= 0) {
        foundInLd.push(entryIdsFromSheet[ei]);
      } else {
        notFoundInLd.push(entryIdsFromSheet[ei]);
      }
    }
    Logger.log("Có trong FB_PUBLIC_LOAD_DATA_: " + foundInLd.length + "/" + entryIdsFromSheet.length);
    if (notFoundInLd.length > 0) {
      Logger.log("⚠️ KHÔNG có trong FB_PUBLIC_LOAD_DATA_: " + JSON.stringify(notFoundInLd));
    }

    // Dump FB_PUBLIC_LOAD_DATA_ để debug
    Logger.log("📦 FB_PUBLIC_LOAD_DATA_ 500 ký tự đầu: " + ldJson.slice(0, 500));

    // Thử greedy regex để xem có được nhiều data hơn không
    var ldGreedy = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.+\])\s*;/);
    if (ldGreedy && ldGreedy[1]) {
      Logger.log("✅ Greedy: " + ldGreedy[1].length + " chars");
      Logger.log("📦 Greedy 500 đầu: " + ldGreedy[1].slice(0, 500));
      // Parse để tìm entry IDs
      var ge = ldGreedy[1].match(/entry\.(\d+)/g);
      if (ge) {
        var uniq = [];
        ge.forEach(function(e) { if (uniq.indexOf(e) < 0) uniq.push(e); });
        Logger.log("entry.XXXXX thực (greedy): " + JSON.stringify(uniq));
      } else {
        Logger.log("Không entry.XXXXX ngay cả greedy");
      }
    }

    // Tìm entry IDs từ Sheet trong HTML đầy đủ
    for (var si = 0; si < Math.min(5, entryIdsFromSheet.length); si++) {
      var eid = entryIdsFromSheet[si];
      if (html.indexOf(eid) >= 0) {
        Logger.log("Sheet ID #" + eid + " CÓ trong HTML (pos " + html.indexOf(eid) + ")");
      } else {
        Logger.log("Sheet ID #" + eid + " KHÔNG có trong HTML");
      }
    }

    // Bước 3: Xây payload từ Sheet
    var payload = {};
    for (var col = 0; col < numCols; col++) {
      var ec = String(entryRow[col]).trim();
      if (!ec) continue;
      var v = dataRow[col];
      payload[ec] = (v === null || v === undefined) ? "" : String(v);
    }
    payload.fbzx = fbzx;
    payload.fvv = "1";
    payload.pageHistory = "0";
    payload.submit = "Gửi";
    Logger.log("Gửi " + Object.keys(payload).length + " params");

    // Bước 4: POST với cookie
    var headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Origin": "https://docs.google.com",
      "Referer": viewUrl
    };
    if (cookieStr) headers["Cookie"] = cookieStr;

    var postResp = UrlFetchApp.fetch("https://docs.google.com/forms/d/e/" + formId + "/formResponse", {
      method: "post",
      payload: payload,
      muteHttpExceptions: true,
      followRedirects: true,
      headers: headers
    });

    Logger.log("POST: " + postResp.getResponseCode() + " (length: " + postResp.getContentText().length + ")");
    // Kiểm tra nếu response chứa "Your response" hoặc thông báo thành công
    var body = postResp.getContentText();
    if (body.indexOf("response" + " recorded") >= 0 || body.indexOf("your response") >= 0 || body.indexOf("câu trả lời") >= 0 || body.indexOf("phản hồi") >= 0) {
      Logger.log("✅ Dường như submit thành công!");
    } else if (body.length < 200) {
      Logger.log("📄 Response: " + body);
    }
    sheet.deleteRow(3);
    xoaTatCaTrigger();
    taoTriggerNgauNhien();

  } catch (e) {
    Logger.log("LỖI: " + e.message + "\n" + e.stack);
  }
}

function xoaTatCaTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++)
    if (triggers[i].getHandlerFunction() === MAIN_FUNC)
      ScriptApp.deleteTrigger(triggers[i]);
}

function taoTriggerNgauNhien() {
  var r = Math.floor(Math.random() * (MAX_MINUTES - MIN_MINUTES + 1)) + MIN_MINUTES;
  ScriptApp.newTrigger(MAIN_FUNC).timeBased().after(r * 60 * 1000).create();
}

function stopAutoSubmit() { xoaTatCaTrigger(); }
