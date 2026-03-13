// Mock for bun:test module used by vitest
// Vitest can't bundle bun:test, so this provides no-op exports
// so that test files importing from "bun:test" don't fail under vitest

export function test() {}
export function describe() {}
export function it() {}
export function expect() {}
export function beforeEach() {}
export function afterEach() {}
export function vi() {}
