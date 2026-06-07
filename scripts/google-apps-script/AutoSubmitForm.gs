/**
 * HỆ THỐNG ĐIỀN GOOGLE FORMS TỰ ĐỘNG TỪ DỮ LIỆU SPSS
 * POST với cookie handling
 */

var FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdmEiKwrLSpEH4SjcPa7OKJr0nHCm9eKGZqUtMPLRpYv8fjFQ/viewform";
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

    // Đảm bảo có cột STATUS
    var statusCol = timCotStatus(sheet);
    if (!statusCol) { Logger.log("LỖI: Không tìm được cột STATUS"); return; }

    // Tìm dòng đầu tiên (≥3) chưa gửi
    var lastRow = sheet.getLastRow();
    var targetRow = -1;
    var statusData = sheet.getRange(3, statusCol, lastRow - 2, 1).getValues();
    for (var ri = 0; ri < statusData.length; ri++) {
      var val = String(statusData[ri][0]).trim();
      if (val === "" || val === "null") { targetRow = 3 + ri; break; }
    }
    if (targetRow === -1) { Logger.log("✅ Đã gửi hết!"); xoaTatCaTrigger(); return; }

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

    var numCols = sheet.getLastColumn();
    var entryRow = sheet.getRange(1, 1, 1, numCols).getValues()[0];
    var dataRow = sheet.getRange(targetRow, 1, 1, numCols).getValues()[0];
    Logger.log("👉 Đang gửi dòng " + targetRow + "/" + lastRow);

    // Lấy Edit URL từ Sheet
    var editUrl = "";
    for (var ci = 0; ci < numCols; ci++) {
      if (String(entryRow[ci]).trim() === "EDIT_URL") {
        editUrl = String(sheet.getRange(2, ci+1).getValue()).trim();
        break;
      }
    }

    // Nếu chưa có EDIT_URL trong Sheet, dùng FORM_URL để tìm form đúng
    if (!editUrl) {
      Logger.log("⚠️ Chưa có EDIT_URL trong Sheet. Dùng FORM_URL để dò form đúng...");
      var allForms = DriveApp.searchFiles("mimeType='application/vnd.google-apps.form' and title contains 'Khảo sát'");
      while (allForms.hasNext()) {
        var f = allForms.next();
        var url = f.getUrl();
        try {
          var testForm = FormApp.openByUrl(url);
          if (testForm.getPublishedUrl() === FORM_URL) {
            editUrl = url;
            Logger.log("✅ Tìm thấy form đúng: " + editUrl);
            break;
          }
        } catch(e) {}
      }
    }

    if (!editUrl) {
      Logger.log("❌ Không tìm thấy form đúng! Mở FORM_URL trong trình duyệt → Chỉnh sửa → copy URL → paste vào Hàng 2 cột EDIT_URL trong Sheet.");
      return;
    }

    // Mở form và tạo response
    var form = FormApp.openByUrl(editUrl);
    var items = form.getItems();
    Logger.log("Form: '" + form.getTitle() + "' (" + items.length + " items)");

    // Xây map: entry ID → item
    var idToItem = {};
    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii];
      idToItem[String(item.getId())] = item;
    }

    // Tạo FormResponse
    var response = form.createResponse();
    var submittedCount = 0;
    var skipped = [];

    for (var ci = 0; ci < numCols; ci++) {
      var ec = String(entryRow[ci]).trim();
      if (!ec || ec === "EDIT_URL") continue;
      var eid = ec.replace("entry.", "");
      var val = dataRow[ci];
      if (val === null || val === undefined || val === "") { skipped.push(eid + "(blank)"); continue; }

      var item = idToItem[eid];
      if (!item) { skipped.push(eid + "(no item)"); continue; }

      try {
        var itemType = item.getType();
        if (itemType === FormApp.ItemType.MULTIPLE_CHOICE) {
          var mcItem = item.asMultipleChoiceItem();
          var itemResponse = mcItem.createResponse(String(val));
          response.withItemResponse(itemResponse);
          submittedCount++;
        } else if (itemType === FormApp.ItemType.TEXT) {
          var textItem = item.asTextItem();
          var textResp = textItem.createResponse(String(val));
          response.withItemResponse(textResp);
          submittedCount++;
        } else {
          skipped.push(eid + "(type=" + itemType + ")");
        }
      } catch (e) {
        skipped.push(eid + " err=" + e.message);
      }
    }

    Logger.log("Submitted: " + submittedCount + "/" + (numCols - 1) + " items");
    Logger.log("Skipped: " + (skipped.length > 0 ? JSON.stringify(skipped) : "0"));

    try {
      response.submit();
      Logger.log("✅ SUBMIT THÀNH CÔNG!");
      // Ghi STATUS thay vì xoá dòng
      sheet.getRange(targetRow, statusCol).setValue("Đã gửi " + Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"));
      xoaTatCaTrigger();
      taoTriggerNgauNhien();
    } catch (e) {
      Logger.log("❌ Submit lỗi: " + e.message + "\n" + e.stack);
      sheet.getRange(targetRow, statusCol).setValue("LỖI: " + e.message);
    }

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

function timCotStatus(sheet) {
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var ci = 0; ci < headerRow.length; ci++) {
    if (String(headerRow[ci]).trim() === "STATUS") return ci + 1;
  }
  // Chưa có → thêm cột STATUS ở cuối
  var newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue("STATUS");
  sheet.getRange(1, newCol).setFontWeight("bold");
  sheet.getRange(1, newCol).setBackground("#fef3c7");
  return newCol;
}
