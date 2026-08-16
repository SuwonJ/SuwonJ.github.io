import {
  initiateOAuth,
  handleOAuthCallback,
  fetchAccountInfo,
  logout,
  getStoredToken,
  getStoredClientId,
  setStoredClientId,
  uploadMediaFile,
  postStatus,
  REDIRECT_URI
} from "../components/mastodon_oauth.js";

let selectedCategory = "blog";
let uploadedMediaIds = [];
let autoSaveTimer = null;

async function initAdminStudio() {
  // OAuth 콜백 처리
  const isCallback = await handleOAuthCallback();
  if (isCallback) {
    window.location.href = REDIRECT_URI;
    return;
  }

  // 사용자 정보 및 Auth UI 초기화
  await initAuth();

  // 입력 폼 & 툴바 & 이벤트 리스너 세팅
  setupCategorySelector();
  setupToolbar();
  setupEditorAndPreview();
  setupDragAndDrop();
  setupPublishing();
  setupShortcuts();

  // 이전 임시저장(Draft) 복원
  loadDraft();
}

async function initAuth() {
  const userChipContainer = document.getElementById("user-chip-container");
  const token = getStoredToken();
  const clientId = getStoredClientId();

  if (!token) {
    userChipContainer.innerHTML = `
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button type="button" id="btn-login" class="btn btn-primary" style="padding:0.3rem 0.8rem; font-size:0.8rem;">
          <span class="material-symbols-outlined" style="font-size:16px;">lock_open</span> Login with Mastodon
        </button>
        <button type="button" id="btn-client-key" class="btn" style="padding:0.3rem 0.6rem; font-size:0.75rem; color:var(--text-muted);">
          Key 설정 (${clientId ? "저장됨" : "없음"})
        </button>
      </div>
    `;

    document.getElementById("btn-login").addEventListener("click", () => {
      let key = getStoredClientId();
      if (!key) {
        key = prompt("마스토돈 개발자 페이지 (설정->개발->앱)의 'Client key (클라이언트 키)'를 입력하세요:");
        if (!key || !key.trim()) return;
        setStoredClientId(key.trim());
      }
      initiateOAuth(key.trim());
    });

    document.getElementById("btn-client-key").addEventListener("click", () => {
      const newKey = prompt("마스토돈 개발자 페이지의 'Client key (클라이언트 키)'를 입력하세요:", getStoredClientId() || "");
      if (newKey !== null) {
        setStoredClientId(newKey.trim());
        if (newKey.trim()) showToast("Client Key가 저장되었습니다. Login을 눌러주세요.", "check_circle");
        window.location.reload();
      }
    });

    return;
  }

  const user = await fetchAccountInfo();
  if (user) {
    userChipContainer.innerHTML = `
      <div class="user-chip">
        <img src="${user.avatar}" alt="avatar" />
        <span><strong>@${user.acct}</strong></span>
        <span id="btn-logout" style="cursor:pointer; margin-left:0.4rem; color:var(--accent-red);" title="로그아웃">✕</span>
      </div>
    `;
    document.getElementById("btn-logout").addEventListener("click", logout);
  } else {
    logout();
  }
}

function setupCategorySelector() {
  const opts = document.querySelectorAll(".cat-opt");
  opts.forEach(opt => {
    opt.addEventListener("click", (e) => {
      opts.forEach(o => o.classList.remove("active"));
      e.target.classList.add("active");
      selectedCategory = e.target.getAttribute("data-cat");
      updatePreview();
      triggerAutoSave();
    });
  });
}

function setupToolbar() {
  const toolBtns = document.querySelectorAll(".tool-btn[data-cmd]");
  const textarea = document.getElementById("editor-textarea");

  toolBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const cmd = btn.getAttribute("data-cmd");
      applyFormat(textarea, cmd);
    });
  });
}

