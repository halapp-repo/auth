import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as s3 from "aws-cdk-lib/aws-s3";
import getConfig from "../config";
import { NodejsFunction, LogLevel } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { BuildConfig } from "./build-config";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class HalappAuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const organizationCreatedQueue = this.createOrganizationCreatedQueue();

    const emailTemplateBucket = this.createEmailTemplateBucket();

    const buildConfig = getConfig(scope as cdk.App);

    const signupCodeDB = this.createSignupCodeDB();
    const authApi = this.createAuthApiGateway();
    const userCreatedSnsTopic = this.createUserCreatedSNSTopic();

    this.createGetSignupCodeHandler(authApi, signupCodeDB);

    this.createOrganizationCreatedHandler(
      emailTemplateBucket,
      organizationCreatedQueue,
      signupCodeDB,
      buildConfig
    );

    const preSignupHandler = this.createPreSignupHandler(
      signupCodeDB,
      buildConfig
    );
    const postConfirmationHandler = this.createPostConfirmationHandler(
      userCreatedSnsTopic,
      buildConfig
    );

    // Read Attributes
    const clientReadAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        email: true,
        emailVerified: true,
      })
      .withCustomAttributes(...["isAdmin"]);
    // Write Attributes
    const clientWriteAttributes =
      new cognito.ClientAttributes().withStandardAttributes({
        email: true,
      });
    // User Pool
    const userPool = new cognito.UserPool(this, "HalAppAuthUserPool", {
      userPoolName: "HalAppUserPool",
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        phone: false,
        username: false,
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
        postConfirmation: postConfirmationHandler,
      },
    });
    new cognito.UserPoolClient(this, "DefaultHalAppUserPoolClient", {
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
    });
  }
  createPreSignupHandler(
    signupCodeDB: cdk.aws_dynamodb.Table,
    buildConfig: BuildConfig
  ): NodejsFunction {
    const preSignupHandler = new NodejsFunction(this, "AuthPreSignupHandler", {
      memorySize: 1024,
      runtime: lambda.Runtime.NODEJS_16_X,
      functionName: "AuthPreSignupHandler",
      handler: "handler",
      timeout: cdk.Duration.seconds(15),
      entry: path.join(
        __dirname,
        `/../src/handlers/pre-signup-handler/index.ts`
      ),
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
    signupCodeDB.grantReadWriteData(preSignupHandler);
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
  createOrganizationCreatedQueue(): cdk.aws_sqs.Queue {
    const organizationCreatedDLQ = new sqs.Queue(
      this,
      "Auth-OrganizationCreatedDLQ",
      {
        queueName: "Auth-OrganizationCreatedDLQ",
        retentionPeriod: cdk.Duration.hours(10),
      }
    );
    const organizationCreatedQueue = new sqs.Queue(
      this,
      "Auth-OrganizationCreatedQueue",
      {
        queueName: "Auth-OrganizationCreatedQueue",
        visibilityTimeout: cdk.Duration.minutes(2),
        retentionPeriod: cdk.Duration.days(1),
        deadLetterQueue: {
          queue: organizationCreatedDLQ,
          maxReceiveCount: 4,
        },
      }
    );
    organizationCreatedQueue.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("sns.amazonaws.com")],
        actions: ["sqs:SendMessage"],
        resources: [organizationCreatedQueue.queueArn],
        conditions: {
          StringEquals: {
            "aws:SourceAccount": this.account,
          },
          ArnLike: {
            // Allows all buckets to send notifications since we haven't created the bucket yet.
            "aws:SourceArn": "arn:aws:sns:*:*:*",
          },
        },
      })
    );
    return organizationCreatedQueue;
  }
  createOrganizationCreatedHandler(
    emailTemplateBucket: cdk.aws_s3.Bucket,
    organizationCreatedQueue: cdk.aws_sqs.Queue,
    signupCodeDB: cdk.aws_dynamodb.Table,
    buildConfig: BuildConfig
  ): cdk.aws_lambda_nodejs.NodejsFunction {
    const organizationCreatedHandler = new NodejsFunction(
      this,
      "Auth-SqsOrganizationCreatedHandler",
      {
        memorySize: 1024,
        timeout: cdk.Duration.minutes(1),
        functionName: "Auth-SqsOrganizationCreatedHandler",
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          `/../src/handlers/organization-created-handler/index.ts`
        ),
        bundling: {
          target: "es2020",
          keepNames: true,
          logLevel: LogLevel.INFO,
          sourceMap: true,
          minify: true,
        },
        environment: {
          S3BucketName: `hal-email-template-${this.account}`,
          SESFromEmail: buildConfig.SESFromEmail,
          SESCCEmail: buildConfig.SESCCEmail,
          EmailTemplate: buildConfig.S3WelcomeToHalAppEmailTemplate,
        },
      }
    );
    organizationCreatedHandler.addEventSource(
      new SqsEventSource(organizationCreatedQueue, {
        batchSize: 1,
      })
    );
    organizationCreatedHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
        ],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      })
    );
    signupCodeDB.grantWriteData(organizationCreatedHandler);
    emailTemplateBucket.grantRead(organizationCreatedHandler);
    return organizationCreatedHandler;
  }
  createEmailTemplateBucket(): cdk.aws_s3.Bucket {
    const emailTemplateBucket = new s3.Bucket(this, "HalEmailTemplate", {
      bucketName: `hal-email-template-${this.account}`,
      autoDeleteObjects: false,
      versioned: true,
    });
    return emailTemplateBucket;
  }
  createAuthApiGateway(): cdk.aws_apigateway.RestApi {
    const authApi = new apigateway.RestApi(this, "HalAppAuthApi", {
      description: "HalApp Api Gateway",
    });
    return authApi;
  }
  createGetSignupCodeHandler(
    authApi: cdk.aws_apigateway.RestApi,
    signupCodeDB: cdk.aws_dynamodb.Table
  ) {
    const signupCodeResource = authApi.root
      .addResource("signupcode")
      .addResource("{code}");
    const getSignupCodeHandler = new NodejsFunction(
      this,
      "AuthGetSignupCodeHandler",
      {
        memorySize: 1024,
        runtime: lambda.Runtime.NODEJS_16_X,
        functionName: "AuthGetSignupCodeHandler",
        handler: "handler",
        timeout: cdk.Duration.seconds(15),
        entry: path.join(
          __dirname,
          `/../src/handlers/auth-get-signup-code-handler/index.ts`
        ),
        bundling: {
          target: "es2020",
          keepNames: true,
          logLevel: LogLevel.INFO,
          sourceMap: true,
          minify: true,
        },
      }
    );
    signupCodeResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getSignupCodeHandler, {
        proxy: true,
      })
    );
    signupCodeDB.grantReadData(getSignupCodeHandler);
  }
  createPostConfirmationHandler(
    userCreatedTopic: cdk.aws_sns.Topic,
    buildConfig: BuildConfig
  ): NodejsFunction {
    const postConfirmationHandler = new NodejsFunction(
      this,
      "AuthPostConfirmationHandler",
      {
        memorySize: 1024,
        runtime: lambda.Runtime.NODEJS_16_X,
        functionName: "AuthPostConfirmationHandler",
        handler: "handler",
        timeout: cdk.Duration.seconds(15),
        entry: path.join(
          __dirname,
          `/../src/handlers/post-confirmation-handler/index.ts`
        ),
        bundling: {
          target: "es2020",
          keepNames: true,
          logLevel: LogLevel.INFO,
          sourceMap: true,
          minify: buildConfig.Environment === "PRODUCTION" ? true : false,
        },
        environment: {
          SNSUserCreatedTopicArn: userCreatedTopic.topicArn,
          Region: buildConfig.Region,
        },
      }
    );
    userCreatedTopic.grantPublish(postConfirmationHandler);
    return postConfirmationHandler;
  }
  createUserCreatedSNSTopic(): cdk.aws_sns.Topic {
    const userCreatedTopic = new sns.Topic(this, "UserCreatedTopic", {
      displayName: "UserCreatedTopic",
    });
    return userCreatedTopic;
  }
}
