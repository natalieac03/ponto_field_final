const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

export function isImage(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

export function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}
