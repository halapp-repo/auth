import "reflect-metadata";
import middy from "@middy/core";
import cors from "@middy/http-cors";
import httpErrorHandler from "@middy/http-error-handler";
import httpResponseSerializer from "@middy/http-response-serializer";
import {
  APIGatewayProxyEventV2,
  Context,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { diContainer } from "../../core/di-registry";
import SignUpCodeRepository from "../../repositories/signup-code.repository";
import createHttpError = require("http-errors");

const lambdaHandler = async function (
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> {
  const code = getCode(event.pathParameters?.code);
  const repo = diContainer.resolve<SignUpCodeRepository>(
    "SignUpCodeRepository"
  );
  const signupCode = await repo.getSignupCode(code);
  if (!signupCode) {
    throw createHttpError(
      400,
      JSON.stringify({
        error: "Kod eksik",
      })
    );
  }
  return {
    statusCode: 200,
    body: JSON.stringify(signupCode),
    headers: {
      "Content-Type": "application/json",
    },
  };
};
function getCode(code: string | undefined): string {
  if (!code) {
    throw createHttpError(400, "Code is required");
  }
  return code;
}
const handler = middy(lambdaHandler)
  .use(httpResponseSerializer())
  .use(httpErrorHandler())
  .use(cors());

export { handler, lambdaHandler };
