# 03 — Symbols

Generated: 2026-07-15 Asia/Bangkok

## Service Exports

| File | Exports | Purpose |
| --- | --- | --- |
| src/services/admin-attendance.service.ts | AdminAttendanceSummary, adminAttendanceService | admin attendance views และ mock/status operations |
| src/services/admin-inventory.service.ts | InventoryAdminData, adminInventoryService | CRUD inventory, units, QR, settings และ admin inventory queries |
| src/services/admin-user.service.ts | AdminActor, AdminAuthorizationError, AdminRoleGrantSummary, AdminUserDetail, AdminUserSummary, adminUserService | admin user management, roles และ account status |
| src/services/animation.service.ts | AnimationUser, animationService | source file |
| src/services/cart-events.service.ts | publishCartUpdated, subscribeCartUpdated | source file |
| src/services/cart-sync.service.ts | cartSyncService | เก็บ active cart ต่อ visit ใน Redis ถ้ามี หรือ fallback memory สำหรับ local/dev |
| src/services/client-attendance.service.ts | ClientAttendanceRecognitionResult, clientAttendanceService | ประมวลผล camera entry/exit และ visit state |
| src/services/client-visit.service.ts | ActiveClientVisitRequiredError, clientVisitService | source file |
| src/services/face-enrollment.service.ts | CredentialBridgeError, DetectorCredentials, FaceAlreadyRegisteredError, FaceAttemptResult, FaceNotRegisteredError, LivenessAttemptInProgressError, LivenessAttemptNotFoundError, faceEnrollmentService | orchestrate Face Liveness sessions/results และ persist recognition outcome |
| src/services/face-recognition.service.ts | FaceAlreadyBelongsToAnotherUserError, FaceCouldNotBeIndexedError, FaceReferenceImageMissingError, FaceRegistrationResult, FaceVerificationResult, faceRecognitionService | Search/Index Rekognition Face Collection และ map FaceId กับ user |
| src/services/inventory.service.ts | inventoryService | source file |
| src/services/iot-event-processor.service.ts | ProcessIotEventResult, iotEventProcessorService | ประมวลผล IoT/loadcell event ให้เป็น session event |
| src/services/iot-inventory-catalog.service.ts | IotInventoryCatalogItem, ListIotInventoriesInput, iotInventoryCatalogService | source file |
| src/services/iot-loadcell-contract.ts | IotLoadcellMessageKind, IotLoadcellTopic, IotNormalizedLoadcellEvent, loadcellSubscribeTopics, normalizeLoadcellMessage, parseLoadcellPayload, parseLoadcellTopic | source file |
| src/services/iot-mqtt-message-handler.ts | IotMqttHandlerLog, handleIotMqttMessage | รับ MQTT payload, validate contract และบันทึก processing log |
| src/services/iot-mqtt-message-log.contract.ts | IOT_MQTT_MAX_PAYLOAD_BYTES, IotMqttMessageLogStatus | source file |
| src/services/iot-mqtt-message-log.service.ts | IOT_MQTT_LOG_RETENTION_DAYS, iotMqttMessageLogService | source file |
| src/services/iot-session-events.service.ts | publishIotSessionUpdated, subscribeIotSessionUpdated | pub/sub IoT session updates ด้วย Redis เมื่อ config พร้อม และ fallback local listeners |
| src/services/iot-session.service.ts | IotSession, IotSessionEventType, IotSessionStatus, iotSessionService | จัดการ IoT session lifecycle, picked count, door close/error และ cart updates |
| src/services/iot.service.ts | IotOpenInventoryResult, iotService | source file |
| src/services/mock-iot-server.service.ts | MockIotServerError, createMockIotPickSession, getMockIotProduct, isMockIotServerEnabled | service ฝั่ง mock IoT server |
| src/services/order-events.service.ts | publishCheckoutStatus, subscribeCheckoutStatus | source file |
| src/services/order.service.ts | orderService | สร้าง/อ่าน order จาก active visit/cart |
| src/services/product.service.ts | productService | source file |
| src/services/receipt.service.ts | StoreSettingsInput, receiptService | สร้างและอ่าน receipts หลัง payment/checkout |
| src/services/role.service.ts | roleService | source file |
| src/services/s3-storage.service.ts | s3StorageService | source file |
| src/services/store-access.service.ts | StoreScanEligibility, StoreScanNotAllowedError, storeAccessService | ตัดสินสิทธิ์ scan จาก active visit, wallet balance และ inventory availability |
| src/services/user.service.ts | AccountNotActiveError, OAuthIdentityConflictError, userService | source file |
| src/services/wallet.service.ts | WalletInsufficientBalanceError, walletService | wallet, ledger, Stripe top-up และ checkout debit |

