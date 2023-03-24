import os = require("os");

import * as exec from "@actions/exec";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as io from "@actions/io";
import * as toolCache from "@actions/tool-cache";
import * as rustCore from "@actions-rs/core";

import { RustdocCache } from "./rustdoc-cache";

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    } else {
        return String(error);
    }
}

function getPlatformMatchingTarget(): string {
    const platform = os.platform() as string;
    switch (platform) {
        case "linux":
            return "x86_64-unknown-linux-gnu";
        case "win32":
            return "x86_64-pc-windows-msvc";
        case "darwin":
            return "x86_64-apple-darwin";
        default:
            throw new Error("Unsupported runner");
    }
}

function optionIfValueProvided(option: string, value?: string): string[] {
    return value ? [option, value] : [];
}

function getCheckReleaseArguments(): string[] {
    return [
        optionIfValueProvided("--package", rustCore.input.getInput("package")),
        optionIfValueProvided("--manifest-path", rustCore.input.getInput("manifest-path")),
        rustCore.input.getInputBool("verbose") ? ["--verbose"] : [],
    ].flat();
}

function getGitHubToken(): string {
    const token = process.env["GITHUB_TOKEN"] || rustCore.input.getInput("github-token");
    if (!token) {
        throw new Error("Querying the GitHub API is possible only if the GitHub token is set.");
    }
    return token;
}

async function getCargoSemverChecksDownloadURL(target: string): Promise<string> {
    const octokit = github.getOctokit(getGitHubToken());

    const getReleaseUrl = await octokit.rest.repos.getLatestRelease({
        owner: "obi1kenobi",
        repo: "cargo-semver-checks",
    });

    const asset = getReleaseUrl.data.assets.find((asset) => {
        return asset["name"].endsWith(`${target}.tar.gz`);
    });

    if (!asset) {
        throw new Error(`Couldn't find a release for target ${target}.`);
    }

    return asset.url;
}

async function installRustUp(): Promise<void> {
    const rustup = await rustCore.RustUp.getOrInstall();
    await rustup.call(["show"]);
    await rustup.setProfile("minimal");
    await rustup.installToolchain("stable");

    // [TODO] Remove this temporary fix once the underlying issue is fixed.
    if (os.platform() == "win32") {
        try {
            await exec.exec("mkdir C:\\Users\\runneradmin\\.cargo\\registry\\index");
        } catch (error) {
            core.info(`Failed to create registry index directory: ${getErrorMessage(error)}`);
        }
    }
}

async function runCargoSemverChecks(cargo: rustCore.Cargo): Promise<void> {
    // The default location of the target directory varies depending on whether
    // the action is run inside a workspace or on a single crate. We therefore
    // need to set the target directory explicitly.
    process.env["CARGO_TARGET_DIR"] = "target";

    await cargo.call(["semver-checks", "check-release"].concat(getCheckReleaseArguments()));
}

async function installCargoSemverChecksFromPrecompiledBinary(): Promise<void> {
    const url = await getCargoSemverChecksDownloadURL(getPlatformMatchingTarget());

    core.info(`downloading cargo-semver-checks from ${url}`);
    const tarballPath = await toolCache.downloadTool(url, undefined, `token ${getGitHubToken()}`, {
        accept: "application/octet-stream",
    });
    core.info(`extracting ${tarballPath}`);
    const binPath = await toolCache.extractTar(tarballPath, undefined, ["xz"]);

    core.addPath(binPath);
}

async function installCargoSemverChecksUsingCargo(cargo: rustCore.Cargo): Promise<void> {
    await cargo.call(["install", "cargo-semver-checks", "--locked"]);
}

async function installCargoSemverChecks(cargo: rustCore.Cargo): Promise<void> {
    if ((await io.which("cargo-semver-checks")) != "") {
        return;
    }

    core.info("cargo-semver-checks is not installed, installing now...");

    try {
        await installCargoSemverChecksFromPrecompiledBinary();
    } catch (error) {
        core.info("Failed to download precompiled binary of cargo-semver-checks.");
        core.info(`Error: ${getErrorMessage(error)}`);
        core.info("Installing using cargo install...");

        await installCargoSemverChecksUsingCargo(cargo);
    }
}

async function run(): Promise<void> {
    await installRustUp();

    const cargo = await rustCore.Cargo.get();

    await installCargoSemverChecks(cargo);

    const cache = new RustdocCache(cargo);
    const cacheFound = await cache.restore();

    await runCargoSemverChecks(cargo);

    if (!cacheFound) {
        await cache.save();
    }
}

async function main() {
    try {
        await run();
    } catch (error) {
        core.setFailed(getErrorMessage(error));
    }
}

main();
