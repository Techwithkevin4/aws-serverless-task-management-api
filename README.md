# AWS Serverless Task Management API

A hands-on AWS project where I built a serverless REST API for creating and retrieving tasks using **AWS Lambda, Amazon API Gateway, Amazon DynamoDB, and AWS CDK**.

I built this project to better understand how cloud services work together to support an application without managing traditional servers. It also gave me practice with TypeScript, Infrastructure as Code, API authentication, troubleshooting, monitoring, and cleaning up AWS resources responsibly.

> **Project status:** The application was deployed during development and the AWS resources were subsequently removed to avoid ongoing usage and costs. The source code remains available here for learning and review. There is currently no live API endpoint.

## What the application does

- **Create tasks:** Send a task title to `POST /tasks`. The Lambda function validates the request, generates a unique task ID, and stores the task in DynamoDB.
- **Retrieve tasks:** Call `GET /tasks` to retrieve the demo user's tasks from DynamoDB using a global secondary index.
- **Validate requests:** Return meaningful HTTP responses for invalid JSON, missing or overly long titles, unauthorized requests, and unknown routes.
- **Use training authentication:** Both routes require an `x-training-key` request header, checked by the Lambda function.

This is a **learning project**, not a production-ready multi-user task manager. Tasks currently use a fixed `demo-user` identifier, and update/delete endpoints have not been implemented.

## Architecture

```text
API client
    |
    | HTTPS request + x-training-key header
    v
Amazon API Gateway (HTTP API)
    |
    v
AWS Lambda (Node.js / TypeScript)
    |
    | Read / write task records
    v
Amazon DynamoDB
    |-- Primary key: taskId
    `-- Global secondary index: UserIdIndex (userId, createdAt)

AWS CDK provisions the API, Lambda function, DynamoDB table,
and an Amazon S3 bucket configured for private task-image storage.
```

**Note:** The S3 bucket is provisioned with public access blocked, SSL enforcement, and S3-managed encryption. The current API does not include an image-upload or image-download route.

## Technologies used

| Technology | Purpose |
| --- | --- |
| AWS Lambda | Run task-handling code without managing servers |
| Amazon API Gateway | Expose the HTTP API |
| Amazon DynamoDB | Store task records and query them by user |
| Amazon S3 | Provision private storage intended for task images |
| AWS CDK / CloudFormation | Define and deploy cloud infrastructure in code |
| TypeScript / Node.js 22 | Implement the Lambda function and infrastructure |
| Amazon CloudWatch | Inspect logs and monitor the application during development |
| Amazon SNS | Experiment with operational notifications during development |
| Git / GitHub | Track and share project source code |

CloudWatch alarms and SNS notifications were part of the development and monitoring work; they are not defined as resources in the current CDK stack.

## API endpoints

| Method | Endpoint | Description | Typical success response |
| --- | --- | --- | --- |
| `POST` | `/tasks` | Create a task | `201 Created` |
| `GET` | `/tasks` | List tasks for the demo user | `200 OK` |

Example task creation request:

```http
POST /tasks HTTP/1.1
Content-Type: application/json
x-training-key: YOUR_TRAINING_KEY

{"title":"Review AWS Lambda logs"}
```

Example created task:

```json
{
  "taskId": "generated-uuid",
  "userId": "demo-user",
  "title": "Review AWS Lambda logs",
  "completed": false,
  "createdAt": "2026-11-07T12:00:00.000Z"
}
```

The timestamp and ID above are illustrative; actual values are generated when a task is created.

## Project structure

```text
server-task/
├── bin/                       # CDK application entry point
├── lambda/
│   └── tasks.ts               # Task API Lambda handler
├── lib/
│   └── server-task-stack.ts   # AWS infrastructure definitions
├── test/                      # Test files
├── .gitignore                 # Excludes local secrets and generated files
├── cdk.json                   # CDK configuration
├── package.json               # Dependencies and scripts
└── README.md
```

## Run locally and deploy to your own AWS account

**Prerequisites:** Node.js and npm, AWS CLI with credentials configured for your own account, and AWS CDK. Review the stack and expected costs before deploying.

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/Techwithkevin4/aws-serverless-task-management-api.git
   cd aws-serverless-task-management-api
   npm ci
   ```

2. Configure an AWS CLI profile and select your intended AWS region. For this project, development used `us-east-2` (Ohio).

3. Set a **new, private training key** in your terminal environment before running CDK commands. For example, in PowerShell:

   ```powershell
   $env:TRAINING_API_KEY = "REPLACE_WITH_YOUR_OWN_LONG_RANDOM_VALUE"
   ```

   Do not commit the real key to Git or share it in screenshots. This project passes the key to Lambda as an environment variable through CDK; for a production application, use a stronger authentication design and managed secret handling.

4. Build and inspect the infrastructure:

   ```bash
   npm run build
   npm test
   npx cdk synth
   npx cdk diff
   ```

5. If your account/region has not been bootstrapped for CDK, bootstrap it first. Then deploy **only after reviewing the generated resources and costs**:

   ```bash
   npx cdk bootstrap
   npx cdk deploy
   ```

6. Use the `ServerTaskApiUrl` stack output as your API base URL. Supply your training key in the `x-training-key` header when calling `/tasks`.

### Cleanup

The stack defines `DESTROY` removal policies for the DynamoDB table and S3 bucket, and automatic object deletion for the bucket. **These settings can permanently delete data.** Back up anything important before running:

```bash
npx cdk destroy
```

Afterward, separately verify whether any manually created CloudWatch alarms, SNS topics/subscriptions, or log groups remain. Review billing and resource inventories in the region you used.

## Challenges and lessons learned

**Keeping credentials out of GitHub.** I used an environment variable for the training API key and added `.env` files, private keys, AWS credential folders, generated CDK output, and dependencies to `.gitignore`. I also reviewed staged files and searched committed code for possible credentials before publishing.

**Understanding the full request flow.** I learned how API Gateway forwards requests to Lambda, how the function validates and processes them, and how DynamoDB stores and retrieves the resulting task records.

**Querying data efficiently.** I created a DynamoDB global secondary index called `UserIdIndex` so tasks could be queried by user ID and ordered by creation time rather than scanning the table.

**Cleaning up AWS resources.** After finishing the project, I checked Lambda, CloudWatch, SNS, and other resources, removed project-related infrastructure, and verified cleanup. This reinforced the importance of managing costs and understanding which resources may exist outside a CDK stack.

**Publishing a clean repository.** I initialized Git in the project folder, reviewed ignored files, committed the source code, and pushed the `main` branch to GitHub.

## Future improvements

- Add `PUT`/`PATCH` and `DELETE` endpoints to update and remove tasks.
- Replace the fixed demo user with real user identities and production-grade authentication.
- Add task-image upload functionality using the existing S3 bucket.
- Expand automated API and infrastructure tests.
- Define monitoring and alerting in CDK for repeatable deployment.
- Add a CI/CD pipeline for automated validation and deployment.

## Why I built this

This project helped me move beyond reading about AWS services and practice putting them together in a working application. I wanted to understand both the application side and the operational side: deploying infrastructure, troubleshooting issues, protecting credentials, and cleaning up resources when they were no longer needed.

**Repository:** https://github.com/Techwithkevin4/aws-serverless-task-management-api
