import { SESClient } from "@aws-sdk/client-ses";
import { Store } from "./store";

export class SESStore implements Store {
  readonly sesClient: SESClient;

  constructor() {
    this.sesClient = new SESClient({});
  }
}
