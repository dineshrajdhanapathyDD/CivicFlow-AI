# Proof of Coding-Agent → AWS Connection

The AWS Zero to Shipped ship gate requires documented proof that the coding agent was
connected to the AWS console. CivicFlow was built and operated entirely through the Kiro
coding agent connected to AWS (via the AWS MCP server and AWS CLI). The evidence below was
captured live from the agent session against the real account.

> Account ID, IAM ARN, and UserId are masked below for security. The unmasked values appear
> only in the private AWS console / agent session and in the screenshot attached to the
> Builder Center submission.

## Live verification (captured 2026-10-01 09:32:35 UTC)

Run through the agent's AWS connection (AWS MCP / `call_boto3`):

```json
{
  "caller_identity": {
    "Account": "************",
    "Arn": "arn:aws:iam::************:user/********",
    "UserId": "********"
  },
  "stack": { "name": "CivicFlowStack", "status": "UPDATE_COMPLETE" },
  "outputs": {
    "SiteUrlOut": "https://d2ei9x9420h4oc.cloudfront.net",
    "ApiUrlOut": "https://zwasktmpei.execute-api.us-east-1.amazonaws.com",
    "DistributionIdOut": "E27GW360BEW7AT",
    "SiteBucketOut": "civicflowstack-sitebucket397a1860-1i1bi41qqdfv",
    "ImagesBucketOut": "civicflowstack-imagesbucket1e86afb2-dfnviidpm4tp",
    "TableNameOut": "civicflow"
  },
  "lambdas": ["ApiFnE0725F78 (nodejs22.x)", "AskAgentFn3D424352 (python3.12)"],
  "dynamodb_counts": { "reports": 10, "issues": 8, "links": 10 }
}
```

This single capture demonstrates the full chain of connection and delivery:
- **Authenticated to the AWS account** (`sts:GetCallerIdentity`).
- **Infrastructure deployed by the agent** (CloudFormation stack `UPDATE_COMPLETE`, created
  via AWS CDK) with the live public URL as an output.
- **Both application Lambdas running** (Node 22 API + Python 3.12 Strands agent).
- **Real data present** (10 reports, 8 issues — reports exceed issues because the three
  duplicate pothole reports were clustered into one issue).

## Reproduce for a screenshot

Any of these, run in the agent session or a connected terminal, is valid screenshot
evidence:

```powershell
# 1. Identity — proves the agent is connected to the AWS account
aws sts get-caller-identity

# 2. The deployed stack and its live outputs
aws cloudformation describe-stacks --stack-name CivicFlowStack --region us-east-1 `
  --query "Stacks[0].{Status:StackStatus,Outputs:Outputs}"

# 3. The two application Lambda functions
aws lambda list-functions --region us-east-1 `
  --query "Functions[?starts_with(FunctionName,'CivicFlowStack-')].{Name:FunctionName,Runtime:Runtime}"

# 4. Live app responding over the public URL (ship gate)
curl https://zwasktmpei.execute-api.us-east-1.amazonaws.com/health
```

## What the agent did on AWS during the build

- Verified Amazon Bedrock model availability (Converse API) before coding.
- Deployed all infrastructure via AWS CDK (`cdk bootstrap` + `cdk deploy`).
- Published the frontend to S3 and invalidated CloudFront.
- Seeded demo data by running the live analysis pipeline against DynamoDB.
- Read CloudWatch logs to diagnose and fix a production bug (Strands + Nova inference
  profile), then redeployed.
- Verified the end-to-end flow against the public URL.

> Suggested submission attachment: a screenshot of the agent session running command (1) or
> (2) above, or the successful `cdk deploy` outputs.
