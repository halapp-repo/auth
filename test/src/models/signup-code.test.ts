import * as fs from "fs";
import "reflect-metadata";
import * as path from "path";
import { SignupCode } from "../../../src/models/signup-code";

describe("SignupCode", () => {
  test("Create SignupCode", () => {
    const signupCode = SignupCode.create("1234", "orgId", "orgName");
    expect(signupCode).not.toBeNull();
    expect(signupCode.TS).not.toBeNull();
  });
});
