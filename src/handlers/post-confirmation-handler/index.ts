import "reflect-metadata";
import middy from "@middy/core";
import {
  PostConfirmationTriggerEvent,
  PostConfirmationTriggerHandler,
  Context,
  Callback,
} from "aws-lambda";
import { diContainer } from "../../core/di-registry";
import { AccountEventType } from "../../models/account-event-type.enum";
import { SNSService } from "../../services/sns.service";

const lambdaHandler: PostConfirmationTriggerHandler = async function (
  event: PostConfirmationTriggerEvent,
  context: Context,
  callback: Callback<any>
) {
  console.log(JSON.stringify(event, null, 2));
  console.log(JSON.stringify(context, null, 2));

  const snsService = diContainer.resolve(SNSService);

  const userId = event.request.userAttributes["sub"];
  const email = event.request.userAttributes["email"];
  await snsService.publishUserCreatedMessage({
    email,
    userId,
    eventType: AccountEventType.UserCreatedV1,
  });

  return event;
};

const handler = middy(lambdaHandler);

export { lambdaHandler, handler };
