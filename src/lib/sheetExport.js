export async function exportToSheet(webhookUrl, surveyData) {
  if (!webhookUrl) throw new Error('Thiếu webhook URL');
  if (!surveyData) throw new Error('Thiếu dữ liệu khảo sát');

  const r = await fetch(webhookUrl, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(surveyData)
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Webhook trả về ${r.status}: ${text || r.statusText}`);
  }

  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: true, result: text };
  }
}
