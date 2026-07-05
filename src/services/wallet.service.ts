import "server-only";

import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import {
  clientVisits,
  inventories,
  notifications,
  orderItems,
  orderPayments,
  orders,
  receiptItems,
  receipts,
  storeSettings,
  stripeCustomers,
  stripeWebhookEvents,
  units,
  users,
  walletFundingChannels,
  walletLedgerEntries,
  wallets,
  walletTopupIntents,
  type User,
  type WalletFundingChannelCode,
} from "@/db/schema";
import {
  assertPositiveMinorUnit,
  bahtToMinorUnit,
  WALLET_CURRENCY,
} from "@/lib/money";
import { getAppOrigin, getStripeClient, getStripeConfig } from "@/lib/stripe";
import { cartSyncService } from "@/services/cart-sync.service";
import { publishCheckoutStatus } from "@/services/order-events.service";

export class WalletInsufficientBalanceError extends Error {
  constructor() {
    super("insufficient_wallet_balance");
    this.name = "WalletInsufficientBalanceError";
  }
}

const DEFAULT_CHANNELS: {
  channelCode: WalletFundingChannelCode;
  displayName: string;
  stripePaymentMethodType: string;
  minAmountMinor: number;
  maxAmountMinor: number;
}[] = [
  {
    channelCode: "card",
    displayName: "Credit / debit card",
    stripePaymentMethodType: "card",
    minAmountMinor: 1000,
    maxAmountMinor: 2000000,
  },
  {
    channelCode: "promptpay",
    displayName: "PromptPay",
    stripePaymentMethodType: "promptpay",
    minAmountMinor: 1000,
    maxAmountMinor: 2000000,
  },
];

const DEFAULT_STORE_SETTINGS = {
  storeName: "ATK Store",
  storeLegalName: null as string | null,
  storeTaxId: null as string | null,
  storeAddress: null as string | null,
  storePhone: null as string | null,
  storeEmail: null as string | null,
  vatPercent: 0,
  receiptPrefix: "RC",
  currency: WALLET_CURRENCY,
};

function formatReceiptNo(
  prefix: string,
  issuedAt: Date,
  orderId: string,
): string {
  const yyyy = issuedAt.getFullYear();
  const mm = String(issuedAt.getMonth() + 1).padStart(2, "0");
  const dd = String(issuedAt.getDate()).padStart(2, "0");
  const orderSegment = orderId.replaceAll("-", "").slice(0, 12).toUpperCase();
  return `${prefix}${yyyy}${mm}${dd}-${orderSegment}`;
}

function calculateIncludedVat(totalMinor: number, vatPercent: number): number {
  if (vatPercent <= 0) return 0;
  return Math.round((totalMinor * vatPercent) / (100 + vatPercent));
}

