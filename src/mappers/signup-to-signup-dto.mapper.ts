import { plainToClass } from "class-transformer";
import { IMapper } from "./base.mapper";
import { SignupCode } from "../models/signup-code";
import { SignupCodeDTO } from "../models/dtos/signup-code.dto";

export class SignUpToSignupDTOMapper extends IMapper<
  SignupCode,
  SignupCodeDTO
> {
  toDTO(arg: SignupCode): SignupCodeDTO {
    throw new Error("Not Implemented");
  }
  toListDTO(arg: SignupCode[]): SignupCodeDTO[] {
    throw new Error("Not Implemented");
  }
  toModel(arg: SignupCodeDTO): SignupCode {
    return plainToClass(SignupCode, {
      Code: arg.Code,
      OrganizationID: arg.OrganizationID,
      UserEmail: arg.UserEmail,
      TS: arg.TS,
    });
  }
}
