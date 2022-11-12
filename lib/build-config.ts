export interface BuildConfig {
  readonly AWSAccountID: string;
  readonly App: string;
  readonly Environment: string;
  readonly Region: string;
  readonly SESFromEmail: string;
  readonly SESReplyToEmail: string;
  readonly SESCCEmail: string;
  readonly S3WelcomeToHalAppEmailTemplate: string;
}
