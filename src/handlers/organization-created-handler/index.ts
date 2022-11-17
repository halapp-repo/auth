import "reflect-metadata";
import { S3CreateEvent, SQSEvent, SQSRecord, SNSMessage } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { diContainer } from "../../core/di-registry";

import SignupCodeService from "../../services/signup-code.service";
import { SESService } from "../../services/ses.service";

export async function handler(event: SQSEvent) {
  const signupService = diContainer.resolve(SignupCodeService);
  const sesService = diContainer.resolve(SESService);
  console.log(JSON.stringify(event, null, 2));
  for (const record of event.Records) {
    const { body } = record;
    const rawMessage = JSON.parse(body) as SNSMessage;
    // Add Record to Signup DB
    console.log(rawMessage.Message);
    const message = JSON.parse(rawMessage.Message || "{}");

    const { organizationName, organizationID, toEmail } = message;

    if (!organizationID || !organizationName || !toEmail) {
      continue;
    }
    const code = uuidv4();
    await signupService.createCode(code, organizationID, organizationName);
    // Send Email to User
    await sesService.sendWelcomeMessage({
      code,
      organizationName,
      toEmail,
    });
  }
}
