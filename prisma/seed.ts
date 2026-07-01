// Seed sample data so the dashboard has something to show immediately.
// Run with: npm run db:seed
import { PrismaClient } from "@prisma/client";
import { applyTrade } from "../src/lib/portfolio";

const prisma = new PrismaClient();

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function main() {
  console.log("Clearing existing data…");
  await prisma.trade.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.position.deleteMany();
  await prisma.portfolio.deleteMany();

  const alpha = await prisma.portfolio.create({
    data: { name: "Claw Bot Alpha", type: "FAKE", baseCurrency: "USD" },
  });
  const core = await prisma.portfolio.create({
    data: { name: "Long-Term Core", type: "FAKE", baseCurrency: "USD" },
  });

  console.log("Recording sample trades…");
  const t = async (
    portfolioId: string,
    symbol: string,
    assetType: "CRYPTO" | "STOCK",
    side: "BUY" | "SELL",
    quantity: number,
    price: number,
    days: number,
    approvedBy: string,
  ) =>
    applyTrade({
      portfolioId,
      symbol,
      assetType,
      side,
      quantity,
      price,
      approvedBy,
      source: "BOT",
      executedAt: daysAgo(days),
    });

  await t(alpha.id, "BTC", "CRYPTO", "BUY", 0.05, 61000, 22, "Matan");
  await t(alpha.id, "ETH", "CRYPTO", "BUY", 1.2, 3200, 16, "Dana");
  await t(alpha.id, "SOL", "CRYPTO", "BUY", 12, 145, 11, "Matan");
  await t(alpha.id, "SOL", "CRYPTO", "SELL", 4, 176, 3, "Matan");
  await t(alpha.id, "AAPL", "STOCK", "BUY", 6, 208, 13, "Dana");

  await t(core.id, "BTC", "CRYPTO", "BUY", 0.1, 58000, 27, "Matan");
  await t(core.id, "NVDA", "STOCK", "BUY", 4, 118, 19, "Dana");

  console.log("Adding pending recommendations…");
  await prisma.recommendation.createMany({
    data: [
      {
        symbol: "LINK",
        name: "Chainlink",
        assetType: "CRYPTO",
        rationale:
          "Oracle demand rising with new CCIP integrations; momentum breakout above resistance.",
        targetPrice: 22,
        suggestedQty: 40,
        priceAtRec: 16.5,
      },
      {
        symbol: "MSFT",
        name: "Microsoft",
        assetType: "STOCK",
        rationale:
          "Azure AI revenue re-acceleration; the bot flags a favorable risk/reward into earnings.",
        targetPrice: 480,
        suggestedQty: 3,
        priceAtRec: 430,
      },
    ],
  });

  console.log("Seed complete ✔");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
