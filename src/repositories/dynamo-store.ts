import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Store } from "./store";

export class DynamoStore implements Store {
  readonly dynamoClient: DynamoDBDocumentClient;

  constructor() {
    const docClient = new DynamoDBClient({});
    this.dynamoClient = DynamoDBDocumentClient.from(docClient);
  }
}
