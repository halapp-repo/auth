import { container } from "tsyringe";
import { SignUpToSignupDTOMapper } from "../mappers/signup-to-signup-dto.mapper";
import { CognitoStore } from "../repositories/cognito-store";
import CognitoUserRepository from "../repositories/cognito-user.repository";
import { DynamoStore } from "../repositories/dynamo-store";
import SignUpCodeRepository from "../repositories/signup-code.repository";

container.registerSingleton<DynamoStore>("DBStore", DynamoStore);
container.registerSingleton<CognitoStore>("CognitoStore", CognitoStore);

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
