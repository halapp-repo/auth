import { SNSClient } from "@aws-sdk/client-sns";
import createHttpError = require("http-errors");
import { Store } from "./store";

export class SNSStore implements Store {
  readonly snsClient: SNSClient;

  constructor() {
    const { Region } = process.env;
    if (!Region) {
      throw new createHttpError.InternalServerError(
        "Region must come from env"
      );
    }
    this.snsClient = new SNSClient({
      region: Region,
    });
  }
}
