import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 1. Blog
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    description: z.string().optional(),
    category: z.string().default('Góc nhỏ'),
    image: z.string().optional(),
  }),
});

// 2. Resources
const resources = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/resources" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    url: z.string(),
    type: z.enum(['PDF', 'Worksheet', 'Checklist']),
  }),
});

// 3. Dictation
const dictation = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/dictation" }),
  schema: z.object({
    title: z.string(),
    level: z.enum(['Dễ', 'Trung bình', 'Khó']).optional(),
    audio: z.string(),
    transcript: z.string().optional(),
    translation: z.string().optional(),
  }),
});

// 4. Flashcards
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

// 5. Schema cho Đề kiểm tra (Exams) - BẢN NÂNG CẤP CHUẨN QUỐC TẾ
const exams = defineCollection({
  // Sếp nên dùng .mdx cho Exams để vừa có data vừa trình bày được biển báo/bảng biểu
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/exams" }),
  schema: z.object({
    title: z.string(),
    test_id: z.string(),
    exam: z.enum(['TOEIC', 'IELTS', 'Cambridge']),
    // Cấu trúc Part để chia nhỏ đề thi (Part 1 -> Part 7)
    parts: z.array(z.object({
      part_name: z.string(), // Ví dụ: Part 1, Part 2
      instruction: z.string().optional(),
      passage: z.string().optional(), // Chứa HTML hoặc text bài đọc
      questions: z.array(z.object({
        id: z.coerce.string(),
        text: z.string().optional(),
        options: z.object({
          A: z.string(),
          B: z.string(),
          C: z.string(),
          D: z.string().optional(),
        }).optional(),
        ans: z.string(), // Đáp án đúng (A, B, C, hoặc từ cụ thể)
        type: z.enum(['multiple-choice', 'gap-fill', 'matching', 'writing']).default('multiple-choice')
      })).optional()
    })).default([]),
  }),
});

export const collections = {
  blog,
  resources,
  dictation,
  flashcards,
  exams,
};