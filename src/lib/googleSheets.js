export async function getSheetData(sheetId, tabName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${tabName}`;
  try {
    const response = await fetch(url);
    const csvText = await response.text();
    const rows = csvText.split('\n').filter(row => row.trim() !== '');
    
    const data = rows.slice(1).map(row => {
      const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      return cols.map(col => col.replace(/^"|"$/g, '').trim());
    });

    return data.map(row => ({
      word: row[0] || '',
      partOfSpeech: row[1] || '',
      meaning: row[2] || '',
      synonyms: row[3] ? row[3].split(',').map(s => s.trim()) : [],
      example: row[4] || '',
      topic: row[5] || 'khac'
    }));
  } catch (error) {
    console.error("Lỗi khi kéo dữ liệu Flashcard:", error);
    return [];
  }
}