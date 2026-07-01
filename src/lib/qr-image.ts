import "server-only";

export async function generateQrDataUrl(payload: string): Promise<string> {
  const qrcode = await import("qrcode");
  return qrcode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}
