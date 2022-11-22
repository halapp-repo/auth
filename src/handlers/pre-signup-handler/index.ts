import "reflect-metadata";
import middy from "@middy/core";
import {
  PreSignUpTriggerEvent,
  PreSignUpTriggerHandler,
  Context,
  Callback,
} from "aws-lambda";
import { UserLambdaValidationException } from "@aws-sdk/client-cognito-identity-provider";
import { diContainer } from "../../core/di-registry";
import CognitoUserRepository from "../../repositories/cognito-user.repository";
import httpErrorHandler from "@middy/http-error-handler";
import SignUpCodeRepository from "../../repositories/signup-code.repository";

const lambdaHandler: PreSignUpTriggerHandler = async function (
  event: PreSignUpTriggerEvent,
  _: Context,
  callback: Callback<any>
) {
  console.log(JSON.stringify(event, null, 2));
  const cognitoUserRepository = diContainer.resolve(CognitoUserRepository);
  const signupCodeRepository = diContainer.resolve(SignUpCodeRepository);
  const signupCode = event.request.clientMetadata?.["signupCode"];
  if (!signupCode) {
    return callback(
      new UserLambdaValidationException({
        message: "signupCode eksik",
        $metadata: { httpStatusCode: 400 },
      })
    );
  }
  // check organization Id
  const organizationId = event.request.userAttributes["custom:organizationId"];
  if (!organizationId) {
    return callback(
      new UserLambdaValidationException({
        message: "organizationId eksik",
        $metadata: { httpStatusCode: 400 },
      })
    );
  }
  // check uniqniess of email
  if (!event.request.userAttributes.email) {
    return callback(
      new UserLambdaValidationException({
        message: "email eksik",
        $metadata: { httpStatusCode: 400 },
      })
    );
  }
  const email = event.request.userAttributes.email;
  const users = await cognitoUserRepository.getUsersByEmail(
    event.userPoolId,
    email
  );
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
  const signupCodeObj = await signupCodeRepository.getSignupCode(signupCode);
  if (!signupCodeObj || !signupCodeObj.isActive()) {
    return callback(
      new UserLambdaValidationException({
        message: "signupCode gecerli degil",
        $metadata: { httpStatusCode: 400 },
      }),
      event
    );
  }
  await signupCodeRepository.invalidateSignupCode(signupCodeObj, email);
  return event;
};

const handler = middy(lambdaHandler).use(httpErrorHandler());

export { lambdaHandler, handler };