function stripeObjectId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function toStripeMetadata(
  values: Record<string, string | number | boolean | null | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

class WalletService {
  async ensureDefaultFundingChannels(): Promise<void> {
    const { livemode } = getStripeConfig();

    for (const channel of DEFAULT_CHANNELS) {
      await db
        .insert(walletFundingChannels)
        .values({
          ...channel,
          provider: "stripe",
          livemode,
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }
  }

  async getOrCreateWallet(userId: number) {
    const existing = await db.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    });
    if (existing) return existing;

    const [created] = await db
      .insert(wallets)
      .values({ userId, updatedAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    });
    if (!wallet) throw new Error("Failed to create wallet");
    return wallet;
  }

  async getWalletSnapshot(userId: number) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      balanceAvailableMinor: wallet.balanceAvailableMinor,
      balancePendingMinor: wallet.balancePendingMinor,
      status: wallet.status,
    };
  }

  async getWalletOverview(userId: number) {
    await this.ensureDefaultFundingChannels();
    const wallet = await this.getOrCreateWallet(userId);
    const { livemode } = getStripeConfig();

    const [channels, topups, ledgerEntries] = await Promise.all([
      db.query.walletFundingChannels.findMany({
        where: and(
          eq(walletFundingChannels.provider, "stripe"),
          eq(walletFundingChannels.livemode, livemode),
          eq(walletFundingChannels.isEnabled, true),
        ),
        orderBy: walletFundingChannels.channelCode,
      }),
      db.query.walletTopupIntents.findMany({
        where: eq(walletTopupIntents.walletId, wallet.id),
        orderBy: desc(walletTopupIntents.createdAt),
        limit: 10,
      }),
      db.query.walletLedgerEntries.findMany({
        where: eq(walletLedgerEntries.walletId, wallet.id),
        orderBy: desc(walletLedgerEntries.createdAt),
        limit: 20,
      }),
    ]);

    return { wallet, channels, topups, ledgerEntries, livemode };
  }

  async getTopupIntentForUserSession(
    userId: number,
    checkoutSessionId: string,
  ) {
    const wallet = await this.getOrCreateWallet(userId);
    return db.query.walletTopupIntents.findFirst({
      where: and(
        eq(walletTopupIntents.walletId, wallet.id),
        eq(walletTopupIntents.stripeCheckoutSessionId, checkoutSessionId),
      ),
    });
  }

  async createTopUpCheckoutSession(
    user: User,
    amountMinor: number,
    channelCode: WalletFundingChannelCode,
  ): Promise<{ url: string; topupIntentId: string }> {
    assertPositiveMinorUnit(amountMinor);
    await this.ensureDefaultFundingChannels();

    const config = getStripeConfig();
    const stripe = getStripeClient();
    const wallet = await this.getOrCreateWallet(user.id);

    const channel = await db.query.walletFundingChannels.findFirst({
      where: and(
        eq(walletFundingChannels.provider, "stripe"),
        eq(walletFundingChannels.channelCode, channelCode),
        eq(walletFundingChannels.livemode, config.livemode),
        eq(walletFundingChannels.isEnabled, true),
      ),
    });
    if (!channel) throw new Error("Selected funding channel is not available");
    if (
      amountMinor < channel.minAmountMinor ||
      amountMinor > channel.maxAmountMinor
    ) {
      throw new Error("Top-up amount is outside the allowed range");
    }

    const stripeCustomer = await this.getOrCreateStripeCustomer(user);
    const [topupIntent] = await db
      .insert(walletTopupIntents)
      .values({
        walletId: wallet.id,
        stripeCustomerRecordId: stripeCustomer.id,
        requestedChannel: channel.channelCode,
        amountMinor,
        currency: WALLET_CURRENCY,
        status: "created",
        livemode: config.livemode,
        updatedAt: new Date(),
      })
      .returning();
    if (!topupIntent) throw new Error("Failed to create top-up intent");

    const origin = getAppOrigin();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomer.stripeCustomerId,
      payment_method_types: [
        channel.stripePaymentMethodType as Stripe.Checkout.SessionCreateParams.PaymentMethodType,
      ],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "thb",
            unit_amount: amountMinor,
            product_data: {
              name: "ATK Store wallet top-up",
            },
          },
        },
      ],
      success_url: `${origin}/wallet/topup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/wallet?topup=cancelled`,
      metadata: toStripeMetadata({
        topupIntentId: topupIntent.id,
        walletId: wallet.id,
        userId: user.id,
        requestedChannel: channel.channelCode,
      }),
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a Checkout URL");
    }

    await db
      .update(walletTopupIntents)
      .set({
        status: "checkout_open",
        stripeCheckoutSessionId: checkoutSession.id,
        stripePaymentIntentId: stripeObjectId(checkoutSession.payment_intent),
        checkoutUrl: checkoutSession.url,
        updatedAt: new Date(),
      })
      .where(eq(walletTopupIntents.id, topupIntent.id));

    return {
      url: checkoutSession.url,
      topupIntentId: topupIntent.id,
    };
  }

  async handleStripeWebhook(rawBody: string, signature: string | null) {
    if (!signature) throw new Error("Missing Stripe-Signature header");

    const config = getStripeConfig();
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.webhookSecret,
    );

    const [storedEvent] = await db
      .insert(stripeWebhookEvents)
      .values({
        stripeEventId: event.id,
        eventType: event.type,
        livemode: event.livemode,
        processingStatus: "processing",
        payload: event as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    if (!storedEvent) {
      return { status: "duplicate" as const, eventId: event.id };
    }

    try {
      const processed = await this.processStripeEvent(event);
      await db
        .update(stripeWebhookEvents)
        .set({
          processingStatus: processed ? "processed" : "ignored",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stripeWebhookEvents.id, storedEvent.id));

      return {
        status: processed ? ("processed" as const) : ("ignored" as const),
        eventId: event.id,
      };
    } catch (error) {
      await db
        .update(stripeWebhookEvents)
        .set({
          processingStatus: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date(),
        })
        .where(eq(stripeWebhookEvents.id, storedEvent.id));
      throw error;
    }
  }

  async payOrderFromWallet(clientVisitId: number) {
    const cart = await cartSyncService.getCart(clientVisitId);
    if (!cart || cart.items.length === 0) {
      throw new Error("No synced cart found for this client visit");
    }

    const totalMinor = cart.items.reduce(
      (sum, item) => sum + bahtToMinorUnit(item.price) * item.quantity,
      0,
    );
    assertPositiveMinorUnit(totalMinor);

    const result = await db.transaction(async (tx) => {
      const [visit] = await tx
        .select({
          id: clientVisits.id,
          userId: clientVisits.userId,
          status: clientVisits.status,
        })
        .from(clientVisits)
        .where(eq(clientVisits.id, clientVisitId))
        .limit(1);
      if (!visit) throw new Error("Client visit was not found");

      let [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, visit.userId))
        .limit(1);

      if (!wallet) {
        [wallet] = await tx
          .insert(wallets)
          .values({ userId: visit.userId, updatedAt: new Date() })
          .returning();
      }
      if (!wallet) throw new Error("Failed to create wallet");

      const idempotencyKey = `order:${clientVisitId}:${cart.sessionId}`;
      const existingLedger = await tx.query.walletLedgerEntries.findFirst({
        where: eq(walletLedgerEntries.idempotencyKey, idempotencyKey),
      });
      if (existingLedger) {
        const existingPayment = await tx.query.orderPayments.findFirst({
          where: eq(orderPayments.ledgerEntryId, existingLedger.id),
          with: { order: { with: { receipt: true } } },
        });
        if (existingPayment?.order) {
          return {
            status: "paid" as const,
            order: existingPayment.order,
            receipt: existingPayment.order.receipt ?? null,
            userId: visit.userId,
          };
        }
      }

      const [updatedWallet] = await tx
        .update(wallets)
        .set({
          balanceAvailableMinor: sql`${wallets.balanceAvailableMinor} - ${totalMinor}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(wallets.id, wallet.id),
            eq(wallets.status, "active"),
            gte(wallets.balanceAvailableMinor, totalMinor),
          ),
        )
        .returning();

      if (!updatedWallet) {
        return {
          status: "insufficient" as const,
          userId: visit.userId,
        };
      }

      for (const item of cart.items) {
        const [updatedInventory] = await tx
          .update(inventories)
          .set({
            amount: sql`${inventories.amount} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(inventories.id, item.inventoryId),
              eq(inventories.isActive, true),
              gte(inventories.amount, item.quantity),
            ),
          )
          .returning({ id: inventories.id });

        if (!updatedInventory) {
          throw new Error(`${item.name} does not have enough stock`);
        }
      }

      const [ledgerEntry] = await tx
        .insert(walletLedgerEntries)
        .values({
          walletId: wallet.id,
          direction: "debit",
          type: "order_debit",
          amountMinor: totalMinor,
          currency: WALLET_CURRENCY,
          balanceAfterMinor: updatedWallet.balanceAvailableMinor,
          idempotencyKey,
          referenceType: "client_visit",
          referenceId: String(clientVisitId),
          metadata: { sessionId: cart.sessionId },
        })
        .returning();
      if (!ledgerEntry) throw new Error("Failed to create wallet ledger entry");

      const totalPrice = totalMinor / 100;
      const [order] = await tx
        .insert(orders)
        .values({
          clientVisitId,
          status: "paid",
          paymentStatus: "paid",
          totalPrice,
          paymentReference: `wallet:${ledgerEntry.id}`,
          updatedAt: new Date(),
        })
        .returning();
      if (!order) throw new Error("Failed to create order");

      const insertedOrderItems = await tx
        .insert(orderItems)
        .values(
          cart.items.map((item) => ({
            orderId: order.id,
            inventoryId: item.inventoryId,
            name: item.name,
            price: item.price,
            amount: item.quantity,
            weightPerPiece: item.weightPerPiece,
            unitId: item.unitId,
            imageUrl: item.imageUrl,
            updatedAt: new Date(),
          })),
        )
        .returning();

      const [payment] = await tx
        .insert(orderPayments)
        .values({
          orderId: order.id,
          walletId: wallet.id,
          ledgerEntryId: ledgerEntry.id,
          paymentMethod: "wallet",
          amountMinor: totalMinor,
          currency: WALLET_CURRENCY,
          status: "paid",
          idempotencyKey,
          updatedAt: new Date(),
        })
        .returning();
      if (!payment) throw new Error("Failed to create order payment");

      const [customer] = await tx
        .select({
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, visit.userId))
        .limit(1);
      if (!customer) throw new Error("Order customer was not found");

      const [settings] = await tx
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.key, "default"))
        .limit(1);
      const effectiveStoreSettings = settings ?? DEFAULT_STORE_SETTINGS;
      const unitRows = await tx
        .select({ id: units.id, name: units.name })
        .from(units)
        .where(inArray(units.id, cart.items.map((item) => item.unitId)));
      const unitNameById = new Map(unitRows.map((unit) => [unit.id, unit.name]));
      const issuedAt = new Date();
      const vatMinor = calculateIncludedVat(
        totalMinor,
        effectiveStoreSettings.vatPercent,
      );
      const subtotalMinor = totalMinor - vatMinor;
      const [receipt] = await tx
        .insert(receipts)
        .values({
          orderId: order.id,
          clientVisitId,
          userId: visit.userId,
          receiptNo: formatReceiptNo(
            effectiveStoreSettings.receiptPrefix,
            issuedAt,
            order.id,
          ),
          issuedAt,
          customerName: customer.name,
          customerEmail: customer.email,
          storeName: effectiveStoreSettings.storeName,
          storeLegalName: effectiveStoreSettings.storeLegalName,
          storeTaxId: effectiveStoreSettings.storeTaxId,
          storeAddress: effectiveStoreSettings.storeAddress,
          storePhone: effectiveStoreSettings.storePhone,
          storeEmail: effectiveStoreSettings.storeEmail,
          subtotalMinor,
          vatPercent: effectiveStoreSettings.vatPercent,
          vatMinor,
          discountMinor: 0,
          totalMinor,
          currency: effectiveStoreSettings.currency,
          paymentMethod: payment.paymentMethod,
          paymentReference: order.paymentReference,
          walletBalanceAfterMinor: ledgerEntry.balanceAfterMinor,
          metadata: {
            cartSessionId: cart.sessionId,
            checkoutSource: "wallet_exit",
            vatMode: "included",
          },
          updatedAt: issuedAt,
        })
        .returning();
      if (!receipt) throw new Error("Failed to create receipt");

      await tx.insert(receiptItems).values(
        insertedOrderItems.map((item) => {
          const unitPriceMinor = bahtToMinorUnit(item.price);
          const lineTotalMinor = unitPriceMinor * item.amount;
          const lineVatMinor = calculateIncludedVat(
            lineTotalMinor,
            effectiveStoreSettings.vatPercent,
          );

          return {
            receiptId: receipt.id,
            orderItemId: item.id,
            inventoryId: item.inventoryId,
            shelfId:
              cart.items.find(
                (cartItem) => cartItem.inventoryId === item.inventoryId,
              )?.shelfId ?? null,
            name: item.name,
            unitName: unitNameById.get(item.unitId ?? "") ?? "item",
            quantity: item.amount,
            unitPriceMinor,
            lineSubtotalMinor: lineTotalMinor - lineVatMinor,
            vatMinor: lineVatMinor,
            discountMinor: 0,
            lineTotalMinor,
            weightPerPiece: item.weightPerPiece,
            imageUrl: item.imageUrl,
            metadata: {
              cartSessionId: cart.sessionId,
            },
            updatedAt: issuedAt,
          };
        }),
      );

      await tx
        .update(clientVisits)
        .set({
          status: "exited",
          exitedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientVisits.id, clientVisitId));

      return { status: "paid" as const, order, receipt, userId: visit.userId };
    });

    if (result.status === "insufficient") {
      await db.insert(notifications).values([
        {
          clientVisitId,
          recipientType: "client",
          userId: result.userId,
          title: "Wallet balance is not enough",
          message: "Please top up your wallet before checking out.",
          severity: "warning",
          rawPayload: { totalMinor },
          updatedAt: new Date(),
        },
        {
          clientVisitId,
          recipientType: "admin",
          userId: null,
          title: "Wallet checkout failed",
          message: `Visit #${clientVisitId} has insufficient wallet balance.`,
          severity: "warning",
          rawPayload: { totalMinor },
          updatedAt: new Date(),
        },
      ]);
      publishCheckoutStatus(result.userId);
      throw new WalletInsufficientBalanceError();
    }

    await cartSyncService.clearCart(clientVisitId);
    publishCheckoutStatus(result.userId);
    console.info("[wallet] order paid from wallet", {
      clientVisitId,
      orderId: result.order.id,
      amountMinor: totalMinor,
    });

    return result.order;
  }

  private async getOrCreateStripeCustomer(user: User) {
    const { livemode } = getStripeConfig();
    const existing = await db.query.stripeCustomers.findFirst({
      where: and(
        eq(stripeCustomers.userId, user.id),
        eq(stripeCustomers.livemode, livemode),
      ),
    });
    if (existing) return existing;

    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: toStripeMetadata({ userId: user.id }),
    });

    const [created] = await db
      .insert(stripeCustomers)
      .values({
        userId: user.id,
        stripeCustomerId: customer.id,
        emailSnapshot: user.email,
        livemode,
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const row = await db.query.stripeCustomers.findFirst({
      where: and(
        eq(stripeCustomers.userId, user.id),
        eq(stripeCustomers.livemode, livemode),
      ),
    });
    if (!row) throw new Error("Failed to create Stripe customer mapping");
    return row;
  }

  private async processStripeEvent(event: Stripe.Event): Promise<boolean> {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "payment" || session.payment_status !== "paid") {
        return false;
      }
      await this.creditTopUpFromCheckoutSession(session, event.livemode);
      return true;
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.markTopupTerminal(session.id, "cancelled");
      return true;
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.markTopupTerminal(session.id, "failed");
      return true;
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await this.markTopupFailedByPaymentIntent(paymentIntent.id);
      return true;
    }

    return false;
  }

  private async creditTopUpFromCheckoutSession(
    session: Stripe.Checkout.Session,
    livemode: boolean,
  ) {
    const topupIntentId = session.metadata?.topupIntentId;
    if (!topupIntentId) throw new Error("Checkout session is missing metadata");

    await db.transaction(async (tx) => {
      const topup = await tx.query.walletTopupIntents.findFirst({
        where: eq(walletTopupIntents.id, topupIntentId),
      });
      if (!topup) throw new Error("Top-up intent was not found");
      if (topup.status === "paid") return;
      if (topup.livemode !== livemode) {
        throw new Error("Top-up livemode does not match Stripe event mode");
      }
      if (session.amount_total !== topup.amountMinor) {
        throw new Error("Top-up amount does not match Stripe session amount");
      }
      if ((session.currency ?? "").toUpperCase() !== WALLET_CURRENCY) {
        throw new Error("Top-up currency does not match wallet currency");
      }

      const [claimedTopup] = await tx
        .update(walletTopupIntents)
        .set({
          status: "paid",
          confirmedChannel: topup.requestedChannel,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: stripeObjectId(session.payment_intent),
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletTopupIntents.id, topup.id),
            ne(walletTopupIntents.status, "paid"),
          ),
        )
        .returning();

      if (!claimedTopup) return;

      const [updatedWallet] = await tx
        .update(wallets)
        .set({
          balanceAvailableMinor: sql`${wallets.balanceAvailableMinor} + ${topup.amountMinor}`,
          updatedAt: new Date(),
        })
        .where(
          and(eq(wallets.id, topup.walletId), eq(wallets.status, "active")),
        )
        .returning();
      if (!updatedWallet) throw new Error("Active wallet was not found");

      const idempotencyKey = `topup:${topup.id}`;
      const [ledgerEntry] = await tx
        .insert(walletLedgerEntries)
        .values({
          walletId: topup.walletId,
          direction: "credit",
          type: "topup_credit",
          amountMinor: topup.amountMinor,
          currency: WALLET_CURRENCY,
          balanceAfterMinor: updatedWallet.balanceAvailableMinor,
          idempotencyKey,
          referenceType: "wallet_topup_intent",
          referenceId: topup.id,
          metadata: {
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: stripeObjectId(session.payment_intent),
          },
        })
        .onConflictDoNothing()
        .returning();

      if (!ledgerEntry) return;
    });

    console.info("[wallet] top-up credited", {
      topupIntentId,
      stripeCheckoutSessionId: session.id,
      amountMinor: session.amount_total,
    });
  }

  private async markTopupTerminal(
    checkoutSessionId: string,
    status: "cancelled" | "failed",
  ) {
    await db
      .update(walletTopupIntents)
      .set({ status, updatedAt: new Date() })
      .where(eq(walletTopupIntents.stripeCheckoutSessionId, checkoutSessionId));
  }

  private async markTopupFailedByPaymentIntent(paymentIntentId: string) {
    await db
      .update(walletTopupIntents)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(walletTopupIntents.stripePaymentIntentId, paymentIntentId));
  }
}

export const walletService = new WalletService();
