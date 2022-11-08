import "reflect-metadata";
import middy from "@middy/core";
import {
  PreSignUpTriggerEvent,
  PreSignUpTriggerHandler,
  Context,
  Callback,
} from "aws-lambda";
import { UserLambdaValidationException } from "@aws-sdk/client-cognito-identity-provider";
import { diContainer } from "../core/di-registry";
import CognitoUserRepository from "../repositories/cognito-user.repository";
import httpErrorHandler from "@middy/http-error-handler";

const lambdaHandler: PreSignUpTriggerHandler = async function (
  event: PreSignUpTriggerEvent,
  _: Context,
  callback: Callback<any>
) {
  console.log(JSON.stringify(event, null, 2));
  const userRepository = diContainer.resolve(CognitoUserRepository);
  const signupCode = event.request.clientMetadata?.["signupCode"];
  if (!signupCode) {
    throw new UserLambdaValidationException({
      message: "signupCode eksik",
      $metadata: { httpStatusCode: 400 },
    });
  }
  // check uniqniess of email
  const email = event.request.userAttributes.email;
  if (!email) {
    throw new UserLambdaValidationException({
      message: "email eksik",
      $metadata: { httpStatusCode: 400 },
    });
  }
  const users = await userRepository.getUsersByEmail(event.userPoolId, email);
  console.log(`Existed users : ${JSON.stringify(users)}`);
  if (users && users?.length > 0) {
    return callback(
      new UserLambdaValidationException({
        message: "email kullanimda",
        $metadata: { httpStatusCode: 400 },
      }),
      event
    );
  }
  return event;
};

const handler = middy(lambdaHandler).use(httpErrorHandler());

export { lambdaHandler, handler };
