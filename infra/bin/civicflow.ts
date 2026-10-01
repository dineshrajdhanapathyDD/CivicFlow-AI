#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CivicFlowStack } from '../lib/civicflow-stack';

const app = new cdk.App();
new CivicFlowStack(app, 'CivicFlowStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'CivicFlow AI — multimodal community issue-to-action platform',
});
