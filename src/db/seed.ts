/**
 * Seed script. Run with: npm run db:seed
 *
 * Standalone Node script (run via tsx) — it creates its own Postgres client
 * instead of importing src/db/index.ts, which is marked "server-only".
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";

import {
  inventories,
  roles,
  units,
  userRoles,
  users,
  walletFundingChannels,
} from "./schema";

process.loadEnvFile();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Did you copy .env.example to .env?",
  );
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, {
  schema: {
    inventories,
    roles,
    units,
    userRoles,
    users,
    walletFundingChannels,
  },
});

const INVENTORIES = [
  {
    name: "ชุดตรวจ ATK แบบจมูก (1 เทสต์)",
    description: "ชุดตรวจหาเชื้อโควิด-19 ด้วยตัวเอง ทราบผลใน 15 นาที",
    price: 35,
    amount: 120,
    weightPerPiece: 25,
    imageUrl: null,
  },
  {
    name: "ชุดตรวจ ATK แบบจมูก (แพ็ก 5 เทสต์)",
    description: "แพ็กประหยัด 5 ชิ้น เหมาะสำหรับครอบครัว",
    price: 150,
    amount: 60,
    weightPerPiece: 120,
    imageUrl: null,
  },
  {
    name: "ชุดตรวจ ATK แบบน้ำลาย",
    description: "ตรวจง่ายด้วยน้ำลาย ไม่ต้องแยงจมูก",
    price: 45,
    amount: 40,
    weightPerPiece: 30,
    imageUrl: null,
  },
  {
    name: "หน้ากากอนามัย KF94 (10 ชิ้น)",
    description: "หน้ากากทรง 3 มิติ กรองฝุ่นและเชื้อโรค",
    price: 69,
    amount: 200,
    weightPerPiece: 85,
    imageUrl: null,
  },
  {
    name: "หน้ากากอนามัยทางการแพทย์ (50 ชิ้น)",
    description: "หน้ากาก 3 ชั้น มาตรฐานทางการแพทย์",
    price: 59,
    amount: 150,
    weightPerPiece: 180,
    imageUrl: null,
  },
];

const MOCK_CLIENTS = [
  {
    email: "mali.wong@example.com",
    name: "Mali Wong",
    providerAccountId: "mock-client-mali-wong",
  },
  {
    email: "narin.sukjai@example.com",
    name: "Narin Sukjai",
    providerAccountId: "mock-client-narin-sukjai",
  },
  {
    email: "pimchanok.k@example.com",
    name: "Pimchanok K.",
    providerAccountId: "mock-client-pimchanok-k",
  },
  {
    email: "tanawat.lee@example.com",
    name: "Tanawat Lee",
    providerAccountId: "mock-client-tanawat-lee",
  },
  {
    email: "siriporn.cha@example.com",
    name: "Siriporn Cha",
    providerAccountId: "mock-client-siriporn-cha",
  },
];

const WALLET_FUNDING_CHANNELS = [
  {
    channelCode: "card" as const,
    displayName: "Credit / debit card",
    stripePaymentMethodType: "card",
  },
  {
    channelCode: "promptpay" as const,
    displayName: "PromptPay",
    stripePaymentMethodType: "promptpay",
  },
];

async function main() {
  console.log("Seeding database...");

  await db
    .insert(roles)
    .values([
      { code: "client", name: "Client" },
      { code: "admin", name: "Admin" },
      { code: "super_admin", name: "Super Admin" },
    ])
    .onConflictDoNothing();

  const [clientRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, "client"))
    .limit(1);

  if (!clientRole) {
    throw new Error("Missing client role after seed initialization");
  }

  await db
    .insert(users)
    .values(
      MOCK_CLIENTS.map((client) => ({
        email: client.email,
        name: client.name,
        authMethod: "google" as const,
        providerAccountId: client.providerAccountId,
        faceEnrollmentStatus: "not_registered" as const,
        accountStatus: "active" as const,
      })),
    )
    .onConflictDoNothing();

  const mockUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      inArray(
        users.email,
        MOCK_CLIENTS.map((client) => client.email),
      ),
    );

  if (mockUsers.length > 0) {
    await db
      .insert(userRoles)
      .values(
        mockUsers.map((user) => ({
          userId: user.id,
          roleId: clientRole.id,
        })),
      )
      .onConflictDoNothing();
  }

  await db
    .insert(walletFundingChannels)
    .values(
      [false, true].flatMap((livemode) =>
        WALLET_FUNDING_CHANNELS.map((channel) => ({
          ...channel,
          provider: "stripe" as const,
          livemode,
          minAmountMinor: 1000,
          maxAmountMinor: 2000000,
          isEnabled: true,
          updatedAt: new Date(),
        })),
      ),
    )
    .onConflictDoNothing();

  // Idempotent reset so re-running gives a clean dataset.
  await db.delete(inventories);
  await db.delete(units);

  const [gram] = await db
    .insert(units)
    .values({ name: "gram", updatedAt: new Date() })
    .returning({ id: units.id });
  if (!gram) throw new Error("Failed to seed gram unit");

  await db.insert(inventories).values(
    INVENTORIES.map((inventory) => ({
      ...inventory,
      unitId: gram.id,
      isActive: true,
      updatedAt: new Date(),
    })),
  );

  console.log(
    `Seeded ${INVENTORIES.length} inventories and ${MOCK_CLIENTS.length} mock clients.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.end());
