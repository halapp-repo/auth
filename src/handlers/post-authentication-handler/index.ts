import "reflect-metadata";
import middy from "@middy/core";
import {
  Context,
  Callback,
  PostAuthenticationTriggerHandler,
  PostAuthenticationTriggerEvent,
} from "aws-lambda";
import { diContainer } from "../../core/di-registry";
import httpErrorHandler from "@middy/http-error-handler";
import SignUpCodeRepository from "../../repositories/signup-code.repository";
import { SNSService } from "../../services/sns.service";
import { AccountEventType } from "../../models/account-event-type.enum";

const lambdaHandler: PostAuthenticationTriggerHandler = async function (
  event: PostAuthenticationTriggerEvent,
  _: Context,
  callback: Callback<any>
) {
  console.log(JSON.stringify(event, null, 2));
  const signupCodeRepository = diContainer.resolve(SignUpCodeRepository);
  const snsService = diContainer.resolve(SNSService);

  const signupCode = event.request.clientMetadata?.["signupCode"];
  const userId = event.request.userAttributes["sub"];
  const email = event.request.userAttributes["email"];

  if (!signupCode) {
    return event;
  }

  const signupCodeObj = await signupCodeRepository.getSignupCode(signupCode);
  if (!signupCodeObj || !signupCodeObj.isActive()) {
    return event;
  }
  await snsService.publicUserJoinedOrganizationMessage({
    userId,
    eventType: AccountEventType.UserJoinedOrganizationV1,
    organizationId: signupCodeObj.OrganizationID,
  });
  await signupCodeRepository.invalidateSignupCode(signupCodeObj, email);
  return event;
};

const handler = middy(lambdaHandler).use(httpErrorHandler());

export { lambdaHandler, handler };
