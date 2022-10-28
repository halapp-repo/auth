import { container } from "tsyringe";
import { SignUpToSignupDTOMapper } from "../mappers/signup-to-signup-dto.mapper";
import { DynamoStore } from "../repositories/dynamo-store";
import SignUpCodeRepository from "../repositories/signup-code.repository";

container.registerSingleton<DynamoStore>("DBStore", DynamoStore);

container.register("SignupToSignupDtoMapper", {
  useClass: SignUpToSignupDTOMapper,
});
container.register("SignUpCodeRepository", {
  useClass: SignUpCodeRepository,
});

export const diContainer = container;
