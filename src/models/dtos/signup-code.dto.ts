export interface SignupCodeDTO {
  Code: string;
  OrganizationID: string;
  OrganizationName: string;
  TS: string;
  Active: boolean;
  Email?: string;
}
