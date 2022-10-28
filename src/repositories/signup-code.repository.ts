import {
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { inject, injectable } from "tsyringe";
import { IMapper } from "../mappers/base.mapper";
import { SignupCodeDTO } from "../models/dtos/signup-code.dto";
import { SignupCode } from "../models/signup-code";
import { DynamoStore } from "./dynamo-store";

@injectable()
export default class SignUpCodeRepository {
  private tableName = "SignUpCode";
  constructor(
    @inject("DBStore")
    private store: DynamoStore,
    @inject("SignupToSignupDtoMapper")
    private mapper: IMapper<SignupCode, SignupCodeDTO>
  ) {}

  async getSignupCode(code: string): Promise<SignupCode | undefined> {
    console.log("Fetching Signup Code");
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "#Code = :Code",
      ExpressionAttributeNames: {
        "#Code": "Code",
      },
      ExpressionAttributeValues: {
        ":Code": code,
      },
    });
    const { Items } = await this.store.dynamoClient.send(command);
    return this.convertResultToModel(Items)[0];
  }

  async deleteSignupCode(signupCode: SignupCode): Promise<void> {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: {
        Code: signupCode.Code,
      },
    });
    await this.store.dynamoClient.send(command);
  }
  async invalidateSignupCode(signupCode: SignupCode): Promise<void> {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        Code: signupCode.Code,
      },
      UpdateExpression: "SET #Active = :Active",
      ExpressionAttributeNames: {
        "#Active": "Active",
      },
      ExpressionAttributeValues: {
        ":Active": false,
      },
    });
    await this.store.dynamoClient.send(command);
  }

  private convertResultToModel(items?: Record<string, any>[]): SignupCode[] {
    if (!items || items.length === 0) {
      return [];
    }
    return this.mapper.toListModel(
      items.map(
        (i) =>
          <SignupCodeDTO>{
            Code: i["Code"],
            OrganizationID: i["OrganizationID"],
            TS: i["TS"],
            UserEmail: i["UserEmail"],
            Active: i["Active"],
          }
      )
    );
  }
}
