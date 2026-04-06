import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 1. Schema cho Blog (Đã bổ sung đầy đủ trường khớp với CMS)
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(), // Cho phép trống nếu lỡ quên chọn ngày
    description: z.string().optional(),
    category: z.string().default('Góc nhỏ'), // Thêm Danh mục cho bộ lọc
    image: z.string().optional(),            // Thêm Ảnh bìa
  }),
});

// 2. Schema cho Tài liệu Free
const resources = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/resources" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    url: z.string(),
    type: z.enum(['PDF', 'Worksheet', 'Checklist']),
  }),
});

// 3. Schema cho Dictation (Nghe chép chính tả)
// 🟢 SỬA LỖI: Đổi "*.md" thành "*.json" vì CMS lưu dạng JSON
const dictation = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/dictation" }),
  schema: z.object({
    title: z.string(),
    level: z.enum(['Dễ', 'Trung bình', 'Khó']).optional(), // Khớp với config.yml
    audio: z.string(),
    transcript: z.string().optional(),
    translation: z.string().optional(),
  }),
});

// 4. Schema cho Flashcards
// 🟢 SỬA LỖI: Đổi "*.md" thành "*.json" vì CMS lưu dạng JSON
const flashcards = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/flashcards" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    words: z.array(
      z.object({
        word: z.string(),
        meaning: z.string(),
        phonetic: z.string().optional(),
        example: z.string().optional(),
        audio: z.string().optional(),
      })
    ).default([]),
  }),
});

// 5. Schema cho Đề kiểm tra (Exams)
const exams = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/exams" }),
  schema: z.object({
    title: z.string(),
    exam: z.enum(['TOEIC', 'IELTS', 'Cambridge']),
    questions: z.array(
      z.object({
        question: z.string(),
        optionA: z.string(),
        optionB: z.string(),
        optionC: z.string().optional(),
        optionD: z.string().optional(),
        correct: z.enum(['A', 'B', 'C', 'D']),
      })
    ).default([]),
  }),
});

export const collections = {
  blog,
  resources,
  dictation,
  flashcards,
  exams,
};