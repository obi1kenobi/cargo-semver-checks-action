import * as path from "path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as io from "@actions/io";
import * as toolCache from "@actions/tool-cache";
import * as rustCore from "@actions-rs/core";
import stripAnsi from "strip-ansi";

import {
    getErrorMessage,
    getPlatformMatchingTarget,
    getRustcVersion,
    optionFromList,
    optionIfValueProvided,
} from "./utils";
import { RustdocCache } from "./rustdoc-cache";

const CARGO_TARGET_DIR = path.join("semver-checks", "target");

function getCheckReleaseArguments(): string[] {
    return [
        optionFromList("--package", rustCore.input.getInputList("package")),
        optionFromList("--exclude", rustCore.input.getInputList("exclude")),
        optionIfValueProvided("--manifest-path", rustCore.input.getInput("manifest-path")),
        optionIfValueProvided("--release-type", rustCore.input.getInput("release-type")),
        getFeatureGroup(rustCore.input.getInput("feature-group")),
        optionFromList("--features", rustCore.input.getInputList("features")),
        rustCore.input.getInputBool("verbose") ? ["--verbose"] : [],
    ].flat();
}

function getFeatureGroup(name = ""): string[] {
    switch (name) {
        case "all-features":
            return ["--all-features"];
        case "default-features":
            return ["--default-features"];
        case "only-explicit-features":
            return ["--only-explicit-features"];
        case "":
            return [];
        default:
            throw new Error(`Unsupported feature group: ${name}`);
    }
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

async function installRustUpIfRequested(): Promise<void> {
    const toolchain = rustCore.input.getInput("rust-toolchain") || "stable";
    if (toolchain != "manual") {
        const rustup = await rustCore.RustUp.getOrInstall();
        await rustup.call(["show"]);
        await rustup.setProfile("minimal");
        await rustup.installToolchain(toolchain);

        // Setting the environment variable here affects only processes spawned
        // by this action, so it will not override the default toolchain globally.
        process.env["RUSTUP_TOOLCHAIN"] = toolchain;
    }

    // Disable incremental compilation.
    process.env["CARGO_INCREMENTAL"] ||= "0";

    // Enable colors in the output.
    process.env["CARGO_TERM_COLOR"] ||= "always";

    // Enable sparse checkout for crates.io except for Rust 1.66 and 1.67,
    // on which it is unstable.
    if (!process.env["CARGO_REGISTRIES_CRATES_IO_PROTOCOL"]) {
        const rustcVersion = await getRustcVersion();
        if (!rustcVersion.startsWith("rustc-1.66") && !rustcVersion.startsWith("rustc-1.67")) {
            process.env["CARGO_REGISTRIES_CRATES_IO_PROTOCOL"] = "sparse";
        }
    }
}

async function runCargoSemverChecks(cargo: rustCore.Cargo): Promise<string> {
    // The default location of the target directory varies depending on whether
    // the action is run inside a workspace or on a single crate. We therefore
    // need to set the target directory explicitly.
    process.env["CARGO_TARGET_DIR"] = CARGO_TARGET_DIR;

    let output: string = "";
    const options: any = {};
    const handleEventData = (data: Buffer) => {
        if (data && data.length > 0) {
            output += data.toString();
        }
    };
    options.listeners = {
        stdout: handleEventData,
        stderr: handleEventData,
    };
    await cargo.call(
        ["semver-checks", "check-release"].concat(getCheckReleaseArguments()),
        options
    );
    return output;
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

async function run(): Promise<string> {
    const manifestPath = path.resolve(rustCore.input.getInput("manifest-path") || "./");
    const manifestDir = path.extname(manifestPath) ? path.dirname(manifestPath) : manifestPath;

    await installRustUpIfRequested();

    const cargo = await rustCore.Cargo.get();

    await installCargoSemverChecks(cargo);

    const cache = new RustdocCache(
        cargo,
        path.join(CARGO_TARGET_DIR, "semver-checks", "cache"),
        manifestDir
    );

    await cache.restore();
    const output = await runCargoSemverChecks(cargo);
    core.setOutput("logs", stripAnsi(output));
    await cache.save();
    return output;
}

async function main() {
    try {
        await run();
    } catch (error) {
        const logs = getErrorMessage(error);
        core.setFailed(logs);
    }
}

main();
