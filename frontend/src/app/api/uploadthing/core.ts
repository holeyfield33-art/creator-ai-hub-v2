import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

/**
 * Extract user ID from Supabase JWT in the Authorization header.
 * Supabase JWTs contain the user ID in the 'sub' claim.
 */
async function getAuthUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UploadThingError("Unauthorized: Missing or invalid authorization header");
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // JWT format: header.payload.signature (each part is base64url encoded)
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new UploadThingError("Unauthorized: Invalid token format");
    }

    // Decode the payload (second part)
    // Convert base64url to base64: replace URL-safe chars with standard base64 chars
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const claims = JSON.parse(decoded);

    if (!claims.sub || typeof claims.sub !== "string") {
      throw new UploadThingError("Unauthorized: Token missing user ID");
    }

    return claims.sub;
  } catch (error) {
    if (error instanceof UploadThingError) throw error;
    throw new UploadThingError("Unauthorized: Failed to parse token");
  }
}

export const ourFileRouter = {
  videoUploader: f({ video: { maxFileSize: "512MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const userId = await getAuthUserId(req);
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("file url", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
