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
import * as apiGateway from "@aws-cdk/aws-apigatewayv2-alpha";
import * as apiGatewayAuthorizers from "@aws-cdk/aws-apigatewayv2-authorizers-alpha";
import * as apiGatewayIntegrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { HttpMethod } from "@aws-cdk/aws-apigatewayv2-alpha";

export class HalappAuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const buildConfig = getConfig(scope as cdk.App);

    const organizationCreatedQueue =
      this.createOrganizationCreatedQueue(buildConfig);

    const emailTemplateBucket = this.createEmailTemplateBucket(buildConfig);

    const signupCodeDB = this.createSignupCodeDB(buildConfig);
    const authApi = this.createAuthApiGateway(buildConfig);
    const userCreatedSnsTopic = this.createUserCreatedSNSTopic(buildConfig);
    const userJoinedOrganizationSnsTopic =
      this.createJoinedOrganizationSNSTopic(buildConfig);

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
    const postAuthenticationHandler = this.createPostAuthenticationHandler(
      userJoinedOrganizationSnsTopic,
      signupCodeDB,
      buildConfig
    );

    // Read Attributes
    const clientReadAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        email: true,
        emailVerified: true,
      })
      .withCustomAttributes(...["isAdmin", "organizationId"]);
    // Write Attributes
    const clientWriteAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        email: true,
      })
      .withCustomAttributes(...["organizationId"]);
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
        organizationId: new cognito.StringAttribute({
          mutable: false,
          minLen: 1,
          maxLen: 45,
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
        postAuthentication: postAuthenticationHandler,
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
    signupCodeDB: cdk.aws_dynamodb.ITable,
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
  createSignupCodeDB(buildConfig: BuildConfig): cdk.aws_dynamodb.ITable {
    let table;
    if (buildConfig.ShouldCreateDynamoSignupCodeDB === false) {
      table = dynamodb.Table.fromTableName(
        this,
        "SignUpCodeDB",
        buildConfig.DynamoSignupCodeDBName
      );
    } else {
      table = new dynamodb.Table(this, "SignUpCodeDB", {
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        tableName: buildConfig.DynamoSignupCodeDBName,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        partitionKey: {
          name: "Code",
          type: dynamodb.AttributeType.STRING,
        },
        pointInTimeRecovery: true,
      });
    }
    return table;
  }
  createOrganizationCreatedQueue(buildConfig: BuildConfig): cdk.aws_sqs.Queue {
    const organizationCreatedDLQ = new sqs.Queue(
      this,
      "Auth-OrganizationCreatedDLQ",
      {
        queueName: `${buildConfig.SQSOrganizationCreatedQueue}DLQ`,
        retentionPeriod: cdk.Duration.hours(10),
      }
    );
    const organizationCreatedQueue = new sqs.Queue(
      this,
      "Auth-OrganizationCreatedQueue",
      {
        queueName: `${buildConfig.SQSOrganizationCreatedQueue}`,
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
    emailTemplateBucket: cdk.aws_s3.IBucket,
    organizationCreatedQueue: cdk.aws_sqs.Queue,
    signupCodeDB: cdk.aws_dynamodb.ITable,
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
  createEmailTemplateBucket(buildConfig: BuildConfig): cdk.aws_s3.IBucket {
    let emailTemplateBucket;
    if (buildConfig.ShouldCreateS3EmailTemplateBucket === false) {
      emailTemplateBucket = s3.Bucket.fromBucketAttributes(this, "MyBucket", {
        bucketName: buildConfig.S3EmailTemplateBucketName,
      });
    } else {
      emailTemplateBucket = new s3.Bucket(this, "HalEmailTemplate", {
        bucketName: buildConfig.S3EmailTemplateBucketName,
        autoDeleteObjects: false,
        versioned: true,
      });
    }
    return emailTemplateBucket;
  }
  createAuthApiGateway(buildConfig: BuildConfig): apiGateway.HttpApi {
    const authApi = new apiGateway.HttpApi(this, "HalAppAuthApiV2", {
      description: "HalApp Auth Api Gateway",
      apiName: "HalAppAuthApiV2",
      corsPreflight: {
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
        ],
        allowMethods: [
          apiGateway.CorsHttpMethod.GET,
          apiGateway.CorsHttpMethod.HEAD,
          apiGateway.CorsHttpMethod.OPTIONS,
          apiGateway.CorsHttpMethod.POST,
          apiGateway.CorsHttpMethod.PUT,
          apiGateway.CorsHttpMethod.DELETE,
          apiGateway.CorsHttpMethod.PATCH,
        ],
        allowOrigins:
          buildConfig.Environment === "PRODUCTION"
            ? ["https://halapp.io", "https://www.halapp.io"]
            : ["*"],
      },
    });
    return authApi;
  }
  createGetSignupCodeHandler(
    authApi: apiGateway.HttpApi,
    signupCodeDB: cdk.aws_dynamodb.ITable
  ) {
    const getSignupCodeHandler = new NodejsFunction(
      this,
      "AuthGetSignupCodeHandler",
      {
        memorySize: 1024,
        runtime: lambda.Runtime.NODEJS_18_X,
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
    authApi.addRoutes({
      methods: [HttpMethod.GET],
      integration: new apiGatewayIntegrations.HttpLambdaIntegration(
        "getAuthSignupCodeIntegration",
        getSignupCodeHandler
      ),
      path: "/signupcode/{code}",
    });
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
          SNSTopicArn: userCreatedTopic.topicArn,
          Region: buildConfig.Region,
        },
      }
    );
    userCreatedTopic.grantPublish(postConfirmationHandler);
    return postConfirmationHandler;
  }
  createPostAuthenticationHandler(
    userJoinedOrganizationTopic: cdk.aws_sns.Topic,
    signupCodeDB: cdk.aws_dynamodb.ITable,
    buildConfig: BuildConfig
  ): NodejsFunction {
    const postAuthenticationHandler = new NodejsFunction(
      this,
      "AuthPostAuthenticationHandler",
      {
        memorySize: 1024,
        runtime: lambda.Runtime.NODEJS_16_X,
        functionName: "AuthPostAuthenticationHandler",
        handler: "handler",
        timeout: cdk.Duration.seconds(15),
        entry: path.join(
          __dirname,
          `/../src/handlers/post-authentication-handler/index.ts`
        ),
        bundling: {
          target: "es2020",
          keepNames: true,
          logLevel: LogLevel.INFO,
          sourceMap: true,
          minify: buildConfig.Environment === "PRODUCTION" ? true : false,
        },
        environment: {
          SNSTopicArn: userJoinedOrganizationTopic.topicArn,
          Region: buildConfig.Region,
        },
      }
    );
    userJoinedOrganizationTopic.grantPublish(postAuthenticationHandler);
    signupCodeDB.grantReadWriteData(postAuthenticationHandler);
    return postAuthenticationHandler;
  }
  createUserCreatedSNSTopic(buildConfig: BuildConfig): cdk.aws_sns.Topic {
    const userCreatedTopic = new sns.Topic(this, "UserCreatedTopic", {
      displayName: "UserCreatedTopic",
      topicName: buildConfig.SNSUserCreatedTopic,
    });
    return userCreatedTopic;
  }
  createJoinedOrganizationSNSTopic(
    buildConfig: BuildConfig
  ): cdk.aws_sns.Topic {
    const userJoinedOrganizationTopic = new sns.Topic(
      this,
      "UserJoinedOrganizationTopic",
      {
        displayName: "UserJoinedOrganizationTopic",
        topicName: buildConfig.SNSUserJoinedOrganizationTopic,
      }
    );
    return userJoinedOrganizationTopic;
  }
}
