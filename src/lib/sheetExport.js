import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let authClient = null;

function getAuthClient() {
  if (authClient) return authClient;

  const serviceAccountJson = import.meta.env.GOOGLE_SHEETS_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error('Thiếu GOOGLE_SHEETS_SERVICE_ACCOUNT trong biến môi trường');
  }

  let credentials;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('GOOGLE_SHEETS_SERVICE_ACCOUNT không phải JSON hợp lệ');
  }

  authClient = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    SCOPES
  );
  return authClient;
}

function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

export async function appendToSheet(sheetId, headers, rows) {
  if (!sheetId) throw new Error('Thiếu Sheet ID');
  if (!rows || rows.length === 0) throw new Error('Không có dữ liệu để xuất');

  const sheets = getSheetsClient();

  const headerValues = ['STT', 'Thời gian', ...headers];
  const dataValues = rows.map((row, i) => [i + 1, row.timestamp, ...row.answers]);

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headerValues, ...dataValues] }
    });
    return { ok: true, rows: rows.length };
  } catch (e) {
    if (e.message?.includes('Unable to parse range')) {
      throw new Error('Sheet ID không hợp lệ');
    }
    if (e.message?.includes('Requested entity was not found')) {
      throw new Error('Không tìm thấy Google Sheet. Kiểm tra lại Sheet ID.');
    }
    if (e.message?.includes('Permission denied')) {
      throw new Error('Service account chưa được share vào sheet. Chia sẻ sheet với email: ' +
        (getAuthClient().credentials?.client_email || 'kiểm tra GOOGLE_SHEETS_SERVICE_ACCOUNT'));
    }
    throw new Error('Lỗi Google Sheets API: ' + e.message);
  }
}

export async function verifyAccess(sheetId) {
  if (!sheetId) throw new Error('Thiếu Sheet ID');
  const sheets = getSheetsClient();
  try {
    const info = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetsList = info.data.sheets?.map(s => s.properties?.title) || [];
    return { ok: true, title: info.data.properties?.title, sheets: sheetsList };
  } catch (e) {
    throw new Error('Không thể truy cập sheet: ' + e.message);
  }
}
