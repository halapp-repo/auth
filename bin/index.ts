#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { HalappAuthStack } from "../lib/halapp-auth-stack";
import getConfig from "../config";

const app = new cdk.App();

async function Main() {
  const buildConfig = getConfig(app);
  const mainStackName = `${buildConfig.App}-${buildConfig.Environment}`;
  const mainStack = new HalappAuthStack(app, mainStackName, {
    env: {
      account: buildConfig.AWSAccountID,
      region: buildConfig.Region,
    },
    tags: {
      App: buildConfig.App,
      Env: buildConfig.Environment,
    },
  });
}

Main();
