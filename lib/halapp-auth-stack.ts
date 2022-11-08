import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import getConfig from "../config";
import { NodejsFunction, LogLevel } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { BuildConfig } from "./build-config";

export class HalappAuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const buildConfig = getConfig(scope as cdk.App);

    const signupCodeDB = this.createSignupCodeDB();
    const preSignupHandler = this.createPreSignupHandler(buildConfig);
    signupCodeDB.grantReadWriteData(preSignupHandler);
    // Read Attributes
    const clientReadAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        email: true,
        emailVerified: true,
        phoneNumber: true,
        phoneNumberVerified: true,
      })
      .withCustomAttributes(...["isAdmin"]);
    // Write Attributes
    const clientWriteAttributes =
      new cognito.ClientAttributes().withStandardAttributes({
        email: true,
        phoneNumber: true,
      });
    // User Pool
    const userPool = new cognito.UserPool(this, "HalAppAuthUserPool", {
      userPoolName: "HalAppUserPool",
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
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
      userVerification: {
        emailSubject: "HalApp hesabinizi onaylayin",
        emailBody: "Onay kodu {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      passwordPolicy: {
        minLength: 6,
        requireUppercase: true,
        requireDigits: true,
        requireLowercase: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lambdaTriggers: {
        preSignUp: preSignupHandler,
      },
    });
    const userPoolClient = new cognito.UserPoolClient(
      this,
      "DefaultHalAppUserPoolClient",
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
  createPreSignupHandler(buildConfig: BuildConfig): NodejsFunction {
    const preSignupHandler = new NodejsFunction(this, "AuthPreSignupHandler", {
      memorySize: 1024,
      runtime: lambda.Runtime.NODEJS_16_X,
      functionName: "AuthPreSignupHandler",
      handler: "handler",
      timeout: cdk.Duration.seconds(15),
      entry: path.join(__dirname, `/../src/pre-signup-handler/index.ts`),
      bundling: {
        target: "es2020",
        keepNames: true,
        logLevel: LogLevel.INFO,
        sourceMap: true,
        minify: buildConfig.Environment === "PRODUCTION" ? true : false,
      },
    });
    preSignupHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:List*"],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      })
    );
    return preSignupHandler;
  }
  createSignupCodeDB(): cdk.aws_dynamodb.Table {
    return new dynamodb.Table(this, "SignUpCodeDB", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "SignUpCode",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      partitionKey: {
        name: "Code",
        type: dynamodb.AttributeType.STRING,
      },
      pointInTimeRecovery: true,
    });
  }
}