function applyFormat(textarea, cmd) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  let replacement = "";
  let cursorOffset = 0;

  switch (cmd) {
    case "bold":
      replacement = `**${selectedText || "bold text"}**`;
      cursorOffset = selectedText ? replacement.length : 2;
      break;
    case "italic":
      replacement = `*${selectedText || "italic text"}*`;
      cursorOffset = selectedText ? replacement.length : 1;
      break;
    case "strike":
      replacement = `~~${selectedText || "strikethrough"}~~`;
      cursorOffset = selectedText ? replacement.length : 2;
      break;
    case "highlight":
      replacement = `==${selectedText || "highlight text"}==`;
      cursorOffset = selectedText ? replacement.length : 2;
      break;
    case "h1":
      replacement = `# ${selectedText || "Heading 1"}\n`;
      cursorOffset = replacement.length;
      break;
    case "h2":
      replacement = `## ${selectedText || "Heading 2"}\n`;
      cursorOffset = replacement.length;
      break;
    case "h3":
      replacement = `### ${selectedText || "Heading 3"}\n`;
      cursorOffset = replacement.length;
      break;
    case "code":
      replacement = `\n\`\`\`python\n${selectedText || "# code here"}\n\`\`\`\n`;
      cursorOffset = replacement.length;
      break;
    case "quote":
      replacement = `\n> ${selectedText || "quote text"}\n`;
      cursorOffset = replacement.length;
      break;
    case "math":
      replacement = `\n$$\n${selectedText || "f(x) = \\int x dx"}\n$$\n`;
      cursorOffset = replacement.length;
      break;
    case "link":
      replacement = `[${selectedText || "link text"}](https://example.com)`;
      cursorOffset = replacement.length;
      break;
  }

  textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
  updatePreview();
  triggerAutoSave();
}

function setupEditorAndPreview() {
  const titleInput = document.getElementById("input-title");
  const tagsInput = document.getElementById("input-tags");
  const textarea = document.getElementById("editor-textarea");

  titleInput.addEventListener("input", () => { updatePreview(); triggerAutoSave(); });
  tagsInput.addEventListener("input", () => { updatePreview(); triggerAutoSave(); });
  textarea.addEventListener("input", () => { updatePreview(); triggerAutoSave(); });

  updatePreview();
}

function updatePreview() {
  const titleVal = document.getElementById("input-title").value.trim();
  const tagsVal = document.getElementById("input-tags").value.trim();
  const markdownVal = document.getElementById("editor-textarea").value;

  const previewTitle = document.getElementById("preview-title");
  const previewTags = document.getElementById("preview-tags");
  const previewBody = document.getElementById("preview-markdown-content");
  const metaInfo = document.getElementById("preview-meta-info");

  previewTitle.innerText = titleVal || "제목 프리뷰...";
  previewTitle.style.color = titleVal ? "var(--text-main)" : "var(--text-muted)";

  if (tagsVal) {
    const tagsArr = tagsVal.split(",").map(t => t.trim()).filter(t => t.length > 0);
    previewTags.innerHTML = tagsArr.map(t => `#${t.replace(/^#/, '')}`).join(" / ");
  } else {
    previewTags.innerHTML = "";
  }

  let text = markdownVal;
  text = text.replace(/==([^=]+)==/g, "<mark>$1</mark>");
  text = text.replace(/([^\n])\s*\$\$/g, "$1\n\n$$$$");
  text = text.replace(/\$\$\s*([^\n])/g, "$$$$\n\n$1");

  if (typeof marked !== "undefined") {
    previewBody.innerHTML = marked.parse(text);
    previewBody.querySelectorAll('pre code').forEach((block) => {
      if (typeof hljs !== 'undefined') hljs.highlightElement(block);
    });
    previewBody.querySelectorAll('table').forEach(table => {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  } else {
    previewBody.innerText = text;
  }

  // 글자 수 및 단어 수 통계
  const charCount = markdownVal.length;
  const wordCount = markdownVal.trim() ? markdownVal.trim().split(/\s+/).length : 0;
  const readTime = Math.ceil(wordCount / 200);
  metaInfo.innerText = `${wordCount} 단어 | ${charCount} 자 | 약 ${readTime}분 읽기`;
}

function setupDragAndDrop() {
  const textarea = document.getElementById("editor-textarea");
  const overlay = document.getElementById("drag-overlay");

  textarea.addEventListener("dragover", (e) => {
    e.preventDefault();
    overlay.classList.add("active");
  });

  textarea.addEventListener("dragleave", (e) => {
    if (e.relatedTarget !== overlay) {
      overlay.classList.remove("active");
    }
  });

  textarea.addEventListener("drop", async (e) => {
    e.preventDefault();
    overlay.classList.remove("active");

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    showToast("파일을 업로드하는 중입니다...", "cloud_upload");

    try {
      for (const file of files) {
        const mediaData = await uploadMediaFile(file);
        uploadedMediaIds.push(mediaData.id);

        const insertText = mediaData.type === 'image' 
          ? `\n![${file.name}](${mediaData.url})\n`
          : `\n[첨부파일: ${file.name}](${mediaData.url})\n`;

        textarea.value += insertText;
      }
      showToast("미디어가 성공적으로 업로드되었습니다!", "check_circle");
      updatePreview();
      triggerAutoSave();
    } catch (err) {
      showToast(`업로드 실패: ${err.message}`, "error");
    }
  });
}

function setupPublishing() {
  const btnPublish = document.getElementById("btn-publish");

  btnPublish.addEventListener("click", async () => {
    const token = getStoredToken();
    if (!token) {
      showToast("로그인이 필요합니다. 상단 Login 버튼을 눌러주세요.", "lock");
      return;
    }

    const titleVal = document.getElementById("input-title").value.trim();
    const tagsVal = document.getElementById("input-tags").value.trim();
    const markdownVal = document.getElementById("editor-textarea").value.trim();

    if (!titleVal) {
      showToast("글 제목을 입력해 주세요.", "warning");
      document.getElementById("input-title").focus();
      return;
    }

    if (!markdownVal) {
      showToast("본문 내용을 입력해 주세요.", "warning");
      document.getElementById("editor-textarea").focus();
      return;
    }

    let formattedTags = `#${selectedCategory}`;
    if (tagsVal) {
      const parsedTags = tagsVal.split(",").map(t => t.trim()).filter(t => t.length > 0);
      formattedTags += " " + parsedTags.map(t => t.startsWith("#") ? t : `#${t}`).join(" ");
    }

    const fullStatusText = `${markdownVal}\n\n${formattedTags}`;

    btnPublish.disabled = true;
    showToast("마스토돈으로 글을 발행하는 중...", "sync");

    try {
      const result = await postStatus({
        statusText: fullStatusText,
        spoilerText: titleVal,
        mediaIds: uploadedMediaIds
      });

      showToast("글이 성공적으로 발행되었습니다!", "task_alt");
      
      // 임시저장 초기화
      clearDraft();

      setTimeout(() => {
        if (confirm("글이 발행되었습니다! 발행된 페이지로 이동하시겠습니까?")) {
          window.location.href = `/${selectedCategory}/?id=${result.id}`;
        }
      }, 500);

    } catch (err) {
      showToast(`발행 실패: ${err.message}`, "error");
    } finally {
      btnPublish.disabled = false;
    }
  });
}

function setupShortcuts() {
  const textarea = document.getElementById("editor-textarea");
  textarea.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        applyFormat(textarea, "bold");
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        applyFormat(textarea, "italic");
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        applyFormat(textarea, "link");
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        saveDraft();
        showToast("임시 수동 저장되었습니다.", "save");
      }
    }
  });
}

