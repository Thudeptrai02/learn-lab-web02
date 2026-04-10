import requests
from bs4 import BeautifulSoup
import pandas as pd
import json
import os

# URL sếp muốn "khám"
url = "https://englishpracticetest.net/practice-ket-a2-reading-and-writing-test-01-with-answers/"
headers = {'User-Agent': 'Mozilla/5.0'}

def scrape_now():
    print("🚀 Đang 'vét' dữ liệu từ web... Sếp đợi tí nhé!")
    res = requests.get(url, headers=headers)
    res.encoding = 'utf-8'
    soup = BeautifulSoup(res.text, 'html.parser')
    
    # Lấy các khối đáp án ẩn (trong dấu cộng)
    answer_boxes = soup.find_all('div', class_='elementor-toggle-content')
    answers = [box.get_text(strip=True) for box in answer_boxes]

    # Bóc tách câu hỏi và nội dung (Logic thô để lấy text)
    content = soup.find('div', class_='entry-content')
    all_text = content.find_all(['p', 'strong'])
    
    data_for_excel = []
    data_for_web = []

    # Giả lập bóc tách 30 câu (Sếp có thể sửa logic loop này tùy theo độ dài trang)
    for i in range(1, 31):
        ans_text = answers[i-1] if i <= len(answers) else "N/A"
        
        # Tạo dòng cho Excel
        data_for_excel.append({
            "Câu số": i,
            "Nội dung": f"Question content {i}", # Sếp có thể tinh chỉnh lấy text chuẩn ở đây
            "Đáp án": ans_text
        })
        
        # Tạo Object cho Web
        data_for_web.append({
            "id": str(i),
            "text": f"Question {i} text...",
            "options": {"A": "Option A", "B": "Option B", "C": "Option C"},
            "ans": ans_text[-1] if ans_text else "" # Lấy chữ cái cuối (A, B hoặc C)
        })

    # 1. Xuất file Excel (Sếp mở bằng Excel để quản lý)
    df = pd.DataFrame(data_for_excel)
    df.to_excel("Ket_Test_01_Result.xlsx", index=False)
    print("📊 Đã tạo xong file Excel: Ket_Test_01_Result.xlsx")

    # 2. Xuất file JSON (Để Web 'hút' vào render bài thi)
    os.makedirs('src/data', exist_ok=True)
    with open('src/data/ket-01.json', 'w', encoding='utf-8') as f:
        json.dump({"title": "KET Practice Test 01", "questions": data_for_web}, f, ensure_ascii=False, indent=2)
    print("🌐 Đã tạo xong file JSON cho Web: src/data/ket-01.json")

if __name__ == "__main__":
    scrape_now()