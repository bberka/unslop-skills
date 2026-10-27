# Getting started

Install the CLI and run it against a project folder:

```bash
npm install toolkit
toolkit check ./src
```

`toolkit check` exits with code 1 when it finds a problem and prints one line per problem. Add `--fix` to rewrite files in place.

## Configuration

The CLI reads `toolkit.config.js` from the project root. The only required key is `include`, a list of globs.

- **Default:** `["src/**"]`
- **Discord:** join the server to ask about config keys that are not documented yet.

The config file is meant to serve as the single place for project settings.

## Using Visual Studio Code

The extension reads the same config file. In the status table, `🚫` marks a check that is off and `✅` one that is on:

| Check | Status |
| --- | --- |
| `::` + [`ipv6Only`](https://example.org/ipv6) | 🚫 |

## Horse Race

Horse Race is a gift race. On a phone in landscape, the stage pauses until the phone turns back to portrait. Difficulty runs from Easy to Extremely difficult, and gifts unlock a new skin each round.

| Game        | Camera | Notes |
| ----------- | ------ | ----- |
| Horse Race  | Side   | —     |

Each gift goes through the same pipeline: host message → viewer event → trigger engine → action.

- **Tetris Chat (Tetris 99):** the streamer plays Tetris while gifts send garbage lines.
- **Leave prompt:** "Leave site?" only shows on a standalone window.
