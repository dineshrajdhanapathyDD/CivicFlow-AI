import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as path from 'node:path';

export class CivicFlowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bedrockModelId =
      this.node.tryGetContext('bedrockModelId') || 'amazon.nova-lite-v1:0';
    const adminKey = this.node.tryGetContext('adminKey') || 'change-me-in-deploy';

    // ---------- DynamoDB single table ----------
    const table = new dynamodb.Table(this, 'Table', {
      tableName: 'civicflow',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });
    for (const n of ['GSI1', 'GSI2', 'GSI3']) {
      table.addGlobalSecondaryIndex({
        indexName: n,
        partitionKey: { name: `${n}PK`, type: dynamodb.AttributeType.STRING },
        sortKey: { name: `${n}SK`, type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL,
      });
    }

    // ---------- Images bucket (private; presigned PUT) ----------
    const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // ---------- Lambda (bundled with esbuild) ----------
    const backendRoot = path.join(__dirname, '../../backend');
    const fn = new NodejsFunction(this, 'ApiFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(backendRoot, 'src/handler.ts'),
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, 'package-lock.json'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        DYNAMODB_TABLE: table.tableName,
        IMAGES_BUCKET: imagesBucket.bucketName,
        BEDROCK_MODEL_ID: bedrockModelId,
        ADMIN_KEY: adminKey,
      },
      bundling: {
        format: OutputFormat.ESM,
        target: 'node20',
        minify: false,
        sourceMap: true,
      },
    });

    // Least-privilege permissions
    table.grantReadWriteData(fn);
    imagesBucket.grantReadWrite(fn);
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/${bedrockModelId}`,
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
        ],
      }),
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['rekognition:DetectLabels', 'rekognition:DetectText'],
        resources: ['*'], // Rekognition detect ops do not support resource-level scoping
      }),
    );

    // ---------- Ask CivicFlow agent (Python / AWS Strands Agents SDK) ----------
    // A dedicated Lambda runs a real tool-using agent (Strands + Bedrock Nova) that
    // decides which CivicFlow data tools to call. Read-only on DynamoDB.
    const agentFn = new PythonFunction(this, 'AskAgentFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      entry: path.join(__dirname, '../../backend-agent'),
      index: 'handler.py',
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      environment: {
        DYNAMODB_TABLE: table.tableName,
        BEDROCK_MODEL_ID: bedrockModelId,
      },
    });
    table.grantReadData(agentFn);
    // Strands streams via Converse and Amazon Nova routes through a cross-region
    // inference profile, so allow invoke (incl. streaming) on foundation models in
    // the US inference-profile regions plus the profile ARNs themselves.
    agentFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:*::foundation-model/*`,
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        ],
      }),
    );

    // ---------- HTTP API ----------
    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: 'civicflow-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigw.CorsHttpMethod.GET,
          apigw.CorsHttpMethod.POST,
          apigw.CorsHttpMethod.PATCH,
          apigw.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['content-type', 'x-admin-key'],
      },
    });
    const integration = new HttpLambdaIntegration('ApiInt', fn);
    const routes: [apigw.HttpMethod, string][] = [
      [apigw.HttpMethod.POST, '/reports'],
      [apigw.HttpMethod.GET, '/reports'],
      [apigw.HttpMethod.GET, '/reports/{id}'],
      [apigw.HttpMethod.POST, '/reports/{id}/analyze'],
      [apigw.HttpMethod.POST, '/uploads/presign'],
      [apigw.HttpMethod.GET, '/issues'],
      [apigw.HttpMethod.GET, '/issues/{id}'],
      [apigw.HttpMethod.PATCH, '/issues/{id}/status'],
      [apigw.HttpMethod.GET, '/dashboard/stats'],
      [apigw.HttpMethod.GET, '/health'],
    ];
    for (const [method, p] of routes) {
      httpApi.addRoutes({ path: p, methods: [method], integration });
    }

    // /ask is served by the Strands agent Lambda (real tool-using agent).
    httpApi.addRoutes({
      path: '/ask',
      methods: [apigw.HttpMethod.POST],
      integration: new HttpLambdaIntegration('AskAgentInt', agentFn),
    });

    // ---------- Frontend hosting: private S3 + CloudFront (OAC) ----------
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const imagesOrigin = origins.S3BucketOrigin.withOriginAccessControl(imagesBucket);
    const distribution = new cloudfront.Distribution(this, 'SiteDist', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        // Serve citizen-uploaded images from the private images bucket via OAC,
        // so the bucket stays BLOCK_ALL but images are publicly viewable read-only.
        'reports/*': {
          origin: imagesOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // Tell the Lambda how to build public image URLs (via CloudFront, not direct S3).
    fn.addEnvironment('IMAGES_PUBLIC_BASE', `https://${distribution.distributionDomainName}`);

    // ---------- Outputs ----------
    new cdk.CfnOutput(this, 'ApiUrlOut', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'ImagesBucketOut', { value: imagesBucket.bucketName });
    new cdk.CfnOutput(this, 'SiteBucketOut', { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, 'SiteUrlOut', {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'DistributionIdOut', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'TableNameOut', { value: table.tableName });
  }
}
