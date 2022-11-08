import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { Store } from "./store";

export class CognitoStore implements Store {
  readonly cognitoClient: CognitoIdentityProviderClient;

  constructor() {
    this.cognitoClient = new CognitoIdentityProviderClient({});
  }
}