## Route Handler Exports

| Route | Methods | File |
| --- | --- | --- |
| /api/animation-api/users | GET | src/app/api/animation-api/users/route.ts |
| /api/auth/callback/google | GET | src/app/api/auth/callback/google/route.ts |
| /api/auth/signin/google | GET | src/app/api/auth/signin/google/route.ts |
| /api/auth/signout | POST | src/app/api/auth/signout/route.ts |
| /api/cart/active | GET | src/app/api/cart/active/route.ts |
| /api/client-attendance/exit-order | POST | src/app/api/client-attendance/exit-order/route.ts |
| /api/client-attendance/recognize | POST | src/app/api/client-attendance/recognize/route.ts |
| /api/face/auth-status | GET | src/app/api/face/auth-status/route.ts |
| /api/face/credentials | GET | src/app/api/face/credentials/route.ts |
| /api/face/result | POST | src/app/api/face/result/route.ts |
| /api/face/session | POST | src/app/api/face/session/route.ts |
| /api/health-check | GET | src/app/api/health-check/route.ts |
| /api/iot/catalog/inventories | GET | src/app/api/iot/catalog/inventories/route.ts |
| /api/iot/catalog/shelves | GET | src/app/api/iot/catalog/shelves/route.ts |
| /api/iot/events | POST | src/app/api/iot/events/route.ts |
| /api/iot/mock-events | POST | src/app/api/iot/mock-events/route.ts |
| /api/iot/sessions/[sessionId] | GET | src/app/api/iot/sessions/[sessionId]/route.ts |
| /api/iot/sessions/[sessionId]/events | GET | src/app/api/iot/sessions/[sessionId]/events/route.ts |
| /api/iot/watch | POST | src/app/api/iot/watch/route.ts |
| /api/mock-iot-server/pick-sessions | POST | src/app/api/mock-iot-server/pick-sessions/route.ts |
| /api/mock-iot-server/product/[productId] | GET | src/app/api/mock-iot-server/product/[productId]/route.ts |
| /api/mock-iot-server/shelves/open | POST | src/app/api/mock-iot-server/shelves/open/route.ts |
| /api/orders/active-visit-events | GET | src/app/api/orders/active-visit-events/route.ts |
| /api/orders/active-visit-status | GET | src/app/api/orders/active-visit-status/route.ts |
| /api/qr/decode | POST | src/app/api/qr/decode/route.ts |
| /api/shelf/[id] | GET | src/app/api/shelf/[id]/route.ts |
| /api/stripe/webhook | POST | src/app/api/stripe/webhook/route.ts |
| /inventories | GET | src/app/inventories/route.ts |

## Component Exports

| File | Exports | Purpose |
| --- | --- | --- |
| src/components/account-nav.tsx | AccountNav | UI component สำหรับ flow หน้าเว็บ |
| src/components/authenticated-nav.tsx | AuthenticatedNav | UI component สำหรับ flow หน้าเว็บ |
| src/components/cart-bar.tsx | CartBar | UI component สำหรับ flow หน้าเว็บ |
| src/components/checkout-paid-notice.tsx | CheckoutPaidNotice | UI component สำหรับ flow หน้าเว็บ |
| src/components/face-auth-status-notice.tsx | FaceAuthStatusNotice | UI component สำหรับ flow หน้าเว็บ |
| src/components/face-enrollment-prompt.tsx | FaceEnrollmentPrompt | UI component สำหรับ flow หน้าเว็บ |
| src/components/face-liveness-registration.tsx | FaceLivenessRegistration | UI component สำหรับ flow หน้าเว็บ |
| src/components/face-verification-debug-prompt.tsx | FaceVerificationDebugPrompt | UI component สำหรับ flow หน้าเว็บ |
| src/components/face-verification-debug.tsx | FaceVerificationDebug | UI component สำหรับ flow หน้าเว็บ |
| src/components/image-preview-dialog.tsx | ImageGalleryButton, ImagePreviewThumbnail | UI component สำหรับ flow หน้าเว็บ |
| src/components/image-upload-field.tsx | ImageUploadField | UI component สำหรับ flow หน้าเว็บ |
| src/components/product-card.tsx | ProductCard | UI component สำหรับ flow หน้าเว็บ |
| src/components/quantity-stepper.tsx | QuantityStepper | UI component สำหรับ flow หน้าเว็บ |
| src/components/receipt-document.tsx | ReceiptDocument | UI component สำหรับ flow หน้าเว็บ |
| src/components/theme-toggle.tsx | ThemeToggle | UI component สำหรับ flow หน้าเว็บ |
| src/components/ui/badge.tsx | - | primitive UI component |
| src/components/ui/button.tsx | - | primitive UI component |
| src/components/ui/card.tsx | - | primitive UI component |
| src/components/ui/separator.tsx | - | primitive UI component |
| src/components/ui/sheet.tsx | - | primitive UI component |

