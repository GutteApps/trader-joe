import { z } from "zod";

export const assetTypeSchema = z.enum(["CRYPTO", "STOCK"]);
export const portfolioTypeSchema = z.enum(["FAKE", "REAL"]);
export const tradeSideSchema = z.enum(["BUY", "SELL"]);
export const tradeSourceSchema = z.enum(["BOT", "MANUAL"]);

export const createPortfolioSchema = z.object({
  name: z.string().min(1).max(80),
  type: portfolioTypeSchema.default("FAKE"),
  baseCurrency: z.string().min(1).max(8).default("USD"),
});

export const updatePortfolioSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    type: portfolioTypeSchema.optional(),
    baseCurrency: z.string().min(1).max(8).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "at least one field is required",
  });

export const createRecommendationSchema = z.object({
  portfolioId: z.string().optional(),
  symbol: z.string().min(1).max(20),
  name: z.string().max(80).optional(),
  assetType: assetTypeSchema,
  rationale: z.string().max(2000).optional(),
  targetPrice: z.number().positive().optional(),
  suggestedQty: z.number().positive().optional(),
  priceAtRec: z.number().positive().optional(),
});

export const createTradeSchema = z.object({
  portfolioId: z.string().min(1),
  symbol: z.string().min(1).max(20),
  name: z.string().max(80).optional(),
  assetType: assetTypeSchema,
  side: tradeSideSchema,
  quantity: z.number().positive(),
  // Price is optional: if omitted we fetch the current market price.
  price: z.number().nonnegative().optional(),
  fee: z.number().nonnegative().optional(),
  approvedBy: z.string().max(80).optional(),
  source: tradeSourceSchema.default("BOT"),
  note: z.string().max(500).optional(),
  // ISO 8601 string; defaults to now.
  executedAt: z.string().datetime().optional(),
  // Optionally tie this trade to a recommendation the bot posted earlier.
  recommendationId: z.string().optional(),
});

export type CreateTradeInput = z.infer<typeof createTradeSchema>;
