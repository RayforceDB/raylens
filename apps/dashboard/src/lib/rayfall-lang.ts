import * as monaco from 'monaco-editor';

// Rayfall language definition for Monaco Editor
export const RAYFALL_LANGUAGE_ID = 'rayfall';

// Language configuration
export const rayfallLanguageConfig: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: ';',
  },
  brackets: [
    ['(', ')'],
    ['{', '}'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '(', close: ')' },
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
  ],
};

// Token provider (syntax highlighting)
export const rayfallTokenProvider: monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.rayfall',
  
  brackets: [
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
    { open: '{', close: '}', token: 'delimiter.brace' },
    { open: '[', close: ']', token: 'delimiter.bracket' },
  ],
  
  // Core functions
  keywords: [
    // Data operations
    'select', 'from', 'where', 'by', 'asc', 'desc',
    'take', 'drop', 'first', 'last',
    'count', 'sum', 'avg', 'min', 'max', 'med', 'std', 'var',
    'group', 'ungroup', 'distinct',
    
    // Table operations
    'table', 'key', 'xkey', 'cols', 'meta', 'flip', 'xcol', 'xcols',
    'insert', 'upsert', 'update', 'delete',
    'join', 'lj', 'ij', 'uj', 'aj', 'asof',
    
    // List/Vector operations
    'til', 'enlist', 'raze', 'reverse', 'rotate', 'sort', 'iasc', 'idesc',
    'each', 'peach', 'over', 'scan', 'prior', 'next', 'prev',
    
    // Type operations
    'type', 'null', 'show', 'string', 'value', 'parse', 'eval',
    
    // Control flow
    'if', 'do', 'while', 'cond',
    
    // I/O
    'load', 'save', 'read', 'write', 'get', 'set',
    
    // Time operations
    'date', 'time', 'timestamp', 'now', 'today',
    'year', 'month', 'day', 'hour', 'minute', 'second',
    
    // Aggregations in dict form
    'wavg', 'wsum', 'cor', 'cov', 'dev', 'sdev',
  ],
  
  // Builtin operators
  operators: [
    '+', '-', '*', '/', '%', 
    '=', '==', '!=', '<>', '<', '>', '<=', '>=',
    '&', '|', '!', '^', '~',
    '@', '#', '$', '_', '.', ',', ':', '?',
  ],
  
  // Type symbols
  typeKeywords: [
    'b', 'x', 'h', 'i', 'j', 'e', 'f', 'c', 's', 'p', 'd', 't', 'n', 'u', 'v',
    'B', 'X', 'H', 'I', 'J', 'E', 'F', 'C', 'S', 'P', 'D', 'T', 'N', 'U', 'V',
  ],
  
  // Directive keywords
  directives: [
    '@local', '@remote', '@timeout', '@cache', '@live',
  ],
  
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      // Whitespace
      [/\s+/, 'white'],
      
      // Comments
      [/;.*$/, 'comment'],
      
      // Directives
      [/@(local|remote|timeout|cache|live)(:?\d*)/, 'annotation'],
      
      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      
      // Symbols (quoted)
      [/`[a-zA-Z_][a-zA-Z0-9_]*/, 'variable.name'],
      [/'[a-zA-Z_][a-zA-Z0-9_]*/, 'variable.name'],
      
      // Numbers
      [/-?\d+\.?\d*([eE][+-]?\d+)?[ijefhpt]?/, 'number'],
      [/0x[0-9a-fA-F]+/, 'number.hex'],
      [/0b[01]+/, 'number.binary'],
      
      // Date/Time literals
      [/\d{4}\.\d{2}\.\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?)?/, 'number.date'],
      [/\d{2}:\d{2}(:\d{2}(\.\d+)?)?/, 'number.time'],
      
      // Null/infinity
      [/0[Nn]/, 'constant.null'],
      [/0[Ww]/, 'constant.infinity'],
      
      // Brackets
      [/[(){}[\]]/, '@brackets'],
      
      // Operators
      [/[+\-*\/%=<>!&|^~@#$_.,?]+/, 'operator'],
      [/:/, 'operator.colon'],
      
      // Keywords and identifiers
      [/[a-zA-Z_][a-zA-Z0-9_]*/, {
        cases: {
          '@keywords': 'keyword',
          '@typeKeywords': 'type',
          '@default': 'identifier',
        },
      }],
    ],
    
    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],
  },
};

// Rayfall completions with descriptions
export interface RayfallCompletion {
  label: string;
  kind: monaco.languages.CompletionItemKind;
  insertText: string;
  documentation: string;
  detail?: string;
}

export const rayfallCompletions: RayfallCompletion[] = [
  // Query operations
  {
    label: 'select',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(select {from: ${1:table}})',
    documentation: 'Select columns from a table. Use `by:` for grouping, `where:` for filtering.',
    detail: '(select {from: tbl by: col where: (cond)})',
  },
  {
    label: 'count',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(count ${1:x})',
    documentation: 'Count elements in a vector or rows in a table.',
    detail: '(count x) → integer',
  },
  {
    label: 'sum',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(sum ${1:x})',
    documentation: 'Sum all elements in a numeric vector.',
    detail: '(sum x) → number',
  },
  {
    label: 'avg',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(avg ${1:x})',
    documentation: 'Calculate arithmetic mean of a numeric vector.',
    detail: '(avg x) → float',
  },
  {
    label: 'min',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(min ${1:x})',
    documentation: 'Find minimum value in a vector.',
    detail: '(min x) → atom',
  },
  {
    label: 'max',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(max ${1:x})',
    documentation: 'Find maximum value in a vector.',
    detail: '(max x) → atom',
  },
  {
    label: 'take',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(take ${1:table} ${2:n})',
    documentation: 'Take first n elements. Negative n takes from end.',
    detail: '(take x n) → list',
  },
  {
    label: 'drop',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(drop ${1:table} ${2:n})',
    documentation: 'Drop first n elements. Negative n drops from end.',
    detail: '(drop x n) → list',
  },
  {
    label: 'first',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(first ${1:x})',
    documentation: 'Get first element of a vector.',
    detail: '(first x) → atom',
  },
  {
    label: 'last',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(last ${1:x})',
    documentation: 'Get last element of a vector.',
    detail: '(last x) → atom',
  },
  
  // Table operations
  {
    label: 'table',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(table {${1:col1}: ${2:vals1}})',
    documentation: 'Create a table from column dictionary.',
    detail: '(table {col1: v1 col2: v2}) → table',
  },
  {
    label: 'key',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(key ${1:table})',
    documentation: 'Get keys of a table/dict, or set keyed columns.',
    detail: '(key x) → list/table',
  },
  {
    label: 'cols',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(cols ${1:table})',
    documentation: 'Get column names of a table.',
    detail: '(cols table) → symbol vector',
  },
  {
    label: 'meta',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(meta ${1:table})',
    documentation: 'Get metadata (column names, types, attributes) of a table.',
    detail: '(meta table) → table',
  },
  {
    label: 'flip',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(flip ${1:dict})',
    documentation: 'Convert dict to table or transpose.',
    detail: '(flip dict) → table',
  },
  
  // Join operations
  {
    label: 'lj',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(lj ${1:left} ${2:right})',
    documentation: 'Left join two tables. Keeps all left rows.',
    detail: '(lj left right) → table',
  },
  {
    label: 'ij',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(ij ${1:left} ${2:right})',
    documentation: 'Inner join two tables. Only matching rows.',
    detail: '(ij left right) → table',
  },
  {
    label: 'aj',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(aj ${1:cols} ${2:left} ${3:right})',
    documentation: 'As-of join. Temporal join for time-series data.',
    detail: '(aj `time`sym left right) → table',
  },
  
  // List operations
  {
    label: 'til',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(til ${1:n})',
    documentation: 'Generate integers 0 to n-1.',
    detail: '(til n) → integer vector',
  },
  {
    label: 'enlist',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(enlist ${1:x})',
    documentation: 'Wrap atom in single-element list.',
    detail: '(enlist x) → list',
  },
  {
    label: 'raze',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(raze ${1:x})',
    documentation: 'Flatten nested list one level.',
    detail: '(raze x) → list',
  },
  {
    label: 'reverse',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(reverse ${1:x})',
    documentation: 'Reverse order of elements.',
    detail: '(reverse x) → list',
  },
  {
    label: 'sort',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(sort ${1:x})',
    documentation: 'Sort in ascending order.',
    detail: '(sort x) → list',
  },
  {
    label: 'distinct',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(distinct ${1:x})',
    documentation: 'Remove duplicate elements.',
    detail: '(distinct x) → list',
  },
  
  // Higher-order functions
  {
    label: 'each',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(each ${1:fn} ${2:list})',
    documentation: 'Apply function to each element.',
    detail: '(each fn list) → list',
  },
  {
    label: 'over',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(over ${1:fn} ${2:list})',
    documentation: 'Reduce/fold list with function.',
    detail: '(over fn list) → atom',
  },
  {
    label: 'scan',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(scan ${1:fn} ${2:list})',
    documentation: 'Scan/cumulative reduce with function.',
    detail: '(scan fn list) → list',
  },
  
  // Type operations
  {
    label: 'type',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(type ${1:x})',
    documentation: 'Get type code of value.',
    detail: '(type x) → short',
  },
  {
    label: 'string',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(string ${1:x})',
    documentation: 'Convert to string representation.',
    detail: '(string x) → char vector',
  },
  {
    label: 'value',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: '(value ${1:x})',
    documentation: 'Get values of dict/table, or evaluate string.',
    detail: '(value x) → varied',
  },
  
  // Arithmetic
  {
    label: '+',
    kind: monaco.languages.CompletionItemKind.Operator,
    insertText: '(+ ${1:x} ${2:y})',
    documentation: 'Add two values. Works element-wise on vectors.',
    detail: '(+ x y) → number',
  },
  {
    label: '-',
    kind: monaco.languages.CompletionItemKind.Operator,
    insertText: '(- ${1:x} ${2:y})',
    documentation: 'Subtract y from x. Works element-wise.',
    detail: '(- x y) → number',
  },
  {
    label: '*',
    kind: monaco.languages.CompletionItemKind.Operator,
    insertText: '(* ${1:x} ${2:y})',
    documentation: 'Multiply two values. Works element-wise.',
    detail: '(* x y) → number',
  },
  {
    label: '/',
    kind: monaco.languages.CompletionItemKind.Operator,
    insertText: '(/ ${1:x} ${2:y})',
    documentation: 'Divide x by y. Works element-wise.',
    detail: '(/ x y) → float',
  },
  {
    label: '%',
    kind: monaco.languages.CompletionItemKind.Operator,
    insertText: '(% ${1:x} ${2:y})',
    documentation: 'Modulo (remainder). Works element-wise.',
    detail: '(% x y) → number',
  },
  
  // Comparison
  {
    label: '=',
    kind: monaco.languages.CompletionItemKind.Operator,
    insertText: '(= ${1:x} ${2:y})',
    documentation: 'Equality check. Returns boolean.',
    detail: '(= x y) → boolean',
  },
  {
    label: '<',
    kind: monaco.languages.CompletionItemKind.Operator,
    insertText: '(< ${1:x} ${2:y})',
    documentation: 'Less than comparison.',
    detail: '(< x y) → boolean',
  },
  {
    label: '>',
    kind: monaco.languages.CompletionItemKind.Operator,
    insertText: '(> ${1:x} ${2:y})',
    documentation: 'Greater than comparison.',
    detail: '(> x y) → boolean',
  },
  
  // Directives
  {
    label: '@local',
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: '@local ',
    documentation: 'Force query to execute locally in WASM.',
    detail: 'Directive',
  },
  {
    label: '@remote',
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: '@remote ',
    documentation: 'Force query to execute on remote server.',
    detail: 'Directive',
  },
  {
    label: '@timeout',
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: '@timeout:${1:5000} ',
    documentation: 'Set query timeout in milliseconds.',
    detail: 'Directive',
  },
  
  // Table names (these would come from server in real app)
  {
    label: 'trades',
    kind: monaco.languages.CompletionItemKind.Variable,
    insertText: 'trades',
    documentation: 'Trades table with trade execution data.',
    detail: 'Table',
  },
  {
    label: 'quotes',
    kind: monaco.languages.CompletionItemKind.Variable,
    insertText: 'quotes',
    documentation: 'Quotes table with bid/ask data.',
    detail: 'Table',
  },
];

// Register Rayfall language with Monaco
export function registerRayfallLanguage(monacoInstance: typeof monaco) {
  // Register the language
  monacoInstance.languages.register({ id: RAYFALL_LANGUAGE_ID });
  
  // Set language configuration
  monacoInstance.languages.setLanguageConfiguration(RAYFALL_LANGUAGE_ID, rayfallLanguageConfig);
  
  // Set token provider (syntax highlighting)
  monacoInstance.languages.setMonarchTokensProvider(RAYFALL_LANGUAGE_ID, rayfallTokenProvider);
  
  // Register completion provider
  monacoInstance.languages.registerCompletionItemProvider(RAYFALL_LANGUAGE_ID, {
    triggerCharacters: ['(', ' ', '@'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      
      const suggestions: monaco.languages.CompletionItem[] = rayfallCompletions.map((item) => ({
        label: item.label,
        kind: item.kind,
        insertText: item.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: {
          value: `**${item.detail || ''}**\n\n${item.documentation}`,
        },
        range,
      }));
      
      return { suggestions };
    },
  });
  
  // Register hover provider
  monacoInstance.languages.registerHoverProvider(RAYFALL_LANGUAGE_ID, {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      
      const completion = rayfallCompletions.find(c => c.label === word.word);
      if (!completion) return null;
      
      return {
        contents: [
          { value: `**${completion.label}** — ${completion.detail || ''}` },
          { value: completion.documentation },
          { value: `\`\`\`rayfall\n${completion.insertText.replace(/\$\{\d+:?([^}]*)\}/g, '$1')}\n\`\`\`` },
        ],
      };
    },
  });
  
  // Define custom theme colors for Rayfall
  monacoInstance.editor.defineTheme('rayfall-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'c586c0' },
      { token: 'operator', foreground: 'd4d4d4' },
      { token: 'operator.colon', foreground: 'dcdcaa' },
      { token: 'variable.name', foreground: '9cdcfe' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'number.date', foreground: 'b5cea8' },
      { token: 'number.time', foreground: 'b5cea8' },
      { token: 'comment', foreground: '6a9955' },
      { token: 'annotation', foreground: 'dcdcaa', fontStyle: 'italic' },
      { token: 'type', foreground: '4ec9b0' },
      { token: 'identifier', foreground: '9cdcfe' },
      { token: 'constant.null', foreground: '569cd6' },
      { token: 'constant.infinity', foreground: '569cd6' },
      { token: 'delimiter.parenthesis', foreground: 'ffd700' },
      { token: 'delimiter.brace', foreground: 'da70d6' },
      { token: 'delimiter.bracket', foreground: '179fff' },
    ],
    colors: {
      'editor.background': '#0f0f14',
      'editor.foreground': '#e8e8ec',
      'editorLineNumber.foreground': '#585868',
      'editorLineNumber.activeForeground': '#9898a8',
      'editor.selectionBackground': '#3b82f633',
      'editor.lineHighlightBackground': '#1a1a2411',
      'editorCursor.foreground': '#3b82f6',
      'editorBracketMatch.background': '#3b82f633',
      'editorBracketMatch.border': '#3b82f6',
    },
  });
}
