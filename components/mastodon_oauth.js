const INSTANCE_URL = "https://maximux.suwonmars.com";

// 현재 접속 중인 주소에 완벽히 맞춘 Redirect URI (트레일링 슬래시 보장)
export const REDIRECT_URI = window.location.origin + (window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/');
const SCOPES = "read write";

function generateRandomString(length) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  const values = new Uint8Array(length);
  window.crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

function supportsPkceS256() {
  return Boolean(window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === "function");
}

async function generateCodeChallenge(codeVerifier) {
  if (!supportsPkceS256()) {
    throw new Error("PKCE S256 is not available in this browser context");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function getStoredToken() {
  return localStorage.getItem("mastodon_access_token");
}

export function getStoredClientId() {
  return localStorage.getItem("mastodon_client_id");
}

export function setStoredClientId(clientId) {
  if (clientId) {
    localStorage.setItem("mastodon_client_id", clientId.trim());
  } else {
    localStorage.removeItem("mastodon_client_id");
  }
}

export function logout() {
  localStorage.removeItem("mastodon_access_token");
  localStorage.removeItem("pkce_code_verifier");
  window.location.href = REDIRECT_URI;
}

export async function getOrRegisterApp() {
  let clientId = getStoredClientId();
  if (clientId) return clientId;

  const body = new URLSearchParams();
  body.set("client_name", "Sulog Studio");
  body.set("redirect_uris", REDIRECT_URI);
  body.set("scopes", SCOPES);
  body.set("website", window.location.origin);

  const res = await fetch(`${INSTANCE_URL}/api/v1/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`앱 자동 등록 실패: ${errText}`);
  }

  const appData = await res.json();
  setStoredClientId(appData.client_id);
  if (appData.client_secret) {
    localStorage.setItem("mastodon_client_secret", appData.client_secret);
  }
  return appData.client_id;
}

export async function initiateOAuth(clientId) {
  if (!clientId) {
    clientId = await getOrRegisterApp();
  }

  // PKCE를 쓸 수 없는 환경에서는 Mastodon의 client_secret 방식으로 fallback한다.
  // 예전에 client_id만 남고 secret이 사라진 경우에는 앱을 다시 등록해 secret을 확보한다.
  if (!supportsPkceS256() && !localStorage.getItem("mastodon_client_secret")) {
    localStorage.removeItem("mastodon_client_id");
    clientId = await getOrRegisterApp();
  }

  setStoredClientId(clientId);
  localStorage.removeItem("pkce_code_verifier");

  const authUrl = new URL(`${INSTANCE_URL}/oauth/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId.trim());
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);

  if (supportsPkceS256()) {
    const verifier = generateRandomString(64);
    localStorage.setItem("pkce_code_verifier", verifier);
    const challenge = await generateCodeChallenge(verifier);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  } else {
    console.warn("Web Crypto subtle API unavailable; continuing OAuth without PKCE S256.");
  }

  window.location.href = authUrl.toString();
}

export async function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  if (!code) return false;

  const clientId = getStoredClientId();
  if (!clientId) return false;

  const verifier = localStorage.getItem("pkce_code_verifier");
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", clientId);

  const clientSecret = localStorage.getItem("mastodon_client_secret");
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  body.set("code", code);
  body.set("redirect_uri", REDIRECT_URI);
  if (verifier) {
    body.set("code_verifier", verifier);
  }
  body.set("scope", SCOPES);

  const res = await fetch(`${INSTANCE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error("Token exchange failed", await res.text());
    alert("OAuth 인증 실패: 인증 정보를 확인해 주세요.");
    return false;
  }

  const data = await res.json();
  localStorage.setItem("mastodon_access_token", data.access_token);
  localStorage.removeItem("pkce_code_verifier");

  window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}

export async function fetchAccountInfo() {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch(`${INSTANCE_URL}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function uploadMediaFile(file) {
  const token = getStoredToken();
  if (!token) throw new Error("로그인이 필요합니다.");

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${INSTANCE_URL}/api/v1/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Media upload failed: ${errText}`);
  }

  return await res.json();
}

export async function postStatus({ statusText, spoilerText, mediaIds = [] }) {
  const token = getStoredToken();
  if (!token) throw new Error("로그인이 필요합니다.");

  const body = new URLSearchParams();
  body.set("status", statusText);
  if (spoilerText) body.set("spoiler_text", spoilerText);
  if (mediaIds.length > 0) {
    mediaIds.forEach(id => body.append("media_ids[]", id));
  }

  const res = await fetch(`${INSTANCE_URL}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Post creation failed: ${errText}`);
  }

  return await res.json();
}

export async function updateStatus({ id, statusText, spoilerText, mediaIds = [] }) {
  const token = getStoredToken();
  if (!token) throw new Error("로그인이 필요합니다.");

  const body = new URLSearchParams();
  body.set("status", statusText);
  if (spoilerText !== undefined) body.set("spoiler_text", spoilerText);
  if (mediaIds && mediaIds.length > 0) {
    mediaIds.forEach(mediaId => body.append("media_ids[]", mediaId));
  }

  const res = await fetch(`${INSTANCE_URL}/api/v1/statuses/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Post update failed: ${errText}`);
  }

  return await res.json();
}

export async function deleteStatus(id) {
  const token = getStoredToken();
  if (!token) throw new Error("로그인이 필요합니다.");

  const res = await fetch(`${INSTANCE_URL}/api/v1/statuses/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Post deletion failed: ${errText}`);
  }

  return await res.json();
}

export async function fetchMyStatuses({ limit = 40, maxId = null } = {}) {
  const token = getStoredToken();
  if (!token) throw new Error("로그인이 필요합니다.");

  const user = await fetchAccountInfo();
  if (!user || !user.id) throw new Error("사용자 정보를 불러올 수 없습니다.");

  let url = `${INSTANCE_URL}/api/v1/accounts/${user.id}/statuses?exclude_reblogs=true&exclude_replies=true&limit=${limit}`;
  if (maxId) {
    url += `&max_id=${maxId}`;
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch statuses: ${errText}`);
  }

  return await res.json();
}
