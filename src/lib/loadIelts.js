import Papa from 'papaparse';

// 🟢 NHỚ THAY ID SHEET CỦA SẾP VÀO ĐÂY
const SHEET_ID = "1VbWJL2REkEYWM54XoRJsRjdJ3FzFRZOd4uIF7kgOsWE"; 

export async function getIeltsDataFromSheet(sheetName = "Test_1") {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    try {
        const response = await fetch(url);
        const csvText = await response.text();
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

        let passages = [];
        let passageMap = new Map();

        parsed.data.forEach(row => {
            let pName = row.Part?.trim() || "Passage 1";
            if (!passageMap.has(pName)) {
                passageMap.set(pName, { title: pName, passageText: row.Passage, questionGroups: [] });
            }
            let currentP = passageMap.get(pName);

            let group = currentP.questionGroups.find(g => g.groupId === row.Group_ID);
            if (!group) {
                group = { 
                    groupId: row.Group_ID, 
                    instruction: row.Instruction, 
                    groupContent: row.Group_Content, 
                    questions: [] 
                };
                currentP.questionGroups.push(group);
            }

            group.questions.push({
                qNum: row.Q_Num,
                questionText: row.Question,
                options: [row.Opt_A, row.Opt_B, row.Opt_C, row.Opt_D, row.Opt_E, row.Opt_F, row.Opt_G, row.Opt_H].filter(Boolean),
                correct: row.Correct
            });
        });
        
        return Array.from(passageMap.values());
    } catch (error) { console.error("Lỗi nạp dữ liệu:", error); return []; }
}