const GITHUB_REPO_URL = "https://github.com/byrdocs/byrdocs-wiki-internal";
const GITHUB_DEFAULT_BRANCH = "master";

const encodeGitHubPath = (path: string) =>
  path
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const getGitHubEditUrl = (path: string) =>
  `${GITHUB_REPO_URL}/edit/${GITHUB_DEFAULT_BRANCH}/${encodeGitHubPath(path)}`;
