import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders'; // Loader bắt buộc cho Astro 6

const blog = defineCollection({
  // Chỉ định rõ chỗ chứa bài viết cho "xe tải" glob đi bốc hàng
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    pubDate: z.coerce.date().optional(), // Ép kiểu ngày tháng để không lỗi
    image: z.string().optional(),
    /** Lựa chọn: Admin viết 100% hay có hỗ trợ AI */
    writingType: z.enum(["admin", "ai-assisted"]).optional(),
    /** Nút link ngắn: nhãn hiển thị + URL dài ẩn trong href */
    resources: z
      .array(
        z.object({
          label: z.string().min(1),
          url: z.string().min(1),
        }),
      )
      .optional(),
  }),
});

export const collections = { blog };