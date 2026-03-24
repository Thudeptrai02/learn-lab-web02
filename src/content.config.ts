import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders'; // <-- Khai báo thêm "máy hút dữ liệu" glob

// 1. Schema cho Blog
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }), // Hút file .md từ thư mục blog
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string().optional(),
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
const dictation = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/dictation" }),
  schema: z.object({
    title: z.string(),
    exam: z.enum(['TOEIC', 'IELTS', 'Cambridge']),
    audio: z.string(),
    translation: z.string().optional(),
  }),
});

// 4. Schema cho Flashcards
const flashcards = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/flashcards" }),
  schema: z.object({
    title: z.string(),
    exam: z.enum(['TOEIC', 'IELTS', 'Cambridge']),
    words: z.array(
      z.object({
        word: z.string(),
        type: z.string(),
        meaning: z.string(),
        example: z.string().optional(),
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