## Library Exports

| File | Exports | Purpose |
| --- | --- | --- |
| src/lib/auth-shared.ts | GOOGLE_ID_TOKEN_COOKIE, GOOGLE_ID_TOKEN_COOKIE_PATH, GOOGLE_OAUTH_NONCE_COOKIE, GOOGLE_OAUTH_PKCE_COOKIE, GOOGLE_OAUTH_STATE_COOKIE, PUBLIC_PATHS, SESSION_COOKIE, SIGN_IN_PATH, googleIdTokenCookieOptions, oauthCookieOptions, sessionCookieOptions | helper/config/state utility |
| src/lib/auth-tokens.ts | createOpaqueToken, createPkceChallenge, hashSessionToken, tokensMatch | helper/config/state utility |
| src/lib/auth.ts | AuthenticationRequiredError, getCurrentUser, hasSameOrigin, requireCurrentUser | helper/config/state utility |
| src/lib/aws-face-recognition.ts | FaceRecognitionConfig, FaceRecognitionConfigError, getFaceRecognitionConfig | helper/config/state utility |
| src/lib/aws-liveness.ts | GOOGLE_LOGINS_KEY, LivenessConfig, LivenessConfigError, getCognitoIdentityClient, getLivenessConfig, getRekognitionClient | helper/config/state utility |
| src/lib/client-attendance-auth.ts | ClientAttendanceAuthConfigError, ClientAttendanceAuthError, getClientAttendanceMaxImageBytes, requireClientAttendanceApiKey | helper/config/state utility |
| src/lib/device.ts | isMobileOrTabletRequest | helper/config/state utility |
| src/lib/face-camera-cleanup.ts | stopFaceCameraStreams, useFaceCameraCleanup | helper/config/state utility |
| src/lib/face-recognition-state.ts | FaceMatchDecision, createExternalImageId, decideFaceVerification | helper/config/state utility |
| src/lib/face-token.ts | FaceTokenStatus, getFaceTokenStatus | helper/config/state utility |
| src/lib/format.ts | formatBaht, formatPrice | helper/config/state utility |
| src/lib/google-id-token-claims.ts | GoogleIdTokenValidationError, GoogleIdentity, getGoogleIdentityFromClaims | helper/config/state utility |
| src/lib/google-id-token.ts | verifyGoogleIdToken | helper/config/state utility |
| src/lib/iot-api-auth.ts | IotApiAuthorizationError, requireIotApiKey | helper/config/state utility |
| src/lib/liveness-state.ts | LivenessDecision, LivenessOutcome, RekognitionLivenessStatus, attemptStatusForOutcome, decideLivenessOutcome, isAttemptReusable | helper/config/state utility |
| src/lib/money.ts | WALLET_CURRENCY, assertPositiveMinorUnit, bahtToMinorUnit, formatMinorBaht | helper/config/state utility |
| src/lib/permissions.ts | PermissionSet, ROLE_CODES, RoleCode, canManageTarget, getHighestRole, getPermissions, normalizeRoleCodes | helper/config/state utility |
| src/lib/qr-image.ts | generateQrDataUrl | helper/config/state utility |
| src/lib/qr-payload.ts | InventoryQrPayload, decodeInventoryQrPayload, encodeInventoryQrPayload | helper/config/state utility |
| src/lib/stripe.ts | StripeConfigError, getAppOrigin, getStripeClient, getStripeConfig | helper/config/state utility |
| src/lib/use-hydrated.ts | useHydrated | helper/config/state utility |
| src/lib/use-suppress-readable-stream-cancel-error.ts | ReadableStreamCancelErrorSilencer, useSuppressReadableStreamCancelError | helper/config/state utility |
| src/lib/utils.ts | cn | helper/config/state utility |

## Database Symbols

### Tables

