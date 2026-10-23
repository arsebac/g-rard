import { FastifyReply } from "fastify";

// Types safe to render in the browser. Anything else (HTML, SVG, XML...) could
// run script on the app's origin, so it is always sent as an opaque download.
const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "text/plain",
]);

/**
 * Sets the headers for sending a stored file. The MIME type comes from whoever
 * uploaded it, so it is only echoed back for inline types on the allow list.
 */
export function setDownloadHeaders(reply: FastifyReply, filename: string, mimeType: string, wantInline: boolean) {
  const inline = wantInline && INLINE_TYPES.has(mimeType);
  // RFC 5987: encodeURIComponent leaves ' ( ) * alone, which the header grammar does not allow.
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

  reply.header("Content-Type", inline ? mimeType : "application/octet-stream");
  reply.header("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`);
  reply.header("X-Content-Type-Options", "nosniff");
  // Chrome refuses to render a PDF in a sandboxed document, and its viewer runs no page script anyway.
  if (!(inline && mimeType === "application/pdf")) {
    reply.header("Content-Security-Policy", "sandbox");
  }
  return inline;
}
