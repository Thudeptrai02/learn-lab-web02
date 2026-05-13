// src/lib/claude.js - Claude API utility (Anthropic Cloud)
// Hỗ trợ model: claude-sonnet-4-20250514, claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Gọi Claude API với cấu hình linh hoạt
 * @param {object} options
 * @param {string} options.system - System prompt
 * @param {string} options.prompt - User message
 * @param {number} options.temperature - Nhiệt độ sáng tạo (0-1), mặc định 0.3
 * @param {number} options.maxTokens - Token tối đa, mặc định 1024
 * @param {string} options.model - Model name, mặc định sonnet mới nhất
 * @param {'json'|'text'} options.mode - 'json' để tự động parse JSON, 'text' để lấy text thường
 * @returns {Promise<string|object>}
 */
export async function askClaude({
  system = "",
  prompt = "",
  temperature = 0.3,
  maxTokens = 1024,
  model = "claude-sonnet-4-20250514",
  mode = "text"
} = {}) {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Thiếu ANTHROPIC_API_KEY trong .env!");
  }

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: "user", content: prompt }]
  };

  // Thêm system prompt nếu có
  if (system) {
    body.system = system;
  }

  // Nếu mode là json, yêu cầu Claude trả về JSON
  if (mode === "json") {
    body.messages[0].content = `${prompt}\n\nRespond ONLY with valid JSON. No markdown, no code fences.`;
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (data.error) {
    console.error("❌ Claude lỗi:", JSON.stringify(data.error, null, 2));
    throw new Error(`Claude API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const content = data.content?.[0]?.text || "";

  if (mode === "json") {
    try {
      // Xoá markdown code fences nếu có
      const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Claude không trả về JSON hợp lệ:\n${content}`);
    }
  }

  return content;
}

/**
 * Danh sách model Claude khả dụng
 */
export const CLAUDE_MODELS = {
  "claude-sonnet-4-20250514": "Claude Sonnet 4 (Mới nhất, thông minh)",
  "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet (Ổn định)",
  "claude-3-5-haiku-20241022": "Claude 3.5 Haiku (Nhanh, rẻ)"
};
