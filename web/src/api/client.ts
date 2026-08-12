const API_KEY = localStorage.getItem("api_key") || "change-me";

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { ...opts.headers, Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ detail: res.statusText }))).detail || res.statusText);
  return res.json();
}

export const api = {
  listClips: (params: Record<string, string> = {}) =>
    req(`/v1/clips?${new URLSearchParams(params)}`),
  getResult: (id: string) => req(`/v1/clips/${id}/result`),
  uploadClip: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req("/v1/clips", { method: "POST", body: fd });
  },
  deleteClip: (id: string) => req(`/v1/clips/${id}`, { method: "DELETE" }),
  reprocess: (id: string) => req(`/v1/clips/${id}/reprocess`, { method: "POST" }),
  assignSpeaker: (clipId: string, label: string, body: object) =>
    req(`/v1/clips/${clipId}/speakers/${label}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  listSpeakers: () => req("/v1/speakers"),
  getSpeaker: (id: string) => req(`/v1/speakers/${id}`),
  listClusters: () => req("/v1/clusters"),
  promoteCluster: (id: string, display_name: string) =>
    req(`/v1/clusters/${id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name }),
    }),
  search: (q: string, mode = "hybrid") =>
    req("/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, mode }),
    }),
  stats: () => req("/v1/admin/stats"),
  getSettings: () => req("/v1/admin/settings"),
  patchSettings: (values: Record<string, boolean | number | string>) =>
    req("/v1/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }),
  resetSetting: (key: string) => req(`/v1/admin/settings/${key}`, { method: "DELETE" }),
  listModels: () => req("/v1/admin/models"),
  pullModel: (category: string, repo_id: string) =>
    req("/v1/admin/models/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, repo_id }),
    }),
  activateModel: (category: string, repo_id: string) =>
    req("/v1/admin/models/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, repo_id }),
    }),
};
