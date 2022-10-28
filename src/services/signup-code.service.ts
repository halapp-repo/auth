import { inject, injectable } from "tsyringe";
import SignUpCodeRepository from "../repositories/signup-code.repository";
import { UserLambdaValidationException } from "@aws-sdk/client-cognito-identity-provider";

@injectable()
export default class SignupCodeService {
  constructor(
    @inject("SignUpCodeRepository") private repo: SignUpCodeRepository
  ) {}
  async checkAndInvalidateCode(signupCode: string): Promise<void> {
    const code = await this.repo.getSignupCode(signupCode);
    if (!code) {
      throw new UserLambdaValidationException({
        message: "there is no signupCode",
        $metadata: {
          httpStatusCode: 400,
        },
      });
    }
    if (!code.isActive()) {
      throw new UserLambdaValidationException({
        message: "signupCode is invalid",
        $metadata: {
          httpStatusCode: 400,
        },
      });
    }
    await this.repo.invalidateSignupCode(code);
  }
}