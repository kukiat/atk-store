export type QrDetector = {
  detect: (
    source: HTMLVideoElement,
  ) => Promise<Array<{ rawValue: string }>>;
};

export type QrDetectorConstructor = new (options?: {
  formats?: ["qr_code"];
}) => QrDetector;

export type NativeQrDetectorConstructor = QrDetectorConstructor & {
  getSupportedFormats?: () => Promise<readonly string[]>;
};

type QrDetectorPonyfillModule = {
  BarcodeDetector: QrDetectorConstructor;
  ZXING_WASM_VERSION: string;
  prepareZXingModule: (options: {
    overrides: {
      locateFile: (path: string, prefix: string) => string;
    };
  }) => unknown;
};

type QrDetectorLoader = () => Promise<QrDetectorPonyfillModule>;

const SELF_HOSTED_ZXING_WASM_VERSION = "3.1.1";
const SELF_HOSTED_ZXING_OVERRIDES = {
  locateFile: (path: string, prefix: string) =>
    path.endsWith(".wasm")
      ? `/vendor/zxing-wasm/${SELF_HOSTED_ZXING_WASM_VERSION}/zxing_reader.wasm`
      : `${prefix}${path}`,
};

type QrCameraSupport =
  | { supported: true }
  | { supported: false; message: string };

const MAX_TRANSIENT_QR_DETECTION_ERRORS = 3;

export function getQrCameraSupport(input: {
  isSecureContext: boolean;
  hasGetUserMedia: boolean;
}): QrCameraSupport {
  if (!input.isSecureContext) {
    return {
      supported: false,
      message: "กรุณาเปิดหน้านี้ผ่าน HTTPS เพื่อใช้งานกล้อง",
    };
  }

  if (!input.hasGetUserMedia) {
    return {
      supported: false,
      message: "เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง กรุณาใช้เบราว์เซอร์ล่าสุด",
    };
  }

  return { supported: true };
}

export async function createQrDetector(options?: {
  nativeDetector?: NativeQrDetectorConstructor | null;
  loadPonyfill?: QrDetectorLoader;
}): Promise<QrDetector> {
  const nativeDetector =
    options?.nativeDetector === undefined
      ? (
          globalThis as typeof globalThis & {
            BarcodeDetector?: NativeQrDetectorConstructor;
          }
        ).BarcodeDetector
      : options.nativeDetector;

  if (nativeDetector?.getSupportedFormats) {
    try {
      const formats = await nativeDetector.getSupportedFormats();
      if (formats.includes("qr_code")) {
        return new nativeDetector({ formats: ["qr_code"] });
      }
    } catch {
      // Fall back to the self-hosted software decoder.
    }
  }

  const loadPonyfill =
    options?.loadPonyfill ??
    (async () => {
      const ponyfillModule = await import("barcode-detector/ponyfill");
      return ponyfillModule as unknown as QrDetectorPonyfillModule;
    });
  const ponyfill = await loadPonyfill();
  if (ponyfill.ZXING_WASM_VERSION !== SELF_HOSTED_ZXING_WASM_VERSION) {
    throw new Error(
      `ZXing WASM version mismatch: expected ${SELF_HOSTED_ZXING_WASM_VERSION}, received ${ponyfill.ZXING_WASM_VERSION}`,
    );
  }

  ponyfill.prepareZXingModule({
    overrides: SELF_HOSTED_ZXING_OVERRIDES,
  });

  return new ponyfill.BarcodeDetector({ formats: ["qr_code"] });
}

export function getCameraErrorMessage(error: unknown): string {
  const name =
    typeof error === "object" && error && "name" in error
      ? String(error.name)
      : "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์ Camera แล้วลองใหม่";
    case "NotFoundError":
      return "ไม่พบกล้องที่สามารถใช้งานได้บนอุปกรณ์นี้";
    case "NotReadableError":
    case "AbortError":
      return "ไม่สามารถใช้งานกล้องได้ กล้องอาจถูกใช้งานโดยแอปอื่น กรุณาลองใหม่";
    default:
      return "เปิดกล้องหรือเริ่มตัวอ่าน QR ไม่สำเร็จ กรุณาลองใหม่";
  }
}

export function shouldRetryQrDetection(consecutiveErrorCount: number): boolean {
  return consecutiveErrorCount <= MAX_TRANSIENT_QR_DETECTION_ERRORS;
}
