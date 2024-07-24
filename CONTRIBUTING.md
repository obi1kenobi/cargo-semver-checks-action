# Contributing

## General

A good general description on how to develop a GitHub JavaScript action can be found [here](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action).

## Developing locally

### Prerequisites

- Node 20

### Installing dependencies

`npm install`

### Building the action

`npm run build`

Updates the contents of the `dist` folder, which then _needs to be committed_.

### Formatting source files

`npm run format`

### Checking formatting of source files

`npm run format-check`

### Linting source files

`npm run lint`

### Running tests

`npm run test`

### Running all of the above sequentially

`npm run all`

## Adding a new input parameter

The following places need to be updated

- action.yml
- src/main.ts (`getCheckReleaseArguments()`)
- dist/index.js (automatically generated)
- README.md
