
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

import * as path from 'path';

export class ServerTaskStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    // ==========================================
    // 1. DynamoDB table for storing tasks
    // ==========================================

    const tasksTable = new dynamodb.Table(
      this,
      'TasksTable',
      {
        partitionKey: {
          name: 'taskId',
          type: dynamodb.AttributeType.STRING,
        },

        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    // Index for retrieving tasks by user
    tasksTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',

      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },

      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },

      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ==========================================
    // 2. S3 bucket for task images
    // ==========================================

    const taskImagesBucket = new s3.Bucket(
      this,
      'TaskImagesBucket',
      {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

        enforceSSL: true,

        encryption: s3.BucketEncryption.S3_MANAGED,

        cors: [
          {
            allowedOrigins: ['http://localhost:3000'],

            allowedMethods: [
              s3.HttpMethods.GET,
              s3.HttpMethods.PUT,
            ],

            allowedHeaders: ['*'],
          },
        ],

        removalPolicy: cdk.RemovalPolicy.DESTROY,

        autoDeleteObjects: true,
      }
    );

    // ==========================================
    // 3. Lambda function for task operations
    // ==========================================

    const trainingApiKey =
      process.env.TRAINING_API_KEY;

    if (!trainingApiKey) {
      throw new Error(
        'TRAINING_API_KEY must be set before CDK deployment.'
      );
    }

    const tasksFunction = new nodejs.NodejsFunction(
      this,
      'TasksFunction',
      {
        runtime: lambda.Runtime.NODEJS_22_X,

        entry: path.join(
          __dirname,
          '../lambda/tasks.ts'
        ),

        handler: 'handler',

        memorySize: 128,

        timeout: cdk.Duration.seconds(10),

        environment: {
          TABLE_NAME: tasksTable.tableName,
          TRAINING_API_KEY: trainingApiKey,
        },

        bundling: {
          minify: true,
          sourceMap: false,
          target: 'node22',
        },
      }
    );

    // Allow Lambda to read and write task data
    tasksTable.grantReadWriteData(tasksFunction);

    // ==========================================
    // 4. API Gateway HTTP API
    // ==========================================

    const httpApi = new apigatewayv2.HttpApi(
      this,
      'ServerTaskHttpApi',
      {
        apiName: 'ServerTask-Training-API',

        description:
          'HTTP API for ServerTask training',

        createDefaultStage: true,
      }
    );

    // Connect API Gateway to Lambda
    const tasksIntegration =
      new integrations.HttpLambdaIntegration(
        'TasksLambdaIntegration',
        tasksFunction
      );

    // POST /tasks - Create a task
    httpApi.addRoutes({
      path: '/tasks',

      methods: [
        apigatewayv2.HttpMethod.POST,
      ],

      integration: tasksIntegration,
    });

    // GET /tasks - Retrieve tasks
    httpApi.addRoutes({
      path: '/tasks',

      methods: [
        apigatewayv2.HttpMethod.GET,
      ],

      integration: tasksIntegration,
    });

    // ==========================================
    // 5. CloudFormation outputs
    // ==========================================

    new cdk.CfnOutput(
      this,
      'TasksTableName',
      {
        value: tasksTable.tableName,
      }
    );

    new cdk.CfnOutput(
      this,
      'ImagesBucketName',
      {
        value: taskImagesBucket.bucketName,
      }
    );

    new cdk.CfnOutput(
      this,
      'TasksFunctionName',
      {
        value: tasksFunction.functionName,
      }
    );

    new cdk.CfnOutput(
      this,
      'ServerTaskApiUrl',
      {
        value: httpApi.apiEndpoint,
      }
    );
  }
}
