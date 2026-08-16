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

async function generateCodeChallenge(codeVerifier) {
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

export async function initiateOAuth(clientId) {
  if (!clientId) throw new Error("Client Key가 필요합니다.");
  setStoredClientId(clientId);
  
  const verifier = generateRandomString(64);
  localStorage.setItem("pkce_code_verifier", verifier);
  const challenge = await generateCodeChallenge(verifier);

  const authUrl = new URL(`${INSTANCE_URL}/oauth/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId.trim());
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  window.location.href = authUrl.toString();
}

export async function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  if (!code) return false;

  const clientId = getStoredClientId();
  const verifier = localStorage.getItem("pkce_code_verifier");
  if (!clientId || !verifier) return false;

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", clientId);
  body.set("code", code);
  body.set("redirect_uri", REDIRECT_URI);
  body.set("code_verifier", verifier);
  body.set("scope", SCOPES);

  const res = await fetch(`${INSTANCE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error("Token exchange failed", await res.text());
    alert("OAuth 인증 실패: Redirect URI 또는 Client Key를 확인해 보세요.");
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
