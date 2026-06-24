/**
 * Seed script. Run with: npm run db:seed
 *
 * Standalone Node script (run via tsx) — it creates its own Postgres client
 * instead of importing src/db/index.ts, which is marked "server-only".
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { products, shelfProducts, shelves } from "./schema";

process.loadEnvFile();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Did you copy .env.example to .env?",
  );
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema: { products, shelfProducts, shelves } });

const SHELVES = [
  { id: "A12", name: "ชั้นชุดตรวจ ATK", location: "โซนหน้าร้าน แถว A" },
  { id: "B03", name: "ชั้นหน้ากากอนามัย", location: "โซนสุขภาพ แถว B" },
];

const PRODUCTS = [
  {
    sku: "ATK-001",
    name: "ชุดตรวจ ATK แบบจมูก (1 เทสต์)",
    description: "ชุดตรวจหาเชื้อโควิด-19 ด้วยตัวเอง ทราบผลใน 15 นาที",
    priceCents: 3500,
    stock: 120,
    imageUrl: null,
  },
  {
    sku: "ATK-005",
    name: "ชุดตรวจ ATK แบบจมูก (แพ็ก 5 เทสต์)",
    description: "แพ็กประหยัด 5 ชิ้น เหมาะสำหรับครอบครัว",
    priceCents: 15000,
    stock: 60,
    imageUrl: null,
  },
  {
    sku: "ATK-SAL",
    name: "ชุดตรวจ ATK แบบน้ำลาย",
    description: "ตรวจง่ายด้วยน้ำลาย ไม่ต้องแยงจมูก",
    priceCents: 4500,
    stock: 40,
    imageUrl: null,
  },
  {
    sku: "MASK-KF94",
    name: "หน้ากากอนามัย KF94 (10 ชิ้น)",
    description: "หน้ากากทรง 3 มิติ กรองฝุ่นและเชื้อโรค",
    priceCents: 6900,
    stock: 200,
    imageUrl: null,
  },
  {
    sku: "MASK-SUR",
    name: "หน้ากากอนามัยทางการแพทย์ (50 ชิ้น)",
    description: "หน้ากาก 3 ชั้น มาตรฐานทางการแพทย์",
    priceCents: 5900,
    stock: 150,
    imageUrl: null,
  },
];

async function main() {
  console.log("Seeding database...");

  // Idempotent reset so re-running gives a clean dataset.
  await db.delete(shelfProducts);
  await db.delete(products);
  await db.delete(shelves);

  await db.insert(shelves).values(SHELVES);

  const insertedProducts = await db
    .insert(products)
    .values(PRODUCTS)
    .returning({ id: products.id, sku: products.sku });

  const idBySku = new Map(insertedProducts.map((p) => [p.sku, p.id]));

  await db.insert(shelfProducts).values([
    { shelfId: "A12", productId: idBySku.get("ATK-001")!, position: 0 },
    { shelfId: "A12", productId: idBySku.get("ATK-005")!, position: 1 },
    { shelfId: "A12", productId: idBySku.get("ATK-SAL")!, position: 2 },
    { shelfId: "B03", productId: idBySku.get("MASK-KF94")!, position: 0 },
    { shelfId: "B03", productId: idBySku.get("MASK-SUR")!, position: 1 },
  ]);

  console.log(
    `Seeded ${SHELVES.length} shelves and ${PRODUCTS.length} products.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.end());
