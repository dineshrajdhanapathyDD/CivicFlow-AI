// Central config sourced from environment (set by CDK on the Lambda).
export const config = {
  region: process.env.AWS_REGION || 'us-east-1',
  tableName: process.env.DYNAMODB_TABLE || 'civicflow',
  imagesBucket: process.env.IMAGES_BUCKET || '',
  bedrockModelId: process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0',
  adminKey: process.env.ADMIN_KEY || '',
  // Similarity + priority tuning
  similarityThreshold: 0.55,
  locationProximityMeters: 250,
};
