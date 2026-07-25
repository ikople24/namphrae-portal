import { v2 as cloudinary } from 'cloudinary';

// Cloudinary is configured lazily and only used by admin upload routes. When the
// env vars are missing, the upload endpoint returns a friendly error instead of
// crashing, so the rest of the app still runs.

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

// Signature for a direct (browser -> Cloudinary) signed upload.
export type UploadSignature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  resourceType: 'image' | 'video';
};
