import { relations, sql } from "drizzle-orm";
import {
  doublePrecision,
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
 * Server-authoritative face-enrollment state, derived only from a backend
 * liveness decision. The UI reads this single flag to drive the post-login
 * prompt without joining the attempt table on every page render.
 *
 * - `not_registered`: never accepted (or a previous attempt failed/expired).
 * - `pending`: an attempt is in flight.
 * - `registered`: a liveness attempt passed and a face profile was indexed.
 */
export const faceEnrollmentStatusEnum = pgEnum("face_enrollment_status", [
  "not_registered",
  "pending",
  "registered",
]);

/**
 * Lifecycle of a single Rekognition Face Liveness attempt.
 * Terminal states (`succeeded`, `failed`, `expired`, `cancelled`) are never
 * re-used; a new attempt must be created explicitly.
 */
export const livenessAttemptStatusEnum = pgEnum("liveness_attempt_status", [
  "pending",
  "succeeded",
  "failed",
  "expired",
  "cancelled",
]);

/**
 * Why a Face Liveness attempt exists. Enrollment attempts can create/update a
 * face profile after liveness passes; verification attempts only search the
 * existing collection and must never index a new face.
 */
export const faceLivenessIntentEnum = pgEnum("face_liveness_intent", [
  "enrollment",
  "verification",
]);

/**
 * Server-side recognition decision attached to a liveness attempt. This keeps
 * repeated result reads idempotent: once a terminal recognition decision is
 * stored, the API can return it without another Rekognition search/index call.
 */
export const faceRecognitionOutcomeEnum = pgEnum("face_recognition_outcome", [
  "registered",
  "verified",
  "mismatch",
  "duplicate",
  "not_indexed",
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
    // Face enrollment is gated behind a backend liveness decision; defaults to
    // not registered until one attempt is accepted.
    faceEnrollmentStatus: faceEnrollmentStatusEnum("face_enrollment_status")
      .notNull()
      .default("not_registered"),
    faceRegisteredAt: timestamp("face_registered_at", { withTimezone: true }),
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

/**
 * One Rekognition Face Liveness attempt per row. Stores only the metadata the
 * app needs to deduplicate requests, read an owned result, and audit a decision.
 * It deliberately stores no raw selfie video and no long-lived AWS credentials;
 * `referenceS3Key` points at the private Tokyo output object, not its bytes.
 */
export const faceLivenessAttempts = pgTable(
  "face_liveness_attempts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Rekognition `SessionId` (single-use, ~3 minute lifetime).
    sessionId: text("session_id").notNull().unique(),
    // Idempotency token passed to CreateFaceLivenessSession.
    clientRequestToken: text("client_request_token").notNull(),
    // Whether this liveness session is for first-time enrollment or later verify.
    intent: faceLivenessIntentEnum("intent").notNull().default("enrollment"),
    status: livenessAttemptStatusEnum("status").notNull().default("pending"),
    // Rekognition confidence (0-100); null until a result is read.
    confidence: doublePrecision("confidence"),
    // S3 key of the verified reference image in the private output bucket.
    referenceS3Key: text("reference_s3_key"),
    // Recognition metadata, set only after liveness reaches a terminal result.
    recognitionOutcome: faceRecognitionOutcomeEnum("recognition_outcome"),
    matchedFaceId: text("matched_face_id"),
    matchedUserId: integer("matched_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    faceSimilarity: doublePrecision("face_similarity"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // At most one in-flight attempt per user; terminal attempts don't conflict.
    uniqueIndex("face_liveness_attempts_one_active_per_user")
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

/**
 * A face indexed in an Amazon Rekognition collection and owned by one app user.
 *
 * The collection stores AWS-managed facial features; this table deliberately
 * stores only business metadata and the IDs Rekognition returns. It is not a
 * vector database and does not contain raw face embeddings.
 */
export const userFaceProfiles = pgTable(
  "user_face_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionId: text("collection_id").notNull(),
    faceId: text("face_id").notNull(),
    imageId: text("image_id"),
    externalImageId: text("external_image_id").notNull(),
    confidence: doublePrecision("confidence"),
    referenceS3Key: text("reference_s3_key"),
    livenessAttemptId: integer("liveness_attempt_id").references(
      () => faceLivenessAttempts.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_face_profiles_user_id_unique").on(table.userId),
    uniqueIndex("user_face_profiles_face_id_unique").on(table.faceId),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  faceLivenessAttempts: many(faceLivenessAttempts),
  faceProfile: one(userFaceProfiles),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const faceLivenessAttemptsRelations = relations(
  faceLivenessAttempts,
  ({ one }) => ({
    user: one(users, {
      fields: [faceLivenessAttempts.userId],
      references: [users.id],
    }),
    matchedUser: one(users, {
      fields: [faceLivenessAttempts.matchedUserId],
      references: [users.id],
    }),
  }),
);

export const userFaceProfilesRelations = relations(
  userFaceProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [userFaceProfiles.userId],
      references: [users.id],
    }),
    livenessAttempt: one(faceLivenessAttempts, {
      fields: [userFaceProfiles.livenessAttemptId],
      references: [faceLivenessAttempts.id],
    }),
  }),
);

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
export type FaceLivenessAttempt = typeof faceLivenessAttempts.$inferSelect;
export type NewFaceLivenessAttempt = typeof faceLivenessAttempts.$inferInsert;
export type UserFaceProfile = typeof userFaceProfiles.$inferSelect;
export type NewUserFaceProfile = typeof userFaceProfiles.$inferInsert;

/** Union of supported sign-in channels, e.g. "google" | "line" | … */
export type AuthMethod = (typeof authMethodEnum.enumValues)[number];

/** Server-authoritative face-enrollment state used by the UI prompt. */
export type FaceEnrollmentStatus =
  (typeof faceEnrollmentStatusEnum.enumValues)[number];

/** Lifecycle state of a single liveness attempt. */
export type LivenessAttemptStatus =
  (typeof livenessAttemptStatusEnum.enumValues)[number];

/** Intent of a single liveness attempt. */
export type FaceLivenessIntent =
  (typeof faceLivenessIntentEnum.enumValues)[number];

/** Stored recognition decision for a terminal liveness attempt. */
export type FaceRecognitionOutcome =
  (typeof faceRecognitionOutcomeEnum.enumValues)[number];
