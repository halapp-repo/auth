export class SignupCode {
  readonly Code: string;
  readonly OrganizationID: string;
  readonly UserEmail: string;
  readonly TS: string;
  readonly Active: boolean;
  isActive(): boolean {
    return this.Active;
  }
}
