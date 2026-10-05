/**
 * Own-property test for plain-object maps indexed with user/external text: `MAP[x]` and `x in MAP`
 * also see inherited members ("constructor", "__proto__", "toString"), this does not.
 * (Object.hasOwn needs lib es2022; the web tsconfig targets an older lib.)
 */
export function hasOwnKey(target: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}
