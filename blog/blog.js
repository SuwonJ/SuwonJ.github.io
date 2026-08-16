import { renderNavbar } from "/components/navbar.js";
import { HalftoneBackground } from "../components/halftone.js";
import { fetchPostsByTag, fetchPostById, fetchPostComments } from "../components/mastodon.js";

// 순수 텍스트 정규화 (HTML 태그 제거, 공백 및 줄바꿈 통일)
function getCanonicalText(htmlContent, postId) {
  const plainText = (htmlContent || "")
    .replace(/<[^>]*>/g, '') // 모든 HTML 태그 제거
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')  // 줄바꿈 규격 통일
    .trim();                 // 양끝 여백 제거
    
  return plainText + ":" + (postId || "");
}

async function computeSha256(text) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  }
}

// 답글(댓글) 목록에서 작성자가 게시한 sha256 해시값 추출
function extractServerHashFromComments(comments) {
  for (const c of comments) {
    const cleanText = (c.contentHtml || "").replace(/<[^>]*>/g, '');
    const match = cleanText.match(/(?:sha256|hash|sig)\s*:\s*([a-fA-F0-9]{8,64})/i) || cleanText.match(/\b([a-fA-F0-9]{64})\b/);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

async function init() {
  if (typeof window.markedKatex === "function") {
    marked.use(window.markedKatex({ throwOnError: false, nonStandard: true }));
  }

  renderNavbar();
  const blogBg = new HalftoneBackground("halftone-canvas", {
    iconSrc: null,
    boundarySelectors: [".navbar", "hr"],
    buttonSelectors: ["#content pre"]
  });
  window.blogBg = blogBg;
  blogBg.init();

  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get("id");
  const contentArea = document.getElementById("content");

  if (postId) {
    await renderPost(postId, contentArea);
  } else {
    await renderPostList(contentArea);
  }

  blogBg.scanTargets();
  setTimeout(() => blogBg.scanTargets(), 300);
}

async function renderPost(id, container) {
  try {
    const post = await fetchPostById(id);
    if (!post) throw new Error("포스트를 찾을 수 없습니다.");

    // 1. 페이지 상단 제목 (순수 제목만 정돈)
    const titleEl = document.getElementById("page-title");
    if (titleEl) {
      titleEl.innerText = post.title;
    }

    // 2. 제목 바로 아래 메타 바 (날짜 • 태그 • 마스토돈로고 · 막시무스로고 maximux 뱃지)
    const dateHtml = post.date ? `<span>${post.date}</span>` : "";
    const tags = post.tags || [];
    const tagHtml = tags.length > 0 
      ? tags.map(t => `<a href="/blog/?tags=${t}" class="tag" style="text-decoration:none;">#${t}</a>`).join(" ")
      : "";

    const maximuxBadgeHtml = `
      <a href="${post.url}" target="_blank" rel="noopener noreferrer" class="maximux-title-badge" title="Maximux (Mastodon Federation) 원본 글 보기 및 댓글 작성" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; font-family: monospace; font-weight: normal; color: var(--text-color, #fff); background: rgba(103, 133, 233, 0.12); border: 1px solid rgba(103, 133, 233, 0.3); padding: 0.15rem 0.55rem; border-radius: 5px; text-decoration: none; vertical-align: middle; transition: all 0.2s;">
        <img src="/assets/mastodon_logo.svg" alt="Mastodon" style="width:13px; height:13px; vertical-align:middle;" />
        <span style="opacity:0.5;">•</span>
        <img src="/assets/maximux_logo.svg" alt="Maximux" style="width:13px; height:13px; vertical-align:middle;" />
        <span>maximux</span>
      </a>
    `;

    const metaBarHtml = `
      <div class="post-meta-bar" style="display:flex; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-top:0.6rem; margin-bottom:1.8rem; font-family:monospace; font-size:0.85rem; color:var(--breadcrumb-color, #888);">
        ${dateHtml}
        ${dateHtml && (tagHtml || maximuxBadgeHtml) ? `<span>•</span>` : ""}
        ${tagHtml}
        ${tagHtml && maximuxBadgeHtml ? `<span>•</span>` : ""}
        ${maximuxBadgeHtml}
      </div>
    `;

    const tagContainer = document.getElementById("tag-container");
    if (tagContainer) tagContainer.innerHTML = metaBarHtml;

    // 마크다운 파싱 및 렌더링
    let markdownText = post.markdown || "";

    markdownText = markdownText.replace(/==([^=]+)==/g, "<mark>$1</mark>");
    markdownText = markdownText.replace(/([^\n])\s*\$\$/g, "$1\n\n$$$$");
    markdownText = markdownText.replace(/\$\$\s*([^\n])/g, "$$$$\n\n$1");

    let parsedHtml = marked.parse(markdownText);

    // 미디어 첨부파일 렌더링 (사진/영상)
    if (post.media && post.media.length > 0) {
      const mediaHtml = `
        <div class="post-media-gallery" style="display:grid; gap:1rem; margin:1.5rem 0;">
          ${post.media.map(m => {
            if (m.type === 'image') {
              return `<img src="${m.url}" alt="${m.description || ''}" style="max-width:100%; border-radius:8px; cursor:zoom-in;" />`;
            } else if (m.type === 'video' || m.type === 'gifv') {
              return `<video src="${m.url}" controls style="max-width:100%; border-radius:8px;"></video>`;
            }
            return '';
          }).join('')}
        </div>
      `;
      parsedHtml += mediaHtml;
    }

    // 실시간 댓글 목록 불러오기
    const comments = await fetchPostComments(id);

    // 통합 댓글 & 검증 툴바 섹션
    const unifiedCommentsSectionHtml = `
      <div class="mastodon-comments-section" style="margin-top: 4rem; padding-top: 1.8rem; border-top: 1px solid var(--toc-border, #333);">
        
        <!-- 미니 툴바 (댓글 수 + '+' 추가 버튼 + ✔ Check 뱃지) -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; font-family:monospace;">
          <div style="display:flex; align-items:center; gap:0.8rem;">
            <span style="font-size:0.9rem; font-weight:bold; color:var(--text-color); display:inline-flex; align-items:center; gap:0.4rem;">
              <span class="material-symbols-outlined" style="font-size:18px;">chat_bubble</span>
              <span>${comments.length}</span>
            </span>
            <a href="${post.url}" target="_blank" rel="noopener noreferrer" title="Maximux에서 댓글 작성 (해시 등록 가능)" style="font-size:0.85rem; color:var(--breadcrumb-color, #aaa); text-decoration:none; display:inline-flex; align-items:center;">
              <span class="material-symbols-outlined" style="font-size:18px;">add</span>
            </a>
          </div>

          <!-- 클릭 시에만 온디맨드로 대조 검증을 수행하는 버튼 -->
          <button type="button" id="btn-toggle-sig" title="클릭하여 댓글 등록 해시 ↔ 본문 순수 텍스트 해시 1:1 대조 검증" style="background:transparent; border:none; color:var(--breadcrumb-color, #888); font-family:monospace; font-size:0.78rem; cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem; padding:0;">
            <span class="material-symbols-outlined" style="font-size:15px; color:#4ade80;">verified</span>
            <span>Check Integrity</span>
          </button>
        </div>

        <!-- 클릭 시 동적으로 대조 렌더링되는 2줄 카드가 들어갈 컨테이너 -->
        <div id="sig-info-card" style="display:none; margin-bottom:1.5rem; padding:0.6rem 0.8rem; background:rgba(0,0,0,0.25); border:1px solid var(--toc-border, #333); border-radius:6px; font-family:monospace; font-size:0.78rem; line-height:1.5; color:var(--breadcrumb-color, #888);">
          <!-- 동적 검증 결과가 렌더링됨 -->
        </div>

        ${comments.length === 0 ? `
          <div style="padding: 1rem 0; font-family: monospace; font-size: 0.85rem; color: var(--breadcrumb-color, #888);">
            아직 작성된 댓글이 없습니다. <a href="${post.url}" target="_blank" rel="noopener noreferrer" style="color:var(--text-color); text-decoration:underline;">+ 첫 댓글 작성하기 (해시 등록 가능) ↗</a>
          </div>
        ` : `
          <div class="comments-list" style="display:flex; flex-direction:column;">
            ${comments.map((c, idx) => {
              const fullAcct = c.account.acct.includes('@') ? `@${c.account.acct}` : `@${c.account.acct}@maximux.suwonmars.com`;
              return `
                <!-- 아바타 정중앙을 관통하는 세로 스레드 연결선 -->
                <div class="thread-connector-line" style="width:2px; height:24px; background:var(--toc-border, #333); margin-left:17px; margin-top:${idx === 0 ? '0.2rem' : '0.6rem'}; margin-bottom:0.6rem;"></div>
                
                <div class="comment-item">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.6rem;">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                      <img src="${c.account.avatar}" alt="${c.account.displayName}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; flex-shrink:0;" />
                      <div style="display:flex; flex-direction:column; line-height:1.3; font-family:monospace;">
                        <a href="${c.account.url}" target="_blank" rel="noopener noreferrer" style="color:var(--text-color); font-weight:bold; text-decoration:none; font-size:0.9rem;">
                          ${c.account.displayName}
                        </a>
                        <span style="color:var(--breadcrumb-color, #888); font-size:0.78rem;">${fullAcct}</span>
                      </div>
                    </div>
                    <span style="color:var(--breadcrumb-color, #888); font-size:0.75rem; font-family:monospace;">${c.createdAt}</span>
                  </div>
                  <div class="comment-body" style="line-height:1.6; color:var(--text-color); font-size:0.92rem; padding-left:2.85rem;">
                    ${c.contentHtml}
                  </div>
                  ${c.media.length > 0 ? `
                    <div style="display:flex; gap:0.5rem; margin-top:0.6rem; padding-left:2.85rem;">
                      ${c.media.map(m => `<img src="${m.url}" alt="" style="max-width:160px; max-height:160px; border-radius:6px;" />`).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    parsedHtml += unifiedCommentsSectionHtml;

    container.innerHTML = parsedHtml;

    // 드롭다운 버튼 클릭 시에만 '온디맨드(On-demand)'로 1:1 대조 검증 수행!
    const btnToggleSig = document.getElementById("btn-toggle-sig");
    const sigInfoCard = document.getElementById("sig-info-card");
    
    if (btnToggleSig && sigInfoCard) {
      btnToggleSig.addEventListener("click", async () => {
        const isHidden = sigInfoCard.style.display === "none";
        
        if (isHidden) {
          sigInfoCard.style.display = "block";
          sigInfoCard.innerHTML = `<span style="color:#aaa;">⌛ 마스토돈 댓글 해시 대조 중...</span>`;

          // 1. 순수 텍스트 정규화 기반 실시간 SHA-256 해시 계산
          const canonicalInput = getCanonicalText(post.content || post.markdown, post.id);
          const computedHash = await computeSha256(canonicalInput);
          
          // 2. 답글(댓글) 재조회 및 작성자가 올린 해시 추출
          const latestComments = await fetchPostComments(id);
          const serverHashInComment = extractServerHashFromComments(latestComments);

          if (serverHashInComment) {
            // 접두사/전체 해시 매칭 검사
            const isMatch = computedHash.toLowerCase().startsWith(serverHashInComment.toLowerCase()) || 
                            serverHashInComment.toLowerCase().startsWith(computedHash.substring(0, 8).toLowerCase());

            const statusText = isMatch 
              ? `<span style="color:#4ade80; font-weight:bold;">MATCHED ✔ (순수 텍스트 무결성 검증 완료)</span>`
              : `<span style="color:#fc5c65; font-weight:bold;">MISMATCH ❌ (위변조 또는 해시 불일치)</span>`;

            sigInfoCard.innerHTML = `
              <div><strong style="color:var(--text-color);">Comment Hash:</strong> <code>${serverHashInComment}</code> (마스토돈 답글 기록)</div>
              <div style="word-break:break-all;"><strong style="color:var(--text-color);">Computed Hash:</strong> <code>${computedHash}</code></div>
              <div style="margin-top:0.4rem; padding-top:0.4rem; border-top:1px dashed var(--toc-border, #333);"><strong style="color:var(--text-color);">Verification:</strong> ${statusText}</div>
            `;
          } else {
            sigInfoCard.innerHTML = `
              <div><strong style="color:var(--text-color);">Computed Hash:</strong> <code style="color:#38bdf8;">${computedHash}</code></div>
              <div style="margin-top:0.4rem; color:var(--breadcrumb-color, #888); font-size:0.75rem;">
                💡 <strong>해시 생성 규격:</strong> 마스토돈 포스트의 순수 텍스트(HTML 태그 제거) + <code>:${post.id}</code><br/>
                마스토돈 답글에 <code>sha256: ${computedHash.substring(0, 8)}</code> 형태로 작성하시면 실시간 대조됩니다.
              </div>
            `;
          }
        } else {
          sigInfoCard.style.display = "none";
        }
      });
    }

    // 테이블 반응형 래핑
    container.querySelectorAll('table').forEach(table => {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    // Highlight.js 적용 및 코드 복사 기능
    container.querySelectorAll('pre code').forEach((block) => {
      const pre = block.parentElement;
      const langMatch = block.className.match(/language-(\w+)/);
      if (langMatch && langMatch[1]) {
        pre.setAttribute('data-lang', langMatch[1].toUpperCase());
      }
      if (typeof hljs !== 'undefined') hljs.highlightElement(block);
    });

    container.querySelectorAll('pre').forEach(pre => {
      pre.addEventListener('click', async () => {
        const selection = window.getSelection().toString();
        if (selection && selection.length > 0) return;
        const codeText = pre.querySelector('code')?.innerText || pre.innerText;
        try {
          await navigator.clipboard.writeText(codeText);
          if (window.blogBg) window.blogBg.pulseButton(pre);
          const originalLang = pre.getAttribute('data-lang') || '';
          pre.setAttribute('data-lang', 'COPIED!');
          pre.classList.add('copied');
          setTimeout(() => {
            pre.setAttribute('data-lang', originalLang);
            pre.classList.remove('copied');
          }, 1500);
        } catch (err) {
          console.error('Failed to copy', err);
        }
      });
    });

    // Breadcrumb TOC 로직
    const headings = container.querySelectorAll("h1, h2, h3");
    headings.forEach((h, i) => {
      if (!h.id) h.id = "heading-" + i;
    });

    const breadcrumb = document.getElementById("nav-breadcrumb");
    if (breadcrumb) {
      let breadcrumbHtml = `
        <a href="/blog/">
          <span class="desktop-text">블로그</span>
          <span class="mobile-text">블</span>
        </a> 
        <span style="margin:0 0.3rem">/</span> 
        <a href="#" id="bc-title">
          <span class="desktop-text">${post.title || "문서"}</span>
          <span class="mobile-text">${(post.title || "문서").charAt(0)}</span>
        </a> 
        <span id="bc-toc-container"></span>
      `;

      breadcrumb.innerHTML = breadcrumbHtml;

      const bcTitle = document.getElementById("bc-title");
      if (bcTitle) {
        bcTitle.addEventListener("click", (e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }

      const bcTocContainer = document.getElementById("bc-toc-container");
      const floatingTocContainer = document.getElementById("floating-toc");

      if (headings.length > 0) {
        let activeHeading = headings[0];
        if (floatingTocContainer) {
          floatingTocContainer.innerHTML = '';
          const rootUl = document.createElement("ul");
          headings.forEach(heading => {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href = "#" + heading.id;
            a.innerText = heading.innerText;
            a.setAttribute("data-toc-id", heading.id);
            li.appendChild(a);
            rootUl.appendChild(li);
          });
          floatingTocContainer.appendChild(rootUl);
        }

        const updateToc = () => {
          if (floatingTocContainer) {
            floatingTocContainer.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            const activeA = floatingTocContainer.querySelector(`a[data-toc-id="${activeHeading.id}"]`);
            if (activeA) activeA.classList.add('active');
          }
        };

        const observer = new IntersectionObserver((entries) => {
          let visibleEntries = entries.filter(e => e.isIntersecting);
          if (visibleEntries.length > 0) {
            visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            activeHeading = visibleEntries[0].target;
            updateToc();
          }
        }, { rootMargin: "-80px 0px -80% 0px", threshold: 0 });

        headings.forEach(h => observer.observe(h));
      }
    }

    // Image Lightbox
    let lightbox = document.getElementById("lightbox");
    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.id = "lightbox";
      const img = document.createElement("img");
      lightbox.appendChild(img);
      document.body.appendChild(lightbox);
      lightbox.addEventListener("click", () => lightbox.classList.remove("active"));
    }
    container.querySelectorAll("img").forEach(img => {
      img.addEventListener("click", () => {
        const lightboxImg = lightbox.querySelector("img");
        lightboxImg.src = img.src;
        lightbox.classList.add("active");
      });
    });

  } catch (error) {
    container.innerHTML = `<p style="color:#fc5c65;">${error.message}</p>`;
  }
}

async function renderPostList(container) {
  try {
    const breadcrumb = document.getElementById("nav-breadcrumb");
    if (breadcrumb) breadcrumb.innerHTML = "";

    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.innerText = "블로그";

    const posts = await fetchPostsByTag("blog");

    if (posts.length === 0) {
      container.innerHTML = `
        <div style="padding: 3rem 0; text-align: center; font-family: monospace; color: var(--breadcrumb-color, #888);">
          <p style="font-size: 1.1rem;">등록된 글이 없습니다.</p>
        </div>
      `;
      return;
    }

    const allTags = new Set();
    posts.forEach(p => p.tags.forEach(t => allTags.add(t)));
    const tagsArray = Array.from(allTags);

    const urlParams = new URLSearchParams(window.location.search);
    const activeTags = urlParams.get("tags") ? urlParams.get("tags").split(",") : [];

    const tagHtml = `
        <div class="tag-list">
            <span class="tag ${activeTags.length === 0 ? "active" : ""}" data-tag="">All</span> / 
            ${tagsArray.map(tag => `
              <span class="tag ${activeTags.includes(tag) ? "active" : ""}" data-tag="${tag}">#${tag}</span>
            `).join(" / ")}
        </div>
    `;
    const tagContainer = document.getElementById("tag-container");
    if (tagContainer) {
      tagContainer.innerHTML = tagHtml;
      tagContainer.querySelectorAll(".tag").forEach(el => {
        el.addEventListener("click", (e) => {
          const clickedTag = e.target.getAttribute("data-tag");
          let newTags = [...activeTags];
          if (!clickedTag) {
            newTags = [];
          } else {
            if (newTags.includes(clickedTag)) {
              newTags = newTags.filter(t => t !== clickedTag);
            } else {
              newTags.push(clickedTag);
            }
          }
          const newUrl = new URL(window.location);
          if (newTags.length > 0) {
            newUrl.searchParams.set("tags", newTags.join(","));
          } else {
            newUrl.searchParams.delete("tags");
          }
          window.history.pushState({}, "", newUrl);
          renderPostList(container);
        });
      });
    }

    const filteredPosts = posts.filter(post => {
      if (activeTags.length === 0) return true;
      return activeTags.some(t => post.tags.includes(t));
    });

    const listItems = filteredPosts.map(post => `
      <li style="margin-bottom: 1.2rem; list-style: none;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:1rem;">
          <a href="/blog/?id=${post.id}" style="color:var(--text-color); text-decoration:none; font-weight:bold; font-size:1.1rem;" class="blog-post-link">
            ${post.title}
          </a>
          <span style="font-size:0.85rem; color:var(--breadcrumb-color, #888); font-family:monospace; white-space:nowrap;">
            (${post.date})
          </span>
        </div>
      </li>
    `).join("");

    container.innerHTML = `
      <ul style="padding-left: 0; margin-top: 1.5rem;">
        ${listItems}
      </ul>
    `;

  } catch (error) {
    container.innerHTML = `<p style="color:#fc5c65;">${error.message}</p>`;
  }
}

const updateScrollMask = () => {
  const scrollY = window.scrollY;
  const mainEl = document.querySelector("main");
  if (mainEl) {
    mainEl.style.setProperty("--scroll-y", `${scrollY}px`);
    const fadeEnd = Math.min(180, 80 + scrollY);
    mainEl.style.setProperty("--mask-fade-end", `${fadeEnd}px`);
  }
};
window.addEventListener("scroll", updateScrollMask);
updateScrollMask();

init();
