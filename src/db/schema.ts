import { relations, sql } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  jsonb,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import db_schema from "./db_schema";

/**
 * How a user authenticated. `google` is live today; the other values are
 * pre-declared so new sign-in channels can be added without a schema change.
 */
export const authMethodEnum = db_schema.enum("auth_method", [
  "google",
  "facebook",
  "line",
  "apple",
  "credentials",
]);

/** Operational account state, separate from authorization roles. */
export const userAccountStatusEnum = db_schema.enum("user_account_status", [
  "active",
  "blocked",
  "disabled",
]);

/** Pending role grants let super admins invite staff before first sign-in. */
export const roleGrantStatusEnum = db_schema.enum("role_grant_status", [
  "pending",
  "accepted",
  "revoked",
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
export const faceEnrollmentStatusEnum = db_schema.enum(
  "face_enrollment_status",
  ["not_registered", "pending", "registered"],
);

/**
 * Lifecycle of a single Rekognition Face Liveness attempt.
 * Terminal states (`succeeded`, `failed`, `expired`, `cancelled`) are never
 * re-used; a new attempt must be created explicitly.
 */
export const livenessAttemptStatusEnum = db_schema.enum(
  "liveness_attempt_status",
  ["pending", "succeeded", "failed", "expired", "cancelled"],
);

/**
 * Why a Face Liveness attempt exists. Enrollment attempts can create/update a
 * face profile after liveness passes; verification attempts only search the
 * existing collection and must never index a new face.
 */
export const faceLivenessIntentEnum = db_schema.enum("face_liveness_intent", [
  "enrollment",
  "verification",
]);

/**
 * Server-side recognition decision attached to a liveness attempt. This keeps
 * repeated result reads idempotent: once a terminal recognition decision is
 * stored, the API can return it without another Rekognition search/index call.
 */
export const faceRecognitionOutcomeEnum = db_schema.enum(
  "face_recognition_outcome",
  ["registered", "verified", "mismatch", "duplicate", "not_indexed"],
);

/** Physical camera intent in the store attendance PoC. */
export const attendanceDirectionEnum = db_schema.enum("attendance_direction", [
  "entry",
  "exit",
  "sighting",
]);

/** Backend decision for one frame submitted by a camera worker. */
export const attendanceRecognitionDecisionEnum = db_schema.enum(
  "attendance_recognition_decision",
  ["recognized", "unknown", "ignored"],
);

/** Current lifecycle of a customer visit inferred from entry/exit cameras. */
export const clientVisitStatusEnum = db_schema.enum("client_visit_status", [
  "inside",
  "exited",
  "unknown_exit",
]);

/**
 * An enrolled user. One row per person, keyed by email. `authMethod` records
 * which channel they last signed in with so we can support multiple providers.
 */
export const users = db_schema.table(
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
    accountStatus: userAccountStatusEnum("account_status")
      .notNull()
      .default("active"),
    disabledUntil: timestamp("disabled_until", { withTimezone: true }),
    disabledReason: text("disabled_reason"),
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

/** Coarse-grained platform roles. Permissions are derived in app code. */
export const roles = db_schema.table("roles", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Users may carry multiple roles as the platform grows. */
export const userRoles = db_schema.table(
  "user_roles",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedByUserId: integer("assigned_by_user_id").references(
      () => users.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

/**
 * Email-based staff grants. A grant can exist before the Google account signs
 * in; on sign-in, matching pending grants are accepted and converted to roles.
 */
export const roleGrants = db_schema.table(
  "role_grants",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    status: roleGrantStatusEnum("status").notNull().default("pending"),
    invitedByUserId: integer("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedByUserId: integer("accepted_by_user_id").references(
      () => users.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("role_grants_email_role_pending_unique")
      .on(table.email, table.roleId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

/** Immutable back-office trail for sensitive admin actions. */
export const adminAuditLogs = db_schema.table("admin_audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  targetUserId: integer("target_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A server-side login session. `id` stores a SHA-256 hash of the opaque token
 * in the user's httpOnly cookie; rows are removed on logout or expiry.
 */
export const sessions = db_schema.table("sessions", {
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
export const faceLivenessAttempts = db_schema.table(
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
export const userFaceProfiles = db_schema.table(
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

/**
 * One camera worker recognition result. The backend stores only metadata,
 * Rekognition IDs, and a SHA-256 digest of the submitted frame; it does not
 * retain the image bytes.
 */
export const clientAttendanceEvents = db_schema.table(
  "client_attendance_events",
  {
    id: serial("id").primaryKey(),
    cameraId: text("camera_id").notNull(),
    direction: attendanceDirectionEnum("direction").notNull(),
    decision: attendanceRecognitionDecisionEnum("decision").notNull(),
    matchedUserId: integer("matched_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    matchedFaceId: text("matched_face_id"),
    similarity: doublePrecision("similarity"),
    imageSha256: text("image_sha256").notNull(),
    workerCapturedAt: timestamp("worker_captured_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/**
 * Store visit session inferred from recognition events. The initial PoC keeps a
 * single open visit per user and closes it when an exit camera recognizes them.
 */
export const clientVisits = db_schema.table(
  "client_visits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: clientVisitStatusEnum("status").notNull().default("inside"),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull(),
    exitedAt: timestamp("exited_at", { withTimezone: true }),
    entryEventId: integer("entry_event_id"),
    exitEventId: integer("exit_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("client_visits_one_open_per_user")
      .on(table.userId)
      .where(sql`${table.status} = 'inside'`),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  faceLivenessAttempts: many(faceLivenessAttempts),
  userRoles: many(userRoles),
  sentRoleGrants: many(roleGrants, { relationName: "roleGrantInviter" }),
  acceptedRoleGrants: many(roleGrants, { relationName: "roleGrantAcceptor" }),
  auditEvents: many(adminAuditLogs, { relationName: "auditActor" }),
  targetedAuditEvents: many(adminAuditLogs, { relationName: "auditTarget" }),
  faceProfile: one(userFaceProfiles),
  attendanceEvents: many(clientAttendanceEvents),
  clientVisits: many(clientVisits),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  roleGrants: many(roleGrants),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedBy: one(users, {
    fields: [userRoles.assignedByUserId],
    references: [users.id],
  }),
}));

export const roleGrantsRelations = relations(roleGrants, ({ one }) => ({
  role: one(roles, {
    fields: [roleGrants.roleId],
    references: [roles.id],
  }),
  invitedBy: one(users, {
    fields: [roleGrants.invitedByUserId],
    references: [users.id],
    relationName: "roleGrantInviter",
  }),
  acceptedBy: one(users, {
    fields: [roleGrants.acceptedByUserId],
    references: [users.id],
    relationName: "roleGrantAcceptor",
  }),
}));

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [adminAuditLogs.actorUserId],
    references: [users.id],
    relationName: "auditActor",
  }),
  target: one(users, {
    fields: [adminAuditLogs.targetUserId],
    references: [users.id],
    relationName: "auditTarget",
  }),
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

export const clientAttendanceEventsRelations = relations(
  clientAttendanceEvents,
  ({ one }) => ({
    matchedUser: one(users, {
      fields: [clientAttendanceEvents.matchedUserId],
      references: [users.id],
    }),
  }),
);

export const clientVisitsRelations = relations(clientVisits, ({ one }) => ({
  user: one(users, {
    fields: [clientVisits.userId],
    references: [users.id],
  }),
}));

/**
 * A physical smart shelf in the store.
 * `id` is the human-readable code encoded in the shelf QR (e.g. "A12").
 */
export const shelves = db_schema.table("shelves", {
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
export const products = db_schema.table("products", {
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
export const shelfProducts = db_schema.table(
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
export type Role = typeof roles.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type RoleGrant = typeof roleGrants.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type FaceLivenessAttempt = typeof faceLivenessAttempts.$inferSelect;
export type NewFaceLivenessAttempt = typeof faceLivenessAttempts.$inferInsert;
export type UserFaceProfile = typeof userFaceProfiles.$inferSelect;
export type NewUserFaceProfile = typeof userFaceProfiles.$inferInsert;
export type ClientAttendanceEvent = typeof clientAttendanceEvents.$inferSelect;
export type NewClientAttendanceEvent =
  typeof clientAttendanceEvents.$inferInsert;
export type ClientVisit = typeof clientVisits.$inferSelect;
export type NewClientVisit = typeof clientVisits.$inferInsert;

/** Union of supported sign-in channels, e.g. "google" | "line" | … */
export type AuthMethod = (typeof authMethodEnum.enumValues)[number];

/** Operational account state. */
export type UserAccountStatus =
  (typeof userAccountStatusEnum.enumValues)[number];

/** Email grant lifecycle. */
export type RoleGrantStatus = (typeof roleGrantStatusEnum.enumValues)[number];

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

/** Camera worker direction. */
export type AttendanceDirection =
  (typeof attendanceDirectionEnum.enumValues)[number];

/** Backend decision for a camera worker frame. */
export type AttendanceRecognitionDecision =
  (typeof attendanceRecognitionDecisionEnum.enumValues)[number];

/** Inferred customer visit lifecycle. */
export type ClientVisitStatus =
  (typeof clientVisitStatusEnum.enumValues)[number];
