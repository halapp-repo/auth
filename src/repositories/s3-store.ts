import { S3Client } from "@aws-sdk/client-s3";
import { Store } from "./store";

export class S3Store implements Store {
  readonly s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({});
  }
}
