import * as core from "@actions/core";
import * as github from "@actions/github";
import { getErrorMessage } from "./utils";

function getGitHubToken(): string {
    const token = process.env["GITHUB_TOKEN"] || core.getInput("github-token");
    if (!token) {
        throw new Error("Querying the GitHub API is possible only if the GitHub token is set.");
    }
    return token;
}

async function postPullRequestComment(): Promise<void> {
    const octokit = github.getOctokit(getGitHubToken());
    const pullRequest = github.context.payload.pull_request;

    if (!pullRequest) {
        core.info("Not a pull_request event. No further actions required.");
        return;
    }

    await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: pullRequest.number,
        body: "Hello!",
    });

    core.info(`Comment posted on pull request #${pullRequest.number}`);
}

async function main() {
    try {
        await postPullRequestComment();
    } catch (error) {
        core.setFailed(getErrorMessage(error));
    }
}

main();
