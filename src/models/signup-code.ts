import { plainToClass, Transform, Type } from "class-transformer";
import moment = require("moment");
import { trMoment } from "../utils/timezone";

export class SignupCode {
  readonly Code: string;
  readonly OrganizationID: string;
  readonly OrganizationName: string;

  @Type(() => String)
  @Transform(({ value }: { value: string }) => trMoment(value), {
    toClassOnly: true,
  })
  TS: moment.Moment;

  Active: boolean;
  isActive(): boolean {
    return this.Active;
  }
  setInactive(): void {
    this.Active = false;
  }

  Email?: string;
  setEmail(email: string) {
    this.Email = email;
  }

  static create(code: string, orgId: string, orgName: string): SignupCode {
    return plainToClass(SignupCode, {
      Code: code,
      OrganizationID: orgId,
      OrganizationName: orgName,
      Active: true,
      TS: moment().format(),
    });
  }
}
