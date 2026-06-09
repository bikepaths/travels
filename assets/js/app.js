const targets = [
  { id: -1001031272819, slug: "bikepaths_2016_17", type: "groups", name: "Travels: Jul 2016 to Aug 2017" },
  { id: -1001119595758, slug: "bikepaths", type: "groups", name: "Travels: Dec 2017 to Sep 2019" },
  { id: -1001290146005, slug: "w2c_w", type: "groups", name: "Things I Carry 2019" },
  { id: -1001416892639, slug: "bicycling_technology", type: "groups", name: "Bicycle Technology" },
  { id: -1001386344823, slug: "travels_w_chas", type: "channels", name: "Travels: Sep 2019 to May 2025" }
];

let activeTarget = null;
let allMessages = [];
let filteredMessages = [];
let searchQuery = "";
let isScrollerUpdating = false;

function renderSidebar() {
  const listEl = document.getElementById("target-list");
  listEl.innerHTML = "";
  
  targets.forEach(t => {
    const item = document.createElement("div");
    item.className = `target-item${activeTarget && activeTarget.id === t.id ? " active" : ""}`;
    item.innerHTML = `
      <div class="target-title">${t.name}</div>
      <div class="target-meta">
        <span>${t.type === "channels" ? "Channel" : "Group"}</span>
        <span id="count-${t.slug}">...</span>
      </div>
    `;
    item.addEventListener("click", () => selectTarget(t));
    listEl.appendChild(item);
    
    // Load metadata to show total message count
    fetch(`data/${t.type}/${t.slug}/metadata.json`)
      .then(res => res.json())
      .then(meta => {
        const countEl = document.getElementById(`count-${t.slug}`);
        if (countEl) {
          countEl.textContent = `${meta.total_messages} msgs`;
        }
      })
      .catch(() => {
        const countEl = document.getElementById(`count-${t.slug}`);
        if (countEl) countEl.textContent = "0 msgs";
      });
  });
}

async function selectTarget(t) {
  activeTarget = t;
  document.querySelectorAll(".target-item").forEach((el, index) => {
    el.className = `target-item${targets[index].id === t.id ? " active" : ""}`;
  });
  
  // Set headers
  document.getElementById("chat-title").textContent = t.name;
  document.getElementById("chat-subtitle").textContent = t.type === "channels" ? "Public Channel Archive" : "Group Chat Archive";
  
  const feedEl = document.getElementById("message-feed");
  feedEl.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Loading messages...</div>';
  
  try {
    // 1. Fetch metadata to get month list
    const metaRes = await fetch(`data/${t.type}/${t.slug}/metadata.json`);
    const metadata = await metaRes.json();
    
    // 2. Fetch all monthly JSON messages concurrently
    const fetchPromises = metadata.months.map(month => {
      const fileKey = month.replace("-", "_");
      return fetch(`data/${t.type}/${t.slug}/messages_${fileKey}.json`)
        .then(res => res.json())
        .catch(() => []);
    });
    
    const results = await Promise.all(fetchPromises);
    allMessages = results.flat();
    
    // Apply search filter if any
    applyFilter();
    
  } catch (err) {
    feedEl.innerHTML = `<div style="text-align: center; padding: 40px; color: #ef4444;">Error loading archive: ${err.message}</div>`;
  }
}

function applyFilter() {
  if (!searchQuery) {
    filteredMessages = allMessages;
  } else {
    const query = searchQuery.toLowerCase();
    filteredMessages = allMessages.filter(m => 
      (m.text || "").toLowerCase().includes(query) || 
      (m.from || "unknown").toLowerCase().includes(query)
    );
  }
  renderMessages();
}

