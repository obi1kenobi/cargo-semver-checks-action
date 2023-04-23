import os = require("os");

import * as path from "path";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as rustCore from "@actions-rs/core";

import {
    getCargoSemverChecksVersion,
    getRustcVersion,
    hashFilesOrEmpty,
    hashIfNotEmpty,
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
        const cacheKeyWithLocalHash = `${await this.cacheKey()}-${this.getLocalCacheHash()}`;
        if (this.restoredCacheKey == cacheKeyWithLocalHash) {
            core.info("Rustdoc cache is up to date, skipping saving.");
        } else {
            core.info(`Saving rustdoc cache using key ${cacheKeyWithLocalHash}`);
            await cache.saveCache([this.cachePath], cacheKeyWithLocalHash);
            this.restoredCacheKey = cacheKeyWithLocalHash;
        }
    }

    async restore(): Promise<boolean> {
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
                rustCore.input.getInput("prefix-key") || "",
                rustCore.input.getInput("shared-key") || this.getRunDependentKey(),
                os.platform() as string,
                await getRustcVersion(),
                await getCargoSemverChecksVersion(this.cargo),
                this.getCargoLocksHash(),
                "semver-checks-rustdoc",
            ].join("-");
        }

        return this.__cacheKey;
    }

    private getRunDependentKey(): string {
        return [
            process.env["GITHUB_JOB"] || "",
            "package",
            rustCore.input.getInputList("package").sort(),
            "exclude",
            rustCore.input.getInputList("exclude").sort(),
            "manifest-path",
            hashIfNotEmpty(rustCore.input.getInput("manifest-path")),
        ]
            .flat()
            .join("-");
    }

    private getLocalCacheHash(): string {
        return hashFilesOrEmpty([path.join(this.cachePath, "**")]);
    }

    private getCargoLocksHash(): string {
        return hashFilesOrEmpty([path.join(this.workspaceRoot, "**", "Cargo.lock")]);
    }
}
