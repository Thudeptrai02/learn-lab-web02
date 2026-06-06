# Hướng dẫn thiết lập & kickstart

## 1. Tạo file Google Sheets "Mồi"

1. Vào **Google Drive**, tạo file **Google Sheets** mới.
2. Đặt tên: **`Bo_Chay_SPSS`**.
3. Tạo tab (sheet) tên: **`SPSS_Data`**.
4. Cấu trúc tab (quan trọng):
   - **Hàng 1**: mã `entry.xxxx` cho từng câu hỏi (lấy từ link pre-filled của Google Form).
   - **Hàng 2**: tên câu hỏi (Họ tên, Tuổi, ...). Script bỏ qua hàng này — chỉ để người dùng quản lý.
   - **Hàng 3+**: dữ liệu SPSS sạch, mỗi hàng là một bộ câu trả lời.

### Cách lấy mã entry.xxxx

1. Mở Google Form của bạn.
2. Nhấn **Gửi** → biểu tượng 🔗 **Lấy đường liên kết**.
3. Bật **Liên kết pre-filled**.
4. Điền thử một câu trả lời, kéo xuống **Lấy liên kết**.
5. Sao chép link, nhìn trong URL — bạn sẽ thấy các tham số dạng `entry.123456789`.
6. Copy từng mã đó vào **Hàng 1** của tab `SPSS_Data`, mỗi mã một cột, theo đúng thứ tự câu hỏi.

---

## 2. Gắn Apps Script vào file "Mồi"

1. Mở file **`Bo_Chay_SPSS`** (Google Sheets).
2. Vào menu **Extensions > Apps Script**.
3. Xoá code mặc định trong file `.gs` vừa mở.
4. Copy toàn bộ nội dung file `AutoSubmitForm.gs` → dán vào.
5. Sửa hằng số **`baseFormUrl`** ở đầu code:
   - Dùng đúng link Google Form của bạn.
   - **Nhớ thêm `/formResponse`** vào cuối.
   - Ví dụ: `var baseFormUrl = "https://docs.google.com/forms/d/e/ABCDEF123456/formResponse";`
6. Tuỳ chỉnh `MIN_MINUTES`, `MAX_MINUTES`, `START_HOUR`, `END_HOUR` nếu cần.

---

## 3. Chạy lần đầu — Cấp quyền

1. Trong Apps Script, chọn hàm **`superAutoSubmitApp`** ở dropdown (cạnh nút Debug).
2. Nhấn **Run** ▶️.
3. Một cửa sổ **Cấp quyền (Authorization)** hiện ra:
   - Chọn tài khoản Google của bạn.
   - Nhấn **Advanced > Go to Bo_Chay_SPSS (unsafe)** — vì script tự viết nên Google chưa xác thực.
   - Nhấn **Allow** để cấp quyền:
     - Xem và quản lý Google Sheets của bạn.
     - Kết nối với dịch vụ bên ngoài (UrlFetchApp — để gửi data lên Form).
     - Xem và quản lý Trigger thời gian.
4. Script chạy lần đầu tiên — kiểm tra **View > Logs** hoặc **Executions** để xem trạng thái.

> **Lưu ý:** Lần chạy đầu, nếu đang ngoài khung giờ cho phép, script sẽ tự động hẹn Trigger chạy vào `START_HOUR` sáng hôm sau. Không cần can thiệp gì thêm.

---

## 4. Hệ thống tự động chạy

- Sau khi kickstart thành công, script sẽ **tự động lập lịch** chạy tiếp.
- Sau mỗi lần gửi thành công:
  - Xoá dòng vừa gửi (hàng 3 trong tab `SPSS_Data`).
  - Tạo Trigger mới với thời gian **ngẫu nhiên** (từ `MIN_MINUTES` đến `MAX_MINUTES` phút).
- Nếu hết dữ liệu → ghi log **"Đã gửi hết dữ liệu nghiên cứu!"** và dừng hẳn.

---

## 5. Các hàm tiện ích

| Hàm | Mô tả |
|------|-------|
| `superAutoSubmitApp()` | Hàm chính — kickstart và tự động chạy |
| `stopAutoSubmit()` | Dừng toàn bộ hệ thống (xoá tất cả Trigger) |
| `kiemTraTrigger()` | Kiểm tra số Trigger đang chạy |

- Để dừng hẳn: chọn hàm **`stopAutoSubmit`** trong dropdown → Run.

---

## 6. Nguyên tắc an toàn

- File **Google Sheets kết quả của Form** để nguyên — **KHÔNG mở, không chỉnh sửa**. Giữ Version History sạch 100%.
- Tất cả dữ liệu SPSS và script đều nằm trong file **"Mồi"** (`Bo_Chay_SPSS`).
- Chỉ gửi dữ liệu trong **khung giờ hoạt động** (`START_HOUR`–`END_HOUR`).
- Khoảng cách giữa các lần gửi **hoàn toàn ngẫu nhiên**.
