// zod validation schemas — the runtime contract for API input and AI output.
import { z } from 'zod';
import { CATEGORIES, SEVERITIES, ISSUE_STATUSES } from './types.js';

export const categorySchema = z.enum(CATEGORIES);
export const severitySchema = z.enum(SEVERITIES);
export const issueStatusSchema = z.enum(ISSUE_STATUSES);

export const geoLocationSchema = z.object({
  label: z.string().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const createReportSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    text: z.string().trim().max(4000).optional(),
    category: categorySchema.optional(),
    location: geoLocationSchema.optional(),
    userId: z.string().trim().max(80).optional(),
    hasImage: z.boolean().optional(),
    imageContentType: z.enum(ALLOWED_IMAGE_TYPES).optional(),
  })
  .refine((v) => (v.title && v.title.length > 0) || (v.text && v.text.length > 0) || v.hasImage, {
    message: 'Provide text, a title, or an image.',
  })
  .refine((v) => !v.hasImage || !!v.imageContentType, {
    message: 'imageContentType is required when hasImage is true.',
  });
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const presignSchema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  reportId: z.string().trim().min(1).max(80),
});

export const updateIssueStatusSchema = z.object({
  status: issueStatusSchema,
});

export const askSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

export const listQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// AI model output contract. Lenient inputs (strings for numbers) are coerced/repaired.
export const aiAnalysisSchema = z.object({
  category: categorySchema,
  issue_type: z.string().min(1).max(80),
  summary: z.string().min(1).max(400),
  severity: severitySchema,
  confidence: z.coerce.number().min(0).max(1),
  evidence: z.object({
    text: z.array(z.string().max(300)).max(12).default([]),
    image: z.array(z.string().max(300)).max(12).default([]),
  }),
  recommended_action: z.string().min(1).max(400),
  reasoning_summary: z.string().min(1).max(600),
});
export type AiAnalysisParsed = z.infer<typeof aiAnalysisSchema>;
