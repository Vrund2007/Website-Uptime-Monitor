// Configuration
// If LAMBDA_FUNCTION_URL is set, "Check Now" triggers a live Lambda check on demand.
// Otherwise, it re-fetches the latest status.json written by EventBridge/Lambda.
const LAMBDA_FUNCTION_URL = "https://hvqyd3toj3obgotnsqtbvxz54e0cekrg.lambda-url.ap-southeast-2.on.aws/"; 

const statusCardsContainer = document.getElementById("statusCards");
const lastUpdatedEl = document.getElementById("lastUpdated");
const checkNowBtn = document.getElementById("checkNowBtn");
const btnText = document.getElementById("btnText");

// Format date nicely
function formatDate(isoString) {
  if (!isoString) return "Unknown";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
           " (" + date.toLocaleDateString() + ")";
  } catch (e) {
    return isoString;
  }
}

// Render cards for the predefined websites
function renderCards(sites) {
  if (!sites || sites.length === 0) {
    statusCardsContainer.innerHTML = `
      <div class="card error-card">
        <p>No website status data available.</p>
      </div>
    `;
    return;
  }

  statusCardsContainer.innerHTML = sites.map(site => {
    const isOnline = site.status === "Online";
    const statusClass = isOnline ? "online" : "down";
    const statusText = isOnline ? "Online" : "Down";
    const cardClass = isOnline ? "card" : "card card-down";
    const responseTimeText = site.responseTime !== undefined ? `${site.responseTime} ms` : "N/A";

    let statusCodeText = "HTTP 200";
    if (site.statusCode && site.statusCode > 0) {
      statusCodeText = `HTTP ${site.statusCode}`;
    } else if (!isOnline) {
      statusCodeText = "Unreachable";
    }

    // Clean display name for the site
    let displayName = site.url;
    try {
      const parsed = new URL(site.url);
      displayName = parsed.hostname + (parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "");
    } catch (e) {}

    const errorDetails = (!isOnline && site.error) 
      ? `<span class="down-error-label">⚠️ ${site.error}</span>` 
      : "";

    return `
      <div class="${cardClass}">
        <div class="site-info">
          <a href="${site.url}" target="_blank" rel="noopener noreferrer" class="site-url">
            ${displayName}
          </a>
          <span class="site-subtext">${site.url}</span>
          ${errorDetails}
        </div>
        
        <div class="site-metrics">
          <div class="metric-item">
            <span class="metric-label">Response Time</span>
            <span class="metric-value">${responseTimeText}</span>
          </div>

          <div class="metric-item">
            <span class="metric-label">Status</span>
            <span class="metric-value ${isOnline ? '' : 'text-down'}">${statusCodeText}</span>
          </div>

          <span class="status-badge ${statusClass}">
            <span class="status-dot"></span>
            ${statusText}
          </span>
        </div>
      </div>
    `;
  }).join("");
}

// Fetch status from S3 status.json
async function fetchStatusFromS3() {
  const cacheBuster = `?t=${new Date().getTime()}`;
  const response = await fetch(`status.json${cacheBuster}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Failed to load status.json (${response.status})`);
  }
  return await response.json();
}

// Trigger live check via Lambda Function URL or fallback to S3 fetch
async function loadStatus(triggerLiveCheck = false) {
  setLoadingState(true);

  try {
    let data;
    if (triggerLiveCheck && LAMBDA_FUNCTION_URL) {
      // Trigger live Lambda check
      const response = await fetch(LAMBDA_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        data = await response.json();
      } else {
        console.warn("Lambda URL returned non-200, falling back to S3 status.json");
        data = await fetchStatusFromS3();
      }
    } else {
      data = await fetchStatusFromS3();
    }

    renderCards(data.sites);
    lastUpdatedEl.textContent = `Last checked: ${formatDate(data.lastUpdated)}`;
  } catch (error) {
    console.error("Error loading status:", error);
    statusCardsContainer.innerHTML = `
      <div class="card error-card">
        <p>Could not fetch uptime status. Click "Check Now" or try again shortly.</p>
        <span class="site-subtext">${error.message}</span>
      </div>
    `;
    lastUpdatedEl.textContent = "Last checked: Error loading data";
  } finally {
    setLoadingState(false);
  }
}

function setLoadingState(isLoading) {
  if (isLoading) {
    checkNowBtn.disabled = true;
    checkNowBtn.classList.add("loading");
    btnText.textContent = "Checking...";
  } else {
    checkNowBtn.disabled = false;
    checkNowBtn.classList.remove("loading");
    btnText.textContent = "Check Now";
  }
}

// Button click listener
checkNowBtn.addEventListener("click", () => {
  loadStatus(true);
});

// Auto-refresh every 60 seconds on the dashboard
setInterval(() => {
  loadStatus(false);
}, 60000);

// Initial load
loadStatus(false);
