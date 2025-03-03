import os = require("os");

import * as io from "@actions/io";
import * as path from "path";
import * as crypto from "crypto";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as rustCore from "@actions-rs/core";

import {
    getCargoSemverChecksVersion,
    getRustcVersion,
    hashFiles,
    hashFolderContent,
} from "./utils";

export class RustdocCache {
    private readonly cargo;
    private readonly cachePath;
    private readonly workspaceRoot;
    private restoredCacheKey = "";
    private __cacheKey = "";

    constructor(cargo: rustCore.Cargo, cachePath: string, workspaceRoot: string) {
        this.cargo = cargo;
        this.cachePath = path.resolve(cachePath);
        this.workspaceRoot = path.resolve(workspaceRoot);
    }

    async save(): Promise<void> {
        const cacheKeyWithLocalHash = `${await this.cacheKey()}-${await this.getLocalCacheHash()}`;
        if (this.restoredCacheKey == cacheKeyWithLocalHash) {
            core.info("Rustdoc cache is up to date, skipping saving.");
        } else {
            core.info(`Saving rustdoc cache using key ${cacheKeyWithLocalHash}`);
            await cache.saveCache([this.cachePath], cacheKeyWithLocalHash);
            this.restoredCacheKey = cacheKeyWithLocalHash;
        }
    }

    async restore(): Promise<boolean> {
        await io.mkdirP(this.cachePath);

        core.info("Restoring rustdoc cache...");
        core.info(`Rustdoc cache path: ${this.cachePath}.`);
        core.info(`Rustdoc cache key: ${await this.cacheKey()}.`);

        const key = await cache.restoreCache([this.cachePath], await this.cacheKey(), [
            await this.cacheKey(),
        ]);
        if (key) {
            core.info(`Restored rustdoc cache using key ${key}.`);
            this.restoredCacheKey = key;
            return true;
        } else {
            core.info(`Rustdoc cache not found.`);
            return false;
        }
    }

    private async cacheKey(): Promise<string> {
        if (!this.__cacheKey) {
            this.__cacheKey = [
                rustCore.input.getInput("prefix-key") || "semver",
                rustCore.input.getInput("shared-key") || this.getRunDependentKey(),
                os.platform() as string,
                await getRustcVersion(),
                await getCargoSemverChecksVersion(this.cargo),
                await this.getCargoLocksHash(),
                "semver-checks-rustdoc",
            ].join("-");
        }

        return this.__cacheKey;
    }

    private getRunDependentKey(): string {
        const hasher = crypto.createHash("md5");
        hasher.update(JSON.stringify({ package: rustCore.input.getInputList("package").sort() }));
        hasher.update(JSON.stringify({ exclude: rustCore.input.getInputList("exclude").sort() }));
        hasher.update(JSON.stringify({ manifest_path: rustCore.input.getInput("manifest-path") }));

        return [process.env["GITHUB_JOB"] || "", hasher.digest("hex").substring(0, 16)].join("-");
    }

    private async getLocalCacheHash(): Promise<string> {
        return await hashFolderContent(this.cachePath);
    }

    private async getCargoLocksHash(): Promise<string> {
        return await hashFiles([path.join(this.workspaceRoot, "**", "Cargo.lock")]);
    }
}
