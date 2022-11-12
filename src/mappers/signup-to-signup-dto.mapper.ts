import { plainToClass } from "class-transformer";
import { IMapper } from "./base.mapper";
import { SignupCode } from "../models/signup-code";
import { SignupCodeDTO } from "../models/dtos/signup-code.dto";

export class SignUpToSignupDTOMapper extends IMapper<
  SignupCode,
  SignupCodeDTO
> {
  toDTO(arg: SignupCode): SignupCodeDTO {
    return {
      Code: arg.Code,
      Active: arg.Active,
      OrganizationID: arg.OrganizationID,
      OrganizationName: arg.OrganizationName,
      TS: arg.TS.format(),
    };
  }
  toModel(arg: SignupCodeDTO): SignupCode {
    return plainToClass(SignupCode, {
      Code: arg.Code,
      OrganizationID: arg.OrganizationID,
      OrganizationName: arg.OrganizationName,
      TS: arg.TS,
      Active: arg.Active,
    });
  }
}