function renderMessages() {
  const feedEl = document.getElementById("message-feed");
  feedEl.innerHTML = "";
  
  if (filteredMessages.length === 0) {
    feedEl.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No messages found</div>';
    document.getElementById("timeline-slider").value = 0;
    return;
  }
  
  let lastDateStr = "";
  
  filteredMessages.forEach(m => {
    const msgDate = new Date(m.date);
    const dateStr = msgDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Injected Date divider if day changed
    if (dateStr !== lastDateStr) {
      const divider = document.createElement("div");
      divider.className = "date-divider";
      divider.innerHTML = `<span>${dateStr}</span>`;
      feedEl.appendChild(divider);
      lastDateStr = dateStr;
    }
    
    const bubble = document.createElement("div");
    const senderName = m.from || "unknown";
    const isSelf = senderName.toLowerCase() === "bikepaths" || senderName.toLowerCase() === "charles";
    bubble.className = `message-bubble${isSelf ? " self" : ""}`;
    
    let mediaHtml = "";
    if (m.media) {
      const mediaPath = `media/${activeTarget.slug}/${m.media}`;
      const ext = m.media.split('.').pop().toLowerCase();
      
      if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
        mediaHtml = `
          <div class="msg-media" onclick="openMediaModal('${mediaPath}')">
            <img src="${mediaPath}" alt="Attachment" loading="lazy" />
          </div>
        `;
      } else {
        mediaHtml = `
          <a href="${mediaPath}" class="msg-file" download>
            <div class="msg-file-icon">📄</div>
            <div class="msg-file-info">
              <span class="msg-file-name">${m.media.substring(m.media.indexOf('_') + 1)}</span>
              <span class="msg-file-size">Download Attachment</span>
            </div>
          </a>
        `;
      }
    }
    
    const formattedTime = msgDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    
    bubble.innerHTML = `
      ${isSelf ? "" : `<span class="msg-sender">${senderName}</span>`}
      <div class="msg-text">${formatMessageText(m.text || "")}</div>
      ${mediaHtml}
      <span class="msg-meta">${formattedTime}</span>
    `;
    
    feedEl.appendChild(bubble);
  });
  
  // Auto-scroll to top of the feed
  feedEl.scrollTop = 0;
  document.getElementById("timeline-slider").value = 0;
}

function formatMessageText(text) {
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
    
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return escaped.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

function setupSearch() {
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    applyFilter();
  });
}

function openMediaModal(src) {
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.background = "rgba(0, 0, 0, 0.9)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "1000";
  modal.style.cursor = "zoom-out";
  
  const img = document.createElement("img");
  img.src = src;
  img.style.maxWidth = "90%";
  img.style.maxHeight = "90%";
  img.style.borderRadius = "8px";
  img.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.5)";
  
  modal.appendChild(img);
  modal.addEventListener("click", () => modal.remove());
  document.body.appendChild(modal);
}

function setupNavigation() {
  const slider = document.getElementById("timeline-slider");
  const feed = document.getElementById("message-feed");
  const btnTop = document.getElementById("btn-top");
  const btnBottom = document.getElementById("btn-bottom");

  // Slider controls feed scroll
  slider.addEventListener("input", () => {
    isScrollerUpdating = true;
    const pct = slider.value / 100;
    feed.scrollTop = (feed.scrollHeight - feed.clientHeight) * pct;
    setTimeout(() => { isScrollerUpdating = false; }, 50);
  });

  // Feed scroll updates slider
  feed.addEventListener("scroll", () => {
    if (isScrollerUpdating) return;
    const maxScroll = feed.scrollHeight - feed.clientHeight;
    if (maxScroll > 0) {
      slider.value = Math.round((feed.scrollTop / maxScroll) * 100);
    }
  });

  // Top / Bottom buttons click
  btnTop.addEventListener("click", () => {
    feed.scrollTo({ top: 0, behavior: "smooth" });
    slider.value = 0;
  });

  btnBottom.addEventListener("click", () => {
    feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
    slider.value = 100;
  });
}

// Initial triggers
document.addEventListener("DOMContentLoaded", () => {
  renderSidebar();
  selectTarget(targets[0]);
  setupSearch();
  setupNavigation();
});
