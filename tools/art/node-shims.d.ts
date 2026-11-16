/** Minimal Node typings for the art tools (the project does not depend on @types/node). */
declare module 'node:fs' {
  export function existsSync(p: string): boolean;
  export function mkdirSync(p: string, o?: { recursive?: boolean }): void;
  export function rmSync(p: string, o?: { recursive?: boolean; force?: boolean }): void;
  export function writeFileSync(p: string, data: string): void;
}
declare module 'node:path' {
  export function dirname(p: string): string;
  export function join(...p: string[]): string;
  export function resolve(...p: string[]): string;
}
declare module 'node:url' {
  export function fileURLToPath(u: string): string;
  export function pathToFileURL(p: string): { href: string };
}
declare module 'node:module' {
  export function createRequire(from: string): (id: string) => unknown;
}
declare module 'node:child_process' {
  export function execSync(cmd: string): { toString(): string };
}
declare const process: { stdout: { write(s: string): void } };
interface ImportMeta {
  url: string;
}
