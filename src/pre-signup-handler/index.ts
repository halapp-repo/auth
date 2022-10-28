import middy from "@middy/core";
import {
  PreSignUpTriggerEvent,
  PreSignUpTriggerHandler,
  Context,
  Callback,
} from "aws-lambda";
import { UserLambdaValidationException } from "@aws-sdk/client-cognito-identity-provider";

const lambdaHandler: PreSignUpTriggerHandler = async function (
  event: PreSignUpTriggerEvent,
  _: Context,
  callback: Callback<any>
) {
  console.log(JSON.stringify(event, null, 2));
  const signupCode = event.request.clientMetadata?.["signupCode"];
  if (!signupCode) {
    throw new UserLambdaValidationException({
      message: "signupCode is missing",
      $metadata: { httpStatusCode: 400 },
    });
  }

  return callback(null, event);
};

const handler = middy(lambdaHandler);

export { lambdaHandler, handler };
