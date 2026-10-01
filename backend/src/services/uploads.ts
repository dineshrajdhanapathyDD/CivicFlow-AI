// S3 presigned upload URL generation for citizen images.
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../shared/config.js';

const s3 = new S3Client({ region: config.region });

export interface PresignResult {
  url: string;
  key: string;
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function presignImageUpload(
  reportId: string,
  contentType: string,
): Promise<PresignResult> {
  const ext = EXT[contentType] || 'bin';
  const key = `reports/${reportId}/photo.${ext}`;
  const cmd = new PutObjectCommand({
    Bucket: config.imagesBucket,
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
  return { url, key };
}

/** Public read URL for an object key (bucket served via CloudFront or direct region URL). */
export function imageUrlForKey(key: string): string {
  const base = process.env.IMAGES_PUBLIC_BASE;
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  return `https://${config.imagesBucket}.s3.${config.region}.amazonaws.com/${key}`;
}
