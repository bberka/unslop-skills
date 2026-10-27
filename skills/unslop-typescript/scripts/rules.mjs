// unslop-ignore-file
// Lexical TypeScript/JavaScript tells for scan.mjs. Ids match ../TELLS.md.
// Test files are excluded: unslop-tests owns them.
const files = /\.(?:[cm]?tsx?|[cm]?jsx?)$/i;
const tsOnly = /\.[cm]?tsx?$/i;
const exclude = /\.d\.[cm]?ts$|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:__tests__|__mocks__|generated|__generated__)\/|\.min\.js$|\.config\.[cm]?[jt]s$/;

const junkDrawerFile = (_text, path) =>
  /(?:^|\/)(?:utils?|helpers?|common|misc)\.[cm]?[jt]sx?$/.test(path) ? [{ line: 1, match: path.split("/").pop() }] : [];

export default [
  { id: "ts-1", title: "Type escape hatch", files: tsOnly, exclude,
    pattern: /:\s*any\b|\bas any\b|<any>|\bany\[\]|Array<any>|Record<string,\s*any>|\bas unknown as\b/ },
  { id: "ts-2", title: "Silenced check without reason", files, exclude,
    pattern: /@ts-(?:ignore|nocheck)\b|@ts-expect-error\s*(?:\*\/)?\s*$|eslint-disable(?:-next-line|-line)?(?:\s+[\w@/-]+(?:\s*,\s*[\w@/-]+)*)?\s*(?:\*\/)?\s*$/ },
  { id: "ts-3", title: "Non-null assertion", files: tsOnly, exclude, pattern: /[\w\])]!(?=[.[\]),;])/ },
  { id: "ts-4", title: "Redundant annotation", files: tsOnly, exclude,
    pattern: /\b(?:const|let)\s+\w+\s*:\s*(?:string|number|boolean)\s*=\s*(?:["'`\d-]|true\b|false\b)/ },
  { id: "ts-7", title: "Deep optional chain", files, exclude, pattern: /(?:\?\.[\w$]+(?:\([^)]*\))?){3,}/ },
  { id: "ts-9", title: "Catch-and-rethrow", files, exclude,
    multiline: /catch\s*\(\s*(\w+)[^)]*\)\s*\{\s*(?:console\.\w+\([^;]*\);?\s*)?throw\s+\1\s*;?\s*\}/ },
  { id: "ts-9", title: "Swallowed error", files, exclude,
    multiline: /catch\s*(?:\([^)]*\))?\s*\{\s*(?:console\.\w+\([^;]*\);?\s*)?(?:return(?:\s+(?:null|undefined|false|\[\]|\{\}|''|""))?\s*;?\s*)?\}/ },
  { id: "ts-10", title: "Async Promise executor", files, exclude, pattern: /new Promise\s*\(\s*async\b/ },
  { id: "ts-11", title: "Verbose boolean", files, exclude,
    pattern: /[!=]==\s*(?:true|false)\b|\?\s*true\s*:\s*false\b|\?\s*false\s*:\s*true\b|\.filter\((?:[^()]|\([^()]*\))*\)\.length\s*(?:>|!==|!=)\s*0/ },
  { id: "ts-11", title: "if-return-true-else-false", files, exclude,
    multiline: /if\s*\([^)]+\)\s*\{?\s*return\s+(?:true|false);?\s*\}?\s*(?:else\s*\{?\s*)?return\s+(?:true|false);?/ },
  { id: "ts-17", title: "Junk-drawer module", files, exclude, check: junkDrawerFile },
  { id: "ts-17", title: "Junk-drawer class", files, exclude,
    pattern: /\b(?:class|interface)\s+\w*(?:Manager|Helpers?|Utils?|Utility|Processor)\b/ },
  { id: "ts-18", title: "Narrating comment", files, exclude,
    pattern: /^\s*\/\/\s*(?:Imports?|Define|Defining|Create|Creating|Initiali[sz]e|Initiali[sz]ing|Set ?up|Returns?|Returning|Call|Calling|Get|Getting|Check if|Loop (?:through|over)|Iterate (?:through|over)|Handle|Handling|Export|Declare|Update|Updating|Fetch|Fetching|Render|Rendering)\b[^.]{0,40}$/i },
  { id: "ts-18", title: "Section banner", files, exclude, pattern: /^\s*(?:\/\/|\/\*+)\s*[=\-*#]{4,}/ },
  { id: "ts-18", title: "JSDoc restating the signature", files, exclude,
    pattern: /@param\s+(?:\{[^}]*\}\s+)?\[?(\w+)\]?\s*-?\s*(?:The|A|An)\s+\1\b\.?\s*$|@returns?\s+(?:\{[^}]*\}\s+)?(?:The result|Returns? the|the return value)\b/i },
  { id: "ts-19", title: "Commented-out code", files, exclude,
    multiline: /(?:^[ \t]*\/\/[ \t]*(?:const |let |var |if ?\(|for ?\(|while ?\(|return\b|import |export |function |await |class |\}|[\w.]+\(.*\);?\s*$|[\w.]+\s*=\s*.+;\s*$)[^\n]*\n){2,}/m },
  { id: "ts-20", title: "Debug residue", files, exclude, pattern: /\bconsole\.(?:log|debug|trace)\(|^\s*debugger\b/ },
  { id: "ts-20", title: "Demo residue", files, exclude,
    pattern: /\bIn a real (?:app|application|implementation|project|world)|for demonstration purposes|simplified (?:version|example|implementation)|throw new Error\(\s*['"`]Not implemented/i },
  { id: "ts-20", title: "TODO without issue", files, exclude,
    pattern: /\/\/\s*(?:TODO|FIXME|XXX|HACK)\b(?!.*(?:#\d+|https?:\/\/|\b[A-Z][A-Z0-9]+-\d+))/ },
];
