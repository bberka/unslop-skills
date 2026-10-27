// unslop-ignore-file
// Lexical C# tells for scan.mjs. Ids match ../TELLS.md.
// Test projects are excluded: unslop-tests owns them.
const files = /\.cs$/i;
const exclude = /(?:^|\/)tests?\/|(?:^|\/)[\w.]*Tests?(?:\.[\w.]+)?\/|Tests?\.cs$|(?:^|\/)(?:obj|bin|Migrations)\/|\.(?:g|g\.i|[Dd]esigner|[Gg]enerated)\.cs$|AssemblyInfo\.cs$/;

export default [
  { id: "cs-5", title: "Junk-drawer class", files, exclude,
    pattern: /\b(?:class|interface)\s+I?\w*(?:Manager|Helpers?|Utils?|Utility|Utilities|Processor)\b/ },
  { id: "cs-7", title: "Commented-out code", files, exclude,
    multiline: /(?:^[ \t]*\/\/(?!\/)[ \t]*(?:var |return\b|if ?\(|for(?:each)? ?\(|while ?\(|await |using |public |private |new |\}|[\w.]+\(.*\);\s*$|[\w.]+\s*=\s*.+;\s*$)[^\n]*\n){2,}/m },
  { id: "cs-8", title: "Blocking on async", files, exclude,
    pattern: /\.Result\b(?!\s*=)|\.Wait\(\)|\.GetAwaiter\(\)\.GetResult\(\)/ },
  { id: "cs-9", title: "async void", files, exclude, pattern: /\basync\s+void\s+\w+\s*\(/,
    filter: (_m, line) => !/EventArgs|\bsender\b/.test(line) },
  { id: "cs-9", title: "Task.Run around async work", files, exclude, pattern: /Task\.Run\(\s*async\b/ },
  { id: "cs-9", title: "ConfigureAwait(false)", files, exclude, pattern: /\.ConfigureAwait\(false\)/ },
  { id: "cs-10", title: "throw ex resets the stack", files, exclude, pattern: /\bthrow\s+(?:ex|e|exception|err)\s*;/ },
  { id: "cs-10", title: "Empty or swallowing catch", files, exclude,
    multiline: /catch(?:\s*\([^)]*\))?\s*\{\s*(?:return(?:\s+(?:null|false|default|0|string\.Empty|""))?\s*;\s*)?\}/ },
  { id: "cs-10", title: "Log-and-rethrow", files, exclude,
    multiline: /catch\s*\(\s*Exception\s+\w+\s*\)\s*\{\s*_?\w*[Ll]ogger\??\.Log\w*\([^;]*\);\s*throw\s*;\s*\}/ },
  { id: "cs-11", title: "Null-forgiving operator", files, exclude, pattern: /\bnull!|[\w)\]]!(?=[.;),\]])/ },
  { id: "cs-12", title: "LINQ detour", files, exclude,
    pattern: /\.Count\(\)\s*(?:>\s*0|!=\s*0|>=\s*1)|\.Where\([^()]*(?:\([^()]*\)[^()]*)*\)\.(?:First|FirstOrDefault|Single|SingleOrDefault|Any|Count|Last|LastOrDefault)\(\)|\.ToList\(\)\.(?:ForEach|Where|Select|Any|First|FirstOrDefault|Count)\(/ },
  { id: "cs-13", title: "string.Format", files, exclude, pattern: /\b[Ss]tring\.Format\(/ },
  { id: "cs-14", title: "Magic string key", files, exclude,
    pattern: /(?:Configuration|_?config(?:uration)?)\s*\[\s*"[^"]+"\s*\]|GetSection\(\s*"[^"]+"\s*\)|FindFirst(?:Value)?\(\s*"[^"]+"\s*\)/ },
  { id: "cs-15", title: "HttpClient per call", files, exclude, pattern: /new\s+HttpClient\s*\(/ },
  { id: "cs-15", title: "GC.Collect", files, exclude, pattern: /\bGC\.Collect\(/ },
  { id: "cs-16", title: "Restating XML doc", files, exclude,
    multiline: /\/\/\/\s*<summary>\s*\n\s*\/\/\/\s*(?:Gets|Sets|Gets or sets|Initializes a new instance of|Constructor for|The|Returns)\b[^\n]{0,60}\n\s*\/\/\/\s*<\/summary>/ },
  { id: "cs-16", title: "Restating param doc", files, exclude,
    pattern: /<param name="(\w+)">\s*(?:The|A|An)\s+\1\.?\s*<\/param>/i },
  { id: "cs-17", title: "Region or banner", files, exclude, pattern: /^\s*#(?:end)?region\b|^\s*\/\/\s*[=\-*#]{4,}/ },
  { id: "cs-18", title: "Interpolated log template", files, exclude, pattern: /\.Log(?:Trace|Debug|Information|Warning|Error|Critical)\(\s*(?:\w+\s*,\s*)?\$"/ },
  { id: "cs-18", title: "Trace log noise", files, exclude,
    pattern: /\.Log\w*\(\s*\$?"(?:Entering|Exiting|Entered|Exited|Start(?:ing|ed)?|End(?:ing|ed)?|Begin(?:ning)?|Inside)\b/i },
  { id: "cs-19", title: "Debug residue", files, exclude, pattern: /\bConsole\.Write(?:Line)?\(|\bDebug\.Write(?:Line)?\(/,
    filter: (_m, _line, path) => !/(?:^|\/)Program\.cs$/.test(path) },
  { id: "cs-19", title: "Not implemented", files, exclude, pattern: /throw\s+new\s+NotImplementedException\(/ },
  { id: "cs-19", title: "TODO without issue", files, exclude,
    pattern: /\/\/\s*(?:TODO|FIXME|XXX|HACK)\b(?!.*(?:#\d+|https?:\/\/|\b[A-Z][A-Z0-9]+-\d+))/ },
];
