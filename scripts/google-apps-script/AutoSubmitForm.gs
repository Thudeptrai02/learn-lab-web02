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

    var numCols = sheet.getLastColumn();
    var entryRow = sheet.getRange(1, 1, 1, numCols).getValues()[0];
    var dataRow = sheet.getRange(3, 1, 1, numCols).getValues()[0];

    // Lấy Edit URL từ Sheet
    var editUrl = "";
    for (var ci = 0; ci < numCols; ci++) {
      if (String(entryRow[ci]).trim() === "EDIT_URL") {
        editUrl = String(sheet.getRange(2, ci+1).getValue()).trim();
        break;
      }
    }
    if (!editUrl) {
      Logger.log("⚠️ Không tìm thấy EDIT_URL trong Sheet. Tìm form trong Drive...");
      // Thử tìm form bằng tên
      var files = DriveApp.getFilesByName("Khảo sát - Chất lượng cảm nhận");
      while (files.hasNext()) {
        var f = files.next();
        if (f.getMimeType() === "application/vnd.google-apps.form") {
          editUrl = f.getUrl();
          Logger.log("✅ Tìm thấy form: " + editUrl);
          break;
        }
      }
    }

    if (!editUrl) {
      Logger.log("❌ Không tìm thấy Edit URL. Thêm EDIT_URL vào Sheet!");
      return;
    }

    // Mở form và tạo response
    var form = FormApp.openByUrl(editUrl);
    var items = form.getItems();
    Logger.log("Form: " + form.getTitle() + " (" + items.length + " items)");

    // Xây map: entry ID → item
    var idToItem = {};
    var entryIdsFromSheet = [];
    for (var ci = 0; ci < numCols; ci++) {
      var ec = String(entryRow[ci]).trim();
      if (!ec || ec === "EDIT_URL") continue;
      var eid = ec.replace("entry.", "");
      entryIdsFromSheet.push(eid);
    }

    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii];
      var id = String(item.getId());
      idToItem[id] = item;
    }
    Logger.log("Entry IDs trong Sheet (" + entryIdsFromSheet.length + "), items trong form (" + items.length + ")");

    // Tạo FormResponse
    var response = form.createResponse();
    var submittedCount = 0;
    var skipped = [];

    for (var ci = 0; ci < numCols; ci++) {
      var ec = String(entryRow[ci]).trim();
      if (!ec || ec === "EDIT_URL") continue;
      var eid = ec.replace("entry.", "");
      var val = dataRow[ci];
      if (val === null || val === undefined || val === "") { skipped.push(eid); continue; }

      var item = idToItem[eid];
      if (!item) { skipped.push(eid + "(no item)"); continue; }

      try {
        var itemType = item.getType();
        if (itemType === FormApp.ItemType.MULTIPLE_CHOICE) {
          var mcItem = item.asMultipleChoiceItem();
          var choice = mcItem.createChoice(String(val));
          var itemResponse = mcItem.createResponse([choice]);
          // Hoặc
          var itemResponse2 = mcItem.createResponse(String(val));
          response.withItemResponse(itemResponse2);
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
        skipped.push(eid + "(err:" + e.message + ")");
      }
    }

    Logger.log("Submitted: " + submittedCount + "/" + (numCols - 1) + " items");
    if (skipped.length > 0) Logger.log("Skipped: " + JSON.stringify(skipped.slice(0, 10)));

    try {
      response.submit();
      Logger.log("✅ SUBMIT THÀNH CÔNG!");
      sheet.deleteRow(3);
      xoaTatCaTrigger();
      taoTriggerNgauNhien();
    } catch (e) {
      Logger.log("❌ Submit lỗi: " + e.message + "\n" + e.stack);
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
