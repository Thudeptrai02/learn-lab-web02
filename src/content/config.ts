import { defineCollection, z } from 'astro:content';

// 1. Schema cho Blog
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string().optional(), // optional() nghĩa là có thể để trống
  }),
});

// 2. Schema cho Tài liệu Free
const resources = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    url: z.string(),
    type: z.enum(['PDF', 'Worksheet', 'Checklist']), // Chỉ cho phép 3 giá trị này
  }),
});

// 3. Schema cho Dictation (Nghe chép chính tả)
const dictation = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    exam: z.enum(['TOEIC', 'IELTS', 'Cambridge']),
    audio: z.string(), // File audio trên Decap sẽ được lưu dưới dạng đường dẫn (string)
    translation: z.string().optional(),
  }),
});

// 4. Schema cho Flashcards
const flashcards = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    exam: z.enum(['TOEIC', 'IELTS', 'Cambridge']),
    // Đây là mảng (array) chứa danh sách các từ vựng
    words: z.array(
      z.object({
        word: z.string(),
        type: z.string(),
        meaning: z.string(),
        example: z.string().optional(),
      })
    ).default([]), // Mặc định là mảng rỗng nếu chưa có từ nào
  }),
});

// 5. Schema cho Đề kiểm tra (Exams)
const exams = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    exam: z.enum(['TOEIC', 'IELTS', 'Cambridge']),
    // Mảng chứa danh sách các câu hỏi
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

// Cuối cùng, xuất (export) tất cả các collections này ra để Astro sử dụng
export const collections = {
  blog,
  resources,
  dictation,
  flashcards,
  exams,
};