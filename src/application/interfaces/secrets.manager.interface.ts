export interface SecretsManager {
  getSecret(secretId: string): Promise<Record<string, any>>;
}
