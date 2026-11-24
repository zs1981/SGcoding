import { constants, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

export function userDirectory(): string {
    return resolve(homedir(), ".sgcoding");
}

export function loadUserEnvironment(): void {
    loadEnv({ path: resolve(userDirectory(), ".env"), quiet: true });
}

function createIfMissing(create: () => void): void {
    try {
        create();
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
}

export function initializeUserConfig(): { providerConfig: string } {
    const directory = userDirectory();
    mkdirSync(directory, { recursive: true, mode: 0o700 });

    const providerConfig = resolve(directory, "provider.yaml");
    const legacyConfig = resolve(directory, "default-provider.yaml");
    createIfMissing(() => copyFileSync(
        existsSync(legacyConfig)
            ? legacyConfig
            : fileURLToPath(new URL("../provider.yaml", import.meta.url)),
        providerConfig,
        constants.COPYFILE_EXCL,
    ));
    createIfMissing(() => writeFileSync(
        resolve(directory, ".env"),
        "# 填写所用模型的 API Key，然后重新启动 sgcoding。\nDEEPSEEK_API_KEY=\n# ARK_API_KEY=\n",
        { flag: "wx", mode: 0o600 },
    ));

    loadUserEnvironment();
    const configuredProvider = process.env.SGCODING_PROVIDER_CONFIG?.trim();
    return {
        providerConfig: configuredProvider ? resolve(configuredProvider) : providerConfig,
    };
}