function triggerAutoSave() {
  clearTimeout(autoSaveTimer);
  document.getElementById("status-draft").innerText = "저장 중...";
  autoSaveTimer = setTimeout(() => {
    saveDraft();
  }, 1000);
}

function saveDraft() {
  const draftData = {
    category: selectedCategory,
    title: document.getElementById("input-title").value,
    tags: document.getElementById("input-tags").value,
    markdown: document.getElementById("editor-textarea").value,
    updatedAt: new Date().toLocaleTimeString()
  };
  localStorage.setItem("sulog_admin_draft", JSON.stringify(draftData));
  document.getElementById("status-draft").innerText = `자동 저장됨 (${draftData.updatedAt})`;
}

function loadDraft() {
  const saved = localStorage.getItem("sulog_admin_draft");
  if (!saved) return;

  try {
    const draft = JSON.parse(saved);
    if (draft.title || draft.markdown) {
      document.getElementById("input-title").value = draft.title || "";
      document.getElementById("input-tags").value = draft.tags || "";
      document.getElementById("editor-textarea").value = draft.markdown || "";
      
      if (draft.category) {
        selectedCategory = draft.category;
        document.querySelectorAll(".cat-opt").forEach(opt => {
          opt.classList.toggle("active", opt.getAttribute("data-cat") === draft.category);
        });
      }
      updatePreview();
      document.getElementById("status-draft").innerText = `임시 저장 복원됨 (${draft.updatedAt || ''})`;
    }
  } catch (e) {}
}

function clearDraft() {
  localStorage.removeItem("sulog_admin_draft");
  document.getElementById("input-title").value = "";
  document.getElementById("input-tags").value = "";
  document.getElementById("editor-textarea").value = "";
  uploadedMediaIds = [];
  updatePreview();
  document.getElementById("status-draft").innerText = "자동 저장 준비됨";
}

function showToast(message, iconName = "info") {
  const toast = document.getElementById("toast");
  const icon = document.getElementById("toast-icon");
  const msg = document.getElementById("toast-message");

  icon.innerText = iconName;
  msg.innerText = message;

  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

initAdminStudio();
