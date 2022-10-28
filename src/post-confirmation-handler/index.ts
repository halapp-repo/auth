import middy from "@middy/core";
import {
  PostConfirmationTriggerEvent,
  PostConfirmationTriggerHandler,
  Context,
  Callback,
} from "aws-lambda";

const lambdaHandler: PostConfirmationTriggerHandler = async function (
  event: PostConfirmationTriggerEvent,
  _: Context,
  callback: Callback<any>
) {};

const handler = middy(lambdaHandler);

export { lambdaHandler, handler };
