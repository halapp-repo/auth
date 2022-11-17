import { container } from "tsyringe";
import { SignUpToSignupDTOMapper } from "../mappers/signup-to-signup-dto.mapper";
import { CognitoStore } from "../repositories/cognito-store";
import CognitoUserRepository from "../repositories/cognito-user.repository";
import { DynamoStore } from "../repositories/dynamo-store";
import { S3Store } from "../repositories/s3-store";
import { SESStore } from "../repositories/ses-store";
import SignUpCodeRepository from "../repositories/signup-code.repository";
import { SNSStore } from "../repositories/sns-store";

container.registerSingleton<DynamoStore>("DBStore", DynamoStore);
container.registerSingleton<CognitoStore>("CognitoStore", CognitoStore);
container.registerSingleton<SESStore>("SESStore", SESStore);
container.registerSingleton<S3Store>("S3Store", S3Store);
container.registerSingleton<SNSStore>("SNSStore", SNSStore);

container.register("SignupToSignupDtoMapper", {
  useClass: SignUpToSignupDTOMapper,
});
container.register("SignUpCodeRepository", {
  useClass: SignUpCodeRepository,
});
container.register("CognitoUserRepository", {
  useClass: CognitoUserRepository,
});

export const diContainer = container;
