import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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
