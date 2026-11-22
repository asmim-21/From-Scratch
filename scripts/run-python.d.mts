export const root: string;
export function findPython(): string;
export function runPython(args: string[]): { ok: boolean; output: string };
