/**
 * Abort execution when the running Node.js version
 * does not satisfy the “>=24” requirement declared in package.json.
 */
export function enforceNodeVersion(requiredMajor = 24): void {
  const major = Number(process.versions.node.split('.')[0]);

  if (Number.isNaN(major) || major < requiredMajor) {
    const msg =
      `Unsupported Node.js version ${process.versions.node}. ` +
      `Please use Node.js ${requiredMajor} or higher.`;
    // eslint-disable-next-line no-console
    console.error(msg);
    throw new Error(msg);
  }
}
