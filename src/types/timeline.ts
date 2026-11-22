import { z } from "zod";

export const timelineCategorySchema = z.enum([
  "pain",
  "exercise",
  "clinical_record",
]);

export type TimelineCategory = z.infer<typeof timelineCategorySchema>;

export const timelineEventSchema = z.object({
  id: z.string().uuid(),
  category: timelineCategorySchema,
  title: z.string(),
  summary: z.string().nullable().optional(),
  occurred_at: z.string().datetime({ offset: true }),
  intensity: z.number().int().min(0).max(10).nullable().optional(),
  region: z.string().nullable().optional(),
});

export type TimelineEvent = z.infer<typeof timelineEventSchema>;

export const timelinePageSchema = z.object({
  items: z.array(timelineEventSchema),
  next_cursor: z.string().uuid().nullable().optional(),
});

export const calendarDaySummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pain_count: z.number().int().min(0).default(0),
  exercise_count: z.number().int().min(0).default(0),
  clinical_record_count: z.number().int().min(0).default(0),
});

export type CalendarDaySummary = z.infer<typeof calendarDaySummarySchema>;

export const calendarMonthSchema = z.object({
  month: z.string(),
  days: z.array(calendarDaySummarySchema),
});

export const categoryLabels: Record<TimelineCategory, string> = {
  pain: "Diário de dor",
  exercise: "Exercício concluído",
  clinical_record: "Prontuário clínico",
};