import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export const signupSchema = loginSchema.extend({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(24, "Username must be 24 characters or less")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
});

export const carSchema = z.object({
  make: z
    .string()
    .min(1, "Make is required")
    .max(50, "Make must be 50 characters or less"),
  model: z
    .string()
    .min(1, "Model is required")
    .max(80, "Model must be 80 characters or less"),
  year: z
    .number()
    .int()
    .min(1886, "Year must be 1886 or later")
    .max(new Date().getFullYear() + 1, "Year cannot be in the future"),
  trim: z
    .string()
    .max(80)
    .optional()
    .nullable(),
  color: z
    .string()
    .max(40)
    .optional()
    .nullable(),
  nickname: z
    .string()
    .max(60)
    .optional()
    .nullable(),
  vin: z
    .string()
    .length(17, "VIN must be exactly 17 characters")
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, "Invalid VIN format")
    .optional()
    .nullable(),
  is_public: z.boolean().default(false),
});

export const modSchema = z.object({
  name: z
    .string()
    .min(1, "Mod name is required")
    .max(120, "Name must be 120 characters or less"),
  category: z.enum([
    "engine",
    "suspension",
    "aero",
    "interior",
    "wheels",
    "exhaust",
    "electronics",
    "other",
  ]),
  cost: z
    .number()
    .min(0, "Cost cannot be negative")
    .max(1_000_000, "Cost is unrealistically high")
    .optional()
    .nullable(),
  install_date: z
    .string()
    .optional()
    .nullable(),
  shop_name: z
    .string()
    .max(100)
    .optional()
    .nullable(),
  is_diy: z.boolean().default(false),
  notes: z
    .string()
    .max(2000, "Notes must be 2000 characters or less")
    .optional()
    .nullable(),
  status: z.enum(["installed", "wishlist"]).default("installed"),
});

export const commentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(500, "Comment must be 500 characters or less"),
});

export const visualizerSchema = z.object({
  car_id: z.string().uuid(),
  prompt: z
    .string()
    .min(5, "Describe at least one modification")
    .max(500, "Keep the description under 500 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CarInput = z.infer<typeof carSchema>;
export type ModInput = z.infer<typeof modSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type VisualizerInput = z.infer<typeof visualizerSchema>;
