import os = require("os");
import hashFiles = require("hash-files");

import * as exec from "@actions/exec";
import * as path from "path";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as rustCore from "@actions-rs/core";

function makeExecOptions(stdout: { s: string }): exec.ExecOptions {
    return {
        listeners: {
            stdout: (buffer: Buffer): void => {
                stdout.s += buffer.toString();
            },
        },
    };
}

function removeWhitespaces(str: string): string {
    return str.trim().replace(/\s/g, "-");
}

function hashFilesOrEmpty(patterns: string[]): string {
    try {
        return hashFiles.sync({ files: patterns });
    } catch (error) {
        return "";
    }
}

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
                rustCore.input.getInput("cache-key"),
                os.platform() as string,
                await this.getRustcVersion(),
                await this.getCargoSemverChecksVersion(),
                this.getCargoLocksHash(),
                "semver-checks-rustdoc",
            ].join("-");
        }

        return this.__cacheKey;
    }

    private getLocalCacheHash(): string {
        return hashFilesOrEmpty([path.join(this.cachePath, "**")]);
    }

    private getCargoLocksHash(): string {
        return hashFilesOrEmpty([path.join(this.workspaceRoot, "**", "Cargo.lock")]);
    }

    private async getRustcVersion(): Promise<string> {
        const stdout = { s: "" };
        await exec.exec("rustc", ["--version"], makeExecOptions(stdout));
        return removeWhitespaces(stdout.s);
    }

    private async getCargoSemverChecksVersion(): Promise<string> {
        const stdout = { s: "" };
        await this.cargo.call(["semver-checks", "--version"], makeExecOptions(stdout));
        return removeWhitespaces(stdout.s);
    }
}