| Symbol | Table |
| --- | --- |
| users | users |
| roles | roles |
| userRoles | user_roles |
| roleGrants | role_grants |
| adminAuditLogs | admin_audit_logs |
| sessions | sessions |
| faceLivenessAttempts | face_liveness_attempts |
| userFaceProfiles | user_face_profiles |
| clientAttendanceEvents | client_attendance_events |
| clientVisits | client_visits |
| units | units |
| inventories | inventories |
| qrCodes | qr_codes |
| orders | orders |
| orderItems | order_items |
| storeSettings | store_settings |
| receipts | receipts |
| receiptItems | receipt_items |
| iotSessions | iot_sessions |
| iotSessionEvents | iot_session_events |
| iotMqttMessageLogs | iot_mqtt_message_logs |
| wallets | wallets |
| walletLedgerEntries | wallet_ledger_entries |
| stripeCustomers | stripe_customers |
| walletFundingChannels | wallet_funding_channels |
| walletTopupIntents | wallet_topup_intents |
| stripeWebhookEvents | stripe_webhook_events |
| orderPayments | order_payments |
| notifications | notifications |

### Enums

| Symbol | Enum |
| --- | --- |
| authMethodEnum | auth_method |
| userAccountStatusEnum | user_account_status |
| roleGrantStatusEnum | role_grant_status |
| faceEnrollmentStatusEnum | face_enrollment_status |
| livenessAttemptStatusEnum | liveness_attempt_status |
| faceLivenessIntentEnum | face_liveness_intent |
| faceRecognitionOutcomeEnum | face_recognition_outcome |
| attendanceDirectionEnum | attendance_direction |
| attendanceRecognitionDecisionEnum | attendance_recognition_decision |
| clientVisitStatusEnum | client_visit_status |
| orderStatusEnum | order_status |
| paymentStatusEnum | payment_status |
| walletStatusEnum | wallet_status |
| walletLedgerDirectionEnum | wallet_ledger_direction |
| walletLedgerTypeEnum | wallet_ledger_type |
| walletFundingProviderEnum | wallet_funding_provider |
| walletFundingChannelEnum | wallet_funding_channel |
| walletTopupStatusEnum | wallet_topup_status |
| stripeWebhookProcessingStatusEnum | stripe_webhook_processing_status |
| orderPaymentMethodEnum | order_payment_method |
| receiptStatusEnum | receipt_status |
| notificationRecipientTypeEnum | notification_recipient_type |
| notificationSeverityEnum | notification_severity |
| iotSessionStatusEnum | iot_session_status |
| iotSessionEventMessageKindEnum | iot_session_event_message_kind |
| iotSessionEventTypeEnum | iot_session_event_type |
| iotMqttMessageProcessingStatusEnum | iot_mqtt_message_processing_status |

### Inferred Types

- `Inventory`
- `NewInventory`
- `QrCode`
- `Unit`
- `NewUnit`
- `Order`
- `OrderItem`
- `StoreSettings`
- `Receipt`
- `ReceiptItem`
- `IotSessionRecord`
- `NewIotSessionRecord`
- `IotSessionEventRecord`
- `NewIotSessionEventRecord`
- `IotMqttMessageLogRecord`
- `NewIotMqttMessageLogRecord`
- `Wallet`
- `NewWallet`
- `WalletLedgerEntry`
- `NewWalletLedgerEntry`
- `StripeCustomer`
- `NewStripeCustomer`
- `WalletFundingChannel`
- `WalletTopupIntent`
- `NewWalletTopupIntent`
- `StripeWebhookEvent`
- `OrderPayment`
- `Notification`
- `User`
- `NewUser`
- `Session`
- `Role`
- `UserRole`
- `RoleGrant`
- `AdminAuditLog`
- `FaceLivenessAttempt`
- `NewFaceLivenessAttempt`
- `UserFaceProfile`
- `NewUserFaceProfile`
- `ClientAttendanceEvent`
- `NewClientAttendanceEvent`
- `ClientVisit`
- `NewClientVisit`
- `AuthMethod`
- `UserAccountStatus`
- `RoleGrantStatus`
- `FaceEnrollmentStatus`
- `LivenessAttemptStatus`
- `FaceLivenessIntent`
- `FaceRecognitionOutcome`
- `AttendanceDirection`
- `AttendanceRecognitionDecision`
- `ClientVisitStatus`
- `WalletStatus`
- `WalletLedgerDirection`
- `WalletLedgerType`
- `WalletFundingChannelCode`
- `WalletTopupStatus`
- `ReceiptStatus`
