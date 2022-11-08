import { inject, injectable } from "tsyringe";
import { CognitoStore } from "./cognito-store";
import { ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";
import { CognitoUser } from "../models/cognito-user";
import { plainToClass } from "class-transformer";

@injectable()
export default class CognitoUserRepository {
  constructor(
    @inject("CognitoStore")
    private store: CognitoStore
  ) {}
  async getUsersByEmail(
    userPoolId: string,
    email: string
  ): Promise<CognitoUser[] | undefined> {
    console.log("Getting Cognito Users By Email");
    const command = new ListUsersCommand({
      AttributesToGet: ["email", "sub"],
      UserPoolId: userPoolId,
      Filter: 'email = "' + email + '"',
    });
    const { Users } = await this.store.cognitoClient.send(command);
    return Users?.map((u) => {
      const attributes = u.Attributes;
      const id = attributes?.find((a) => a.Name === "sub");
      const email = attributes?.find((a) => a.Name === "email");
      return plainToClass(CognitoUser, {
        Id: id?.Value,
        Email: email?.Value,
      });
    });
  }
}
