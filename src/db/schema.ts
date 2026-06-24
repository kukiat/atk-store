import { relations } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * How a user authenticated. `google` is live today; the other values are
 * pre-declared so new sign-in channels can be added without a schema change.
 */
export const authMethodEnum = pgEnum("auth_method", [
  "google",
  "facebook",
  "line",
  "apple",
  "credentials",
]);

/**
 * An enrolled user. One row per person, keyed by email. `authMethod` records
 * which channel they last signed in with so we can support multiple providers.
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    authMethod: authMethodEnum("auth_method").notNull().default("google"),
    // Provider-specific immutable subject (Google OpenID Connect `sub`).
    providerAccountId: text("provider_account_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("users_auth_method_provider_account_id_unique").on(
      table.authMethod,
      table.providerAccountId,
    ),
  ],
);

/**
 * A server-side login session. `id` stores a SHA-256 hash of the opaque token
 * in the user's httpOnly cookie; rows are removed on logout or expiry.
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

/**
 * A physical smart shelf in the store.
 * `id` is the human-readable code encoded in the shelf QR (e.g. "A12").
 */
export const shelves = pgTable("shelves", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A product in the catalog. Prices are stored as integer minor units
 * (satang) to avoid floating-point money bugs.
 */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  imageUrl: text("image_url"),
  stock: integer("stock").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Many-to-many join between shelves and products.
 * A product can live on several shelves; `position` orders it on a shelf.
 */
export const shelfProducts = pgTable(
  "shelf_products",
  {
    shelfId: text("shelf_id")
      .notNull()
      .references(() => shelves.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.shelfId, table.productId] })],
);

export const shelvesRelations = relations(shelves, ({ many }) => ({
  shelfProducts: many(shelfProducts),
}));

export const productsRelations = relations(products, ({ many }) => ({
  shelfProducts: many(shelfProducts),
}));

export const shelfProductsRelations = relations(shelfProducts, ({ one }) => ({
  shelf: one(shelves, {
    fields: [shelfProducts.shelfId],
    references: [shelves.id],
  }),
  product: one(products, {
    fields: [shelfProducts.productId],
    references: [products.id],
  }),
}));

export type Shelf = typeof shelves.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ShelfProduct = typeof shelfProducts.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;

/** Union of supported sign-in channels, e.g. "google" | "line" | … */
export type AuthMethod = (typeof authMethodEnum.enumValues)[number];
