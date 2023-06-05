import * as path from "path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as io from "@actions/io";
import * as toolCache from "@actions/tool-cache";
import * as rustCore from "@actions-rs/core";

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

async function getCargoSemverChecksDownloadURL(target: string, version: 'latest' | string): Promise<string> {
    const octokit = github.getOctokit(getGitHubToken());

    let getReleaseUrl;

    if (version === 'latest') {
        getReleaseUrl = await octokit.rest.repos.getLatestRelease({
            owner: "obi1kenobi",
            repo: "cargo-semver-checks",
        });
    } else {
        getReleaseUrl = octokit.rest.repos.getReleaseByTag({
            owner: "obi1kenobi",
            repo: "cargo-semver-checks",
            tag: version,
        });
    }

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

async function runCargoSemverChecks(cargo: rustCore.Cargo): Promise<void> {
    // The default location of the target directory varies depending on whether
    // the action is run inside a workspace or on a single crate. We therefore
    // need to set the target directory explicitly.
    process.env["CARGO_TARGET_DIR"] = CARGO_TARGET_DIR;

    await cargo.call(["semver-checks", "check-release"].concat(getCheckReleaseArguments()));
}

async function installCargoSemverChecksFromPrecompiledBinary(version: 'latest' | string): Promise<void> {
    const url = await getCargoSemverChecksDownloadURL(getPlatformMatchingTarget(), version);

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

async function installCargoSemverChecks(cargo: rustCore.Cargo, version: 'latest' | string): Promise<void> {
    if ((await io.which("cargo-semver-checks")) != "") {
        return;
    }

    core.info("cargo-semver-checks is not installed, installing now...");

    try {
        await installCargoSemverChecksFromPrecompiledBinary(version);
    } catch (error) {
        core.info("Failed to download precompiled binary of cargo-semver-checks.");
        core.info(`Error: ${getErrorMessage(error)}`);
        core.info("Installing using cargo install...");

        await installCargoSemverChecksUsingCargo(cargo);
    }
}

async function run(): Promise<void> {
    const manifestPath = path.resolve(rustCore.input.getInput("manifest-path") || "./");
    const version = rustCore.input.getInput("version") || "latest";
    const manifestDir = path.extname(manifestPath) ? path.dirname(manifestPath) : manifestPath;

    await installRustUpIfRequested();

    const cargo = await rustCore.Cargo.get();

    await installCargoSemverChecks(cargo, version);

    const cache = new RustdocCache(
        cargo,
        path.join(CARGO_TARGET_DIR, "semver-checks", "cache"),
        manifestDir
    );

    await cache.restore();
    await runCargoSemverChecks(cargo);
    await cache.save();
}

async function main() {
    try {
        await run();
    } catch (error) {
        core.setFailed(getErrorMessage(error));
    }
}

main();
