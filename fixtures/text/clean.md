# Getting started

Install the CLI and run it against a project folder:

```bash
npm install toolkit
toolkit check ./src
```

`toolkit check` exits with code 1 when it finds a problem and prints one line per problem. Add `--fix` to rewrite files in place.

## Configuration

The CLI reads `toolkit.config.js` from the project root. The only required key is `include`, a list of globs.
