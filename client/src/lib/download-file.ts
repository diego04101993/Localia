import { apiRequest } from "./queryClient";

function getFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim();
    } catch {
      return utf8Match[1].trim();
    }
  }

  const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1]?.trim() || null;
}

async function triggerDownload(response: Response, fallbackFileName: string): Promise<void> {
  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = getFilenameFromDisposition(response.headers.get("content-disposition")) || fallbackFileName;

  try {
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 0);
  }
}

export async function downloadAuthenticatedFile(url: string, fallbackFileName: string): Promise<void> {
  const response = await apiRequest("GET", url);
  await triggerDownload(response, fallbackFileName);
}

export async function downloadAuthenticatedFileRequest(
  method: "GET" | "POST",
  url: string,
  fallbackFileName: string,
  data?: unknown,
): Promise<void> {
  const response = await apiRequest(method, url, data);
  await triggerDownload(response, fallbackFileName);
}
