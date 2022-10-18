import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import getConfig from "../config";

export class HalappAuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const buildConfig = getConfig(scope as cdk.App);

    const clientReadAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        preferredUsername: true,
        email: true,
        emailVerified: true,
        phoneNumber: true,
        phoneNumberVerified: true,
      })
      .withCustomAttributes(...["isAdmin"]);

    const clientWriteAttributes =
      new cognito.ClientAttributes().withStandardAttributes({
        preferredUsername: true,
        email: true,
        phoneNumber: true,
      });
    const userPool = new cognito.UserPool(this, "HalAppAuthUserPool", {
      userPoolName: "HalAppUserPool",
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        preferredUsername: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        isAdmin: new cognito.BooleanAttribute({
          mutable: true,
        }),
      },
      email: cognito.UserPoolEmail.withSES({
        fromEmail: buildConfig.SESFromEmail,
        fromName: "HalApp",
        sesRegion: buildConfig.Region,
        replyTo: buildConfig.SESReplyToEmail,
      }),
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const userPoolClient = new cognito.UserPoolClient(
      this,
      "HalAppUserPoolClient",
      {
        userPool,
        authFlows: {
          custom: true,
          userSrp: true,
          adminUserPassword: true,
        },
        supportedIdentityProviders: [
          cognito.UserPoolClientIdentityProvider.COGNITO,
        ],
        readAttributes: clientReadAttributes,
        writeAttributes: clientWriteAttributes,
      }
    );
  }
}
