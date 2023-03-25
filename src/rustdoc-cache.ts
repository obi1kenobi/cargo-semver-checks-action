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

export class RustdocCache {
    private readonly cachePath;
    private readonly cargo;
    private __cacheKey = "";

    constructor(cargo: rustCore.Cargo, cachePath: string) {
        this.cachePath = path.resolve(cachePath);
        this.cargo = cargo;
    }

    async save(): Promise<void> {
        core.info("Saving rustdoc cache...");
        await cache.saveCache([this.cachePath], await this.cacheKey());
    }

    async restore(): Promise<boolean> {
        core.info("Restoring rustdoc cache...");
        core.info(`Rustdoc cache path: ${this.cachePath}.`);
        core.info(`Rustdoc cache key: ${await this.cacheKey()}.`);

        const key = await cache.restoreCache([this.cachePath], await this.cacheKey());
        if (key) {
            core.info(`Restored rustdoc cache.`);
            return true;
        } else {
            core.info(`Rustdoc cache not found.`);
            return false;
        }
    }

    private async cacheKey(): Promise<string> {
        if (!this.__cacheKey) {
            this.__cacheKey = [
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

    private getCargoLocksHash(): string {
        const manifestPath = rustCore.input.getInput("manifest-path") || "./";
        const manifestDir = path.extname(manifestPath) ? path.dirname(manifestPath) : manifestPath;
        return hashFiles.sync({
            files: [path.join(manifestDir, "**", "Cargo.lock")],
        });
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
