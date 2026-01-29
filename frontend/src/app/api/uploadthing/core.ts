import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

// Fake auth function - replace with your actual auth
async function getAuthUserId(req: Request) {
  // For now, we'll extract from headers or return a placeholder
  // In production, verify JWT from Supabase auth header
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new UploadThingError("Unauthorized");
  
  // Extract user from JWT - simplified for now
  return "user-id-from-auth"; // TODO: Parse JWT properly
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
