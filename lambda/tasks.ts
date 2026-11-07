
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { randomUUID, timingSafeEqual } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({})
);

// Environment variables
const TABLE_NAME = process.env.TABLE_NAME!;
const API_KEY = process.env.TRAINING_API_KEY;

// Helper function for API responses
const respond = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

// Lambda handler
export const handler: APIGatewayProxyHandlerV2 = async (event) => {

  // ========================================
  // 1. API KEY AUTHENTICATION
  // ========================================

  // Temporary authentication for training
  const suppliedKey = event.headers?.['x-training-key'];

  // Validate that the API key exists
  // and is a valid string
  if (
    !API_KEY ||
    typeof suppliedKey !== 'string' ||
    suppliedKey.length === 0
  ) {
    return respond(401, {
      message: 'Unauthorized',
    });
  }

  // Convert keys into buffers
  const expected = Buffer.from(API_KEY);
  const received = Buffer.from(suppliedKey);

  // Securely compare API keys
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return respond(401, {
      message: 'Unauthorized',
    });
  }

  // ========================================
  // 2. REQUEST INFORMATION
  // ========================================

  const method = event.requestContext.http.method;
  const path = event.rawPath;

  try {

    // ========================================
    // 3. POST /tasks - CREATE A TASK
    // ========================================

    if (method === 'POST' && path === '/tasks') {

      let body: unknown;

      // Parse incoming JSON
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return respond(400, {
          message: 'Invalid JSON body',
        });
      }

      // Validate request body
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body)
      ) {
        return respond(400, {
          message: 'Request body must be an object',
        });
      }

      const data = body as Record<string, unknown>;

      // Validate task title
      if (
        typeof data.title !== 'string' ||
        !data.title.trim() ||
        data.title.length > 200
      ) {
        return respond(400, {
          message: 'A title is required (maximum 200 characters)',
        });
      }

      // Create task object
      const task = {
        taskId: randomUUID(),
        userId: 'demo-user',
        title: data.title.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };

      // Save task to DynamoDB
      await client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: task,
        })
      );

      return respond(201, {
        message: 'Task created successfully',
        task,
      });
    }

    // ========================================
    // 4. GET /tasks - RETRIEVE TASKS
    // ========================================

    if (method === 'GET' && path === '/tasks') {

      // Query DynamoDB for demo-user tasks
      const result = await client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'UserIdIndex',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': 'demo-user',
          },
          ScanIndexForward: false,
        })
      );

      return respond(200, {
        tasks: result.Items || [],
      });
    }

    // ========================================
    // 5. ROUTE NOT FOUND
    // ========================================

    return respond(404, {
      message: 'Route not found',
    });

  } catch (error) {

    // ========================================
    // 6. ERROR HANDLING
    // ========================================

    console.error('Lambda error:', error);

    return respond(500, {
      message: 'Internal server error',
    });
  }
};