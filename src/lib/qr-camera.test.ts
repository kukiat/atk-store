import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createQrDetector,
  getCameraErrorMessage,
  getQrCameraSupport,
  shouldRetryQrDetection,
} from "./qr-camera";

describe("inventory QR camera compatibility", () => {
  it("allows camera scanning without a native BarcodeDetector", () => {
    expect(
      getQrCameraSupport({
        isSecureContext: true,
        hasGetUserMedia: true,
      }),
    ).toEqual({ supported: true });
  });

  it("creates the software QR detector with the existing qr_code format", async () => {
    const detect = vi.fn();
    const constructor = vi.fn(function Detector() {
      return { detect };
    });
    const prepareZXingModule = vi.fn();

    const detector = await createQrDetector({
      nativeDetector: null,
      loadPonyfill: async () => ({
        BarcodeDetector: constructor as never,
        ZXING_WASM_VERSION: "3.1.1",
        prepareZXingModule,
      }),
    });

    expect(constructor).toHaveBeenCalledWith({ formats: ["qr_code"] });
    expect(detector.detect).toBe(detect);
    expect(prepareZXingModule).toHaveBeenCalledOnce();

    const [{ overrides }] = prepareZXingModule.mock.calls[0];
    expect(overrides.locateFile("zxing_reader.wasm", "/cdn/")).toBe(
      "/vendor/zxing-wasm/3.1.1/zxing_reader.wasm",
    );
  });

  it("keeps a working native QR detector as the Android fast path", async () => {
    const detect = vi.fn();
    class NativeDetector {
      static getSupportedFormats = async () => ["qr_code"];
      detect = detect;
    }
    const loadPonyfill = vi.fn();

    const detector = await createQrDetector({
      nativeDetector: NativeDetector,
      loadPonyfill,
    });

    expect(detector.detect).toBe(detect);
    expect(loadPonyfill).not.toHaveBeenCalled();
  });

  it("ships the exact self-hosted ZXing reader used by the fallback", () => {
    const wasm = readFileSync(
      path.join(
        process.cwd(),
        "public/vendor/zxing-wasm/3.1.1/zxing_reader.wasm",
      ),
    );

    expect(createHash("sha256").update(wasm).digest("hex")).toBe(
      "6a858c01e076bab3a1bd413e4f2cf5e5e45f819a0d9441d83c66993bc48ed38f",
    );
  });

  it("rejects insecure origins before requesting the camera", () => {
    expect(
      getQrCameraSupport({
        isSecureContext: false,
        hasGetUserMedia: true,
      }),
    ).toEqual({
      supported: false,
      message: "กรุณาเปิดหน้านี้ผ่าน HTTPS เพื่อใช้งานกล้อง",
    });
  });

  it("maps camera permission errors to a retryable message", () => {
    expect(getCameraErrorMessage({ name: "NotAllowedError" })).toBe(
      "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตสิทธิ์ Camera แล้วลองใหม่",
    );
  });

  it("retries transient frame errors without creating an endless scan loop", () => {
    expect(shouldRetryQrDetection(1)).toBe(true);
    expect(shouldRetryQrDetection(3)).toBe(true);
    expect(shouldRetryQrDetection(4)).toBe(false);
  });
});
