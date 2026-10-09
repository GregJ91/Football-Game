import { describe, expect, it } from 'vitest';
import { versionFor } from '../src/version';

describe('version numbers', () => {
  it('go up by 0.01 with every update', () => {
    expect(versionFor(45)).toBe('1.00');
    expect(versionFor(46)).toBe('1.01');
    expect(versionFor(54)).toBe('1.09');
    expect(versionFor(55)).toBe('1.10');
    expect(versionFor(144)).toBe('1.99');
    expect(versionFor(145)).toBe('2.00');
  });
});
