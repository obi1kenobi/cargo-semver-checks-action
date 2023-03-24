import os = require("os");
import hashFiles = require("hash-files");

import * as exec from "@actions/exec";
import * as path from "path";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as rustCore from "@actions-rs/core";

export class RustdocCache {
    private readonly cachePath;
    private readonly cargo;
    private __cacheKey = "";

    constructor(cargo: rustCore.Cargo) {
        this.cachePath = path.join("target", "semver-checks", "cache");
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
        return await this.keyFromCommandCall("rustc", ["--version"]);
    }

    private async getCargoSemverChecksVersion(): Promise<string> {
        return await this.keyFromCommandCall(this.cargo, ["semver-checks", "--version"]);
    }

    private async keyFromCommandCall(
        command: string | rustCore.Cargo,
        args: string[]
    ): Promise<string> {
        let stdout = "";
        const execOptions = {
            listeners: {
                stdout: (buffer: Buffer): void => {
                    stdout += buffer.toString();
                },
            },
        };

        if (command instanceof rustCore.Cargo) {
            await command.call(args, execOptions);
        } else {
            await exec.exec(command, args, execOptions);
        }

        return stdout.trim().replace(/\s/g, "-");
    }
}
