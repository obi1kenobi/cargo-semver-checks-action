import * as fs from "fs";
import * as path from "path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { getErrorMessage } from "../utils";

/*********/
/* TYPES */
/*********/
enum ResultType {
    Patch = "patch",
    Minor = "minor",
    Major = "major",
    Warning = "warning",
    Error = "error",
}

class ResultSummary {
    minors: CargoSemverChecksMinor[];
    majors: CargoSemverChecksMajor[];
    warnings: CargoSemverChecksWarning[];
    errors: CargoSemverChecksError[];
    result: ResultType;

    constructor(
        minors: CargoSemverChecksMinor[],
        majors: CargoSemverChecksMajor[],
        warnings: CargoSemverChecksWarning[],
        errors: CargoSemverChecksError[],
    ) {
        this.minors = minors;
        this.majors = majors;
        this.warnings = warnings;
        this.errors = errors;

        this.result = this.determineResultType();
    }

    toString(): string {
        return `ResultSummary:
        Result: ${this.result}
        Minors (${this.minors.length}): ${this.minors}
        Majors (${this.majors.length}): ${this.majors}
        Warnings (${this.warnings.length}): ${this.warnings}
        Errors (${this.errors.length}): ${this.errors}`;
    }

    private determineResultType(): ResultType {
        if (this.errors.length) {
            return ResultType.Error;
        } else if (this.warnings.length) {
            return ResultType.Warning;
        } else if (this.majors.length) {
            return ResultType.Major;
        } else if (this.minors.length) {
            return ResultType.Minor;
        } else {
            return ResultType.Patch;
        }
    }
}

class Result {}

class SemverBreakingResult extends Result {}

class CargoSemverChecksMinor extends SemverBreakingResult {}

class CargoSemverChecksMajor extends SemverBreakingResult {}

class CargoSemverChecksWarning extends Result {}

class CargoSemverChecksError extends Result {}

/***********/
/* HELPERS */
/***********/
function getGitHubToken(): string {
    const token = process.env["GITHUB_TOKEN"] || core.getInput("github-token");
    if (!token) {
        throw new Error("Querying the GitHub API is possible only if the GitHub token is set.");
    }
    return token;
}

async function loadCommentTemplate(result: ResultType): Promise<string> {
    const templatePath = path.join(__dirname, "resources/templates", `${result}.txt`);
    try {
        await fs.promises.access(templatePath);
    } catch {
        throw new Error(`Unable to access template file: ${templatePath}`);
    }

    return fs.promises.readFile(templatePath, "utf-8");
}

function replaceTemplatePlaceholders(template: string, resultSummary: ResultSummary): string {
    const replacements: { [key: string]: string } = {
        minorCount: resultSummary.minors.length.toString(),
        majorCount: resultSummary.majors.length.toString(),
        warningCount: resultSummary.warnings.length.toString(),
        errorCount: resultSummary.errors.length.toString(),
    };

    for (const key in replacements) {
        const placeholder = `{{${key}}}`;
        template = template.replaceAll(placeholder, replacements[key]);
    }

    return template;
}

/***********/
/* PARSING */
/***********/
function parseCargoSemverChecksOutput(): ResultSummary {
    const output = core.getInput("cargo-semver-checks-output");
    core.info(`Parsing cargo-semver-checks output: ${output}`);

    if (!output) {
        throw new Error("No output provided for parsing.");
    }

    const resultSummary = new ResultSummary(
        parseMinors(output),
        parseMajors(output),
        parseWarnings(output),
        parseErrors(output),
    );

    core.info(`Parsed summary: ${resultSummary}`);
    return resultSummary;
}

function parseMinors(output: string): CargoSemverChecksMinor[] {
    return [];
}

function parseMajors(output: string): CargoSemverChecksMajor[] {
    return [];
}

function parseWarnings(output: string): CargoSemverChecksWarning[] {
    return [];
}

function parseErrors(output: string): CargoSemverChecksError[] {
    return [];
}

/************/
/* COMMENTS */
/************/
async function postPullRequestComment(resultSummary: ResultSummary): Promise<void> {
    const octokit = github.getOctokit(getGitHubToken());
    const pullRequest = github.context.payload.pull_request;

    if (!pullRequest) {
        core.info("Not a pull_request event. No further actions required.");
        return;
    }

    const template = await loadCommentTemplate(resultSummary.result);
    const comment = replaceTemplatePlaceholders(template, resultSummary);

    await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: pullRequest.number,
        body: comment,
    });

    core.info(`Comment posted on pull request #${pullRequest.number}`);
}


/**********/
/* RUNNER */
/**********/
async function run(): Promise<void> {
    const resultsMap = parseCargoSemverChecksOutput();
    await postPullRequestComment(resultsMap);
}

async function main() {
    try {
        await run();
    } catch (error) {
        core.setFailed(getErrorMessage(error));
    }
}

main();
