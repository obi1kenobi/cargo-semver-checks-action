import os = require("os");
import hashFiles = require("hash-files");

import * as exec from "@actions/exec";
import * as rustCore from "@actions-rs/core";
import { createHash } from "node:crypto";

export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    } else {
        return String(error);
    }
}

export function getPlatformMatchingTarget(): string {
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

export function optionIfValueProvided(option: string, value?: string): string[] {
    return value ? [option, value] : [];
}

export function optionFromList(option: string, values: string[]): string[] {
    return values.map((value) => [option, value]).flat();
}

export function hashFilesOrEmpty(patterns: string[]): string {
    try {
        return hashFiles.sync({ files: patterns });
    } catch (error) {
        return "";
    }
}

export function hashIfNotEmpty(str: string): string {
    return str ? createHash("md5").update(str).digest("hex") : "";
}

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

export async function getRustcVersion(): Promise<string> {
    const stdout = { s: "" };
    await exec.exec("rustc", ["--version"], makeExecOptions(stdout));
    return removeWhitespaces(stdout.s);
}

export async function getCargoSemverChecksVersion(cargo: rustCore.Cargo): Promise<string> {
    const stdout = { s: "" };
    await cargo.call(["semver-checks", "--version"], makeExecOptions(stdout));
    return removeWhitespaces(stdout.s);
}
