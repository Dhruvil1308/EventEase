import QRCode from "qrcode";

/** The QR payload is the bare entry code — short codes scan fastest. */
export function qrSvg(code: string, options?: { dark?: string; light?: string; margin?: number }) {
  return QRCode.toString(code, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: options?.margin ?? 1,
    color: { dark: options?.dark ?? "#0b0b1a", light: options?.light ?? "#ffffff" },
  });
}

export function qrPng(code: string, width = 720) {
  return QRCode.toBuffer(code, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width,
    color: { dark: "#0b0b1a", light: "#ffffff" },
  });
}
