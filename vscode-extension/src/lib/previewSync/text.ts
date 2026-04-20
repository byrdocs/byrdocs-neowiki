export function normalizePreviewSyncText(value: string): string {
  return String(value)
    .replace(/<[^>]+>/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/[*_~#>|()[\]{}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}
