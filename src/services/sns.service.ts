import { inject, injectable } from "tsyringe";
import { SNSStore } from "../repositories/sns-store";
import { PublishCommand } from "@aws-sdk/client-sns";
import createHttpError = require("http-errors");
import { AccountEventType } from "../models/account-event-type.enum";

@injectable()
export class SNSService {
  topicArn: string;
  constructor(
    @inject("SNSStore")
    private snsStore: SNSStore
  ) {
    const { SNSUserCreatedTopicArn } = process.env;
    if (!SNSUserCreatedTopicArn) {
      throw new createHttpError.InternalServerError(
        "SNSUserCreatedTopicArn must come from env"
      );
    }
    this.topicArn = SNSUserCreatedTopicArn;
  }
  async publishUserCreatedMessage({
    userId,
    email,
    eventType,
    organizationId,
  }: {
    userId: string;
    email: string;
    eventType: AccountEventType;
    organizationId: string;
  }): Promise<void> {
    const command = new PublishCommand({
      Message: JSON.stringify({
        userId,
        email,
        type: eventType,
        organizationId,
      }),
      Subject: "UserCreated",
      TopicArn: this.topicArn,
    });
    const data = await this.snsStore.snsClient.send(command);
    console.log("Message sent", data);
  }
}
