## Deploy Lambda

## Exemplo de código de deploy

```
---
name: Deploy Lambda Authorizer PROD
on:
  workflow_dispatch:
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    uses: adhfoundation/public-github-actions-workflows/.github/workflows/deploy-lambda.yaml@main
    with:
      aws-region: us-east-1
      environment: production
      lambda-handler: index.handler
      lambda-memory-size: 256
      lambda-function-name: production-api-lambda-authorizer
      lambda-runtime: nodejs24.x
      lambda-timeout: 10
      vault-secret-path: secret/data/kubernetes/afya/educon/production/api-lambda-authorizer
    secrets:
      AWS_ROLE_TO_ASSUME: ${{ secrets.AWS_ROLE_TO_ASSUME }}
      LAMBDA_ROLE_ARN: ${{ secrets.LAMBDA_ROLE_ARN }}
      LAMBDA_SECURITY_GROUP_IDS: ${{ secrets.LAMBDA_SECURITY_GROUP_IDS }}
      LAMBDA_SUBNET_IDS: ${{ secrets.LAMBDA_SUBNET_IDS }}
      VAULT_ADDR: ${{ secrets.VAULT_ADDR }}
      VAULT_APPROLE_ID: ${{ secrets.VAULT_APPROLE_ID }}
      VAULT_SECRET_ID: ${{ secrets.VAULT_SECRET_ID }}
```
