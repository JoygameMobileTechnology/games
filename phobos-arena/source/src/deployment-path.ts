/** Deployments use an origin-relative directory, leaving the default LAN app at
 * /. An explicit base also makes cached entry points independent of navigation. */
export function deploymentBasePath(base = "/"): string {
  if (!base.startsWith("/") || base.startsWith("//") || /[?#\\]/.test(base) ||
      base.split("/").some((part) => part === "." || part === ".."))
    throw new Error("Phobos requires an absolute deployment directory, such as / or /games/phobos-arena/.");
  const path = base.endsWith("/") ? base : `${base}/`;
  if (new URL(path, "https://phobos.invalid").pathname !== path || path.includes("//"))
    throw new Error("Phobos deployment directory must be a canonical URL path.");
  return path;
}

export function deploymentAssetPath(base: string, file: string): string {
  if (!file || file.startsWith("/") || /[?#\\]/.test(file) ||
      file.split("/").some((part) => !part || part === "." || part === ".."))
    throw new Error("Offline pack contains an invalid asset path.");
  return deploymentBasePath(base) + file;
}

export function offlineCachePrefix(base: string): string {
  return `phobos-v4-scope-${encodeURIComponent(deploymentBasePath(base))}-`;
}
