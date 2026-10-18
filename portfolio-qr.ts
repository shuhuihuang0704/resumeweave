import QRCode from "qrcode";

const MAX_PORTFOLIO_URL_LENGTH = 2048;

export async function createPortfolioQr(value: string): Promise<string | null> {
  const input = value.trim();
  if (!input || input.length > MAX_PORTFOLIO_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;

  try {
    return await QRCode.toDataURL(url.href, {
      type: "image/png",
      width: 256,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch {
    return null;
  }
}
