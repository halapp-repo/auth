import "reflect-metadata";
import { S3CreateEvent, SQSEvent, SQSRecord } from "aws-lambda";

export async function handler(event: SQSEvent) {
  console.log(JSON.stringify(event, null, 2));
  for (const record of event.Records) {
    const { body } = record;
    console.log(JSON.stringify(body));
  }
}
