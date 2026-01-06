/**
 * Type declarations for Rayforce WASM SDK
 */

declare module '/rayforce.js' {
  interface EmscriptenModule {
    HEAPU8: Uint8Array;
    _malloc(size: number): number;
    _free(ptr: number): void;
    cwrap(name: string, returnType: string | null, argTypes: string[]): (...args: unknown[]) => unknown;
    ccall(name: string, returnType: string | null, argTypes: string[], args: unknown[]): unknown;
    getValue(ptr: number, type: string): number;
    setValue(ptr: number, value: number, type: string): void;
    stackSave(): number;
    stackAlloc(size: number): number;
    stackRestore(ptr: number): void;
  }

  function createRayforce(): Promise<EmscriptenModule>;
  export default createRayforce;
}

declare module '/rayforce.sdk.js' {
  export interface RayObject {
    readonly ptr: number;
    readonly type: number;
    readonly absType: number;
    readonly isAtom: boolean;
    readonly isVector: boolean;
    readonly isNull: boolean;
    readonly isError: boolean;
    readonly length: number;
    readonly refCount: number;
    clone(): RayObject;
    toString(): string;
    toJS(): unknown;
    drop(): void;
    release(): number;
  }

  export interface Vector extends RayObject {
    readonly elementType: number;
    readonly typedArray: ArrayBufferView;
    at(idx: number, raw?: boolean): unknown;
    set(idx: number, value: unknown): void;
  }

  export interface Table extends RayObject {
    columns(): Vector;
    columnNames(): string[];
    values(): List;
    col(name: string): Vector;
    row(idx: number): Dict;
    readonly rowCount: number;
    select(...cols: string[]): SelectQuery;
    where(condition: Expr): SelectQuery;
    insert(data: object | unknown[]): Table;
    toJS(): Record<string, unknown[]>;
    toRows(): Record<string, unknown>[];
  }

  export interface List extends RayObject {
    at(idx: number): RayObject;
    set(idx: number, value: unknown): void;
    push(value: unknown): void;
  }

  export interface Dict extends RayObject {
    keys(): Vector;
    values(): List;
    get(key: string): RayObject;
    has(key: string): boolean;
  }

  export interface Expr {
    eq(value: unknown): Expr;
    ne(value: unknown): Expr;
    lt(value: unknown): Expr;
    le(value: unknown): Expr;
    gt(value: unknown): Expr;
    ge(value: unknown): Expr;
    and(other: Expr): Expr;
    or(other: Expr): Expr;
    not(): Expr;
    sum(): Expr;
    avg(): Expr;
    min(): Expr;
    max(): Expr;
    count(): Expr;
    first(): Expr;
    last(): Expr;
    distinct(): Expr;
    toString(): string;
  }

  export interface SelectQuery {
    select(...cols: string[]): SelectQuery;
    withColumn(name: string, expr: Expr): SelectQuery;
    where(condition: Expr): SelectQuery;
    groupBy(...cols: string[]): SelectQuery;
    col(name: string): Expr;
    execute(): Table;
  }

  export interface RayforceSDK {
    readonly version: string;

    // Evaluation
    eval(code: string, sourceName?: string): RayObject;
    format(obj: RayObject | number): string;

    // Constructors
    b8(value: boolean): RayObject;
    u8(value: number): RayObject;
    c8(value: string): RayObject;
    i16(value: number): RayObject;
    i32(value: number): RayObject;
    i64(value: number | bigint): RayObject;
    f64(value: number): RayObject;
    date(value: number | Date): RayObject;
    time(value: number | Date): RayObject;
    timestamp(value: number | bigint | Date): RayObject;
    symbol(value: string): RayObject;
    string(value: string): RayObject;
    vector(type: number, lengthOrData: number | unknown[]): Vector;
    list(items?: unknown[]): List;
    dict(obj: object): Dict;
    table(columns: Record<string, unknown[]>): Table;

    // Utilities
    set(name: string, value: unknown): void;
    get(name: string): RayObject;
    typeName(typeCode: number): string;
    read_csv(content: string): Table;

    // Internal
    _deserialize(bufferPtr: number): number;
    _wrapPtr(ptr: number): RayObject;
    _evalRaw(code: string): number;
    _dropObj(ptr: number): void;
    _strOfObj(ptr: number): string;
    _wasm: import('/rayforce.js').EmscriptenModule;
  }

  export const Types: {
    readonly LIST: 0;
    readonly B8: 1;
    readonly U8: 2;
    readonly I16: 3;
    readonly I32: 4;
    readonly I64: 5;
    readonly SYMBOL: 6;
    readonly DATE: 7;
    readonly TIME: 8;
    readonly TIMESTAMP: 9;
    readonly F64: 10;
    readonly GUID: 11;
    readonly C8: 12;
    readonly TABLE: 98;
    readonly DICT: 99;
    readonly LAMBDA: 100;
    readonly NULL: 126;
    readonly ERR: 127;
  };

  export function createRayforceSDK(wasmModule: import('/rayforce.js').EmscriptenModule): RayforceSDK;
}
