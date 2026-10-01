// Image evidence extraction via Amazon Rekognition.
// Rekognition provides VISUAL EVIDENCE only — not the final diagnosis.
import {
  RekognitionClient,
  DetectLabelsCommand,
} from '@aws-sdk/client-rekognition';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../shared/config.js';
import type { RekognitionResult } from '../shared/types.js';
import { logEvent } from '../shared/util.js';

const rekognition = new RekognitionClient({ region: config.region });
const s3 = new S3Client({ region: config.region });

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
  // @ts-expect-error Node stream async iterator
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Fetch the uploaded image bytes from S3 (used by both Rekognition and Bedrock). */
export async function getImageBytes(imageKey: string): Promise<Buffer | undefined> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: config.imagesBucket, Key: imageKey }),
    );
    if (!res.Body) return undefined;
    return await streamToBuffer(res.Body);
  } catch (err) {
    logEvent('IMAGE_FETCH_FAILED', { imageKey, message: (err as Error).message });
    return undefined;
  }
}

/**
 * Run Rekognition DetectLabels over image bytes. Never throws — on failure it
 * returns { available: false } so the pipeline can continue text-only.
 */
export async function analyzeImage(
  imageBytes: Buffer | undefined,
): Promise<RekognitionResult> {
  if (!imageBytes) return { labels: [], available: false };
  logEvent('IMAGE_ANALYSIS_STARTED', { bytes: imageBytes.length });
  try {
    const res = await rekognition.send(
      new DetectLabelsCommand({
        Image: { Bytes: imageBytes },
        MaxLabels: 20,
        MinConfidence: 65,
      }),
    );
    const labels = (res.Labels || [])
      .map((l) => ({ name: l.Name || '', confidence: Math.round(l.Confidence || 0) }))
      .filter((l) => l.name.length > 0);
    logEvent('IMAGE_ANALYSIS_COMPLETED', { labelCount: labels.length });
    return { labels, available: true };
  } catch (err) {
    logEvent('IMAGE_ANALYSIS_FAILED', { message: (err as Error).message });
    return { labels: [], available: false };
  }
}

/** Turn Rekognition labels into concise visual evidence strings for display. */
export function labelsToEvidence(result: RekognitionResult): string[] {
  if (!result.available || result.labels.length === 0) return [];
  return result.labels
    .slice(0, 8)
    .map((l) => `${l.name} (${l.confidence}% visual confidence)`);
}
