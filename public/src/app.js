



const API_BASE = window.APP_API_BASE || '/api';
const RANK_COUNT = 5;
const MIN_OPEN_HOTTAKES = 10;


const STATUS_LABELS = {
    OFFEN: 'Offen',
    WAHR: 'Wahr',
    FALSCH: 'Falsch'
};


const STATUS_BADGE_CLASS = {
    OFFEN: 'is-open',
    WAHR: 'is-true',
    FALSCH: 'is-false'
};

const STATUS_VALUES = ['OFFEN', 'WAHR', 'FALSCH'];


let allHottakes = [];
let openHottakes = [];
let archivedHottakes = [];
let picks = Array(RANK_COUNT).fill(null);
let lastSubmissionPicks = [];
let currentUser = null;
let adminEnabled = false;
let viewMode = 'active';
let activeGameDay = null;
let gameDays = [];
let selectedHistoryGameDay = null;
let selectedGameDay = null;
let leaderboardSelection = 'all';
let lockCountdownTimer = null;
let isLocked = false;

const hottakesContainer = document.getElementById('hottakes-container');
const ranksContainer = document.getElementById('ranks-container');
const leaderboardContainer = document.getElementById('leaderboard-container');
const savePicksButton = document.getElementById('save-picks');
const adminArea = document.getElementById('admin-area');
const adminList = document.getElementById('hottake-list');
const adminAdd = document.getElementById('add-hottakes');
const adminGameDay = document.getElementById('game-day-config');
const settingsToggle = document.getElementById('settings-toggle');
const settingsClose = document.getElementById('settings-close');
const settingsPanel = document.getElementById('settings-panel');
const settingsBackdrop = document.getElementById('settings-backdrop');
const themeModeInputs = document.querySelectorAll('input[name="theme-mode"]');
const settingsAuthGuest = document.getElementById('settings-auth-guest');
const settingsAuthUser = document.getElementById('settings-auth-user');
const settingsUsername = document.getElementById('settings-username');
const settingsLogout = document.getElementById('settings-logout');
const userChip = document.getElementById('user-chip');
const legalBackdrop = document.getElementById('legal-backdrop');
const legalModal = document.getElementById('legal-modal');
const legalContent = document.getElementById('legal-content');
const legalClose = document.getElementById('legal-close');
const guestActions = document.getElementById('guest-actions');
const authedActions = document.getElementById('authed-actions');
const lockStatus = document.getElementById('lock-status');
const lockCountdown = document.getElementById('lock-countdown');
const viewToggleActive = document.getElementById('view-active');
const viewToggleHistory = document.getElementById('view-history');
const gameDayBanner = document.getElementById('game-day-banner');
let historySelect = null;
let leaderboardSelect = null;


if (
    !hottakesContainer ||
    !ranksContainer ||
    !leaderboardContainer ||
    !savePicksButton ||
    !adminArea ||
    !adminList ||
    !adminAdd
) {
    throw new Error('Hottakes App Initialisierung fehlgeschlagen: DOM-Elemente nicht gefunden.');
}

async function loadGameDays() {
    try {
        const data = await apiFetch('/game-days', {}, { allowNotFound: true });
        gameDays = Array.isArray(data) ? data : [];
        updateHistorySelect();
        updateLeaderboardSelect();
    } catch (error) {
        console.warn('Spieltage konnten nicht geladen werden.', error.message || error);
    }
}

const THEME_MODE_STORAGE_KEY = 'hottakes-theme-mode';
let systemMediaQuery = null;

adminList.classList.add('admin-card');
adminAdd.classList.add('admin-card');
if (adminGameDay) {
    adminGameDay.classList.add('admin-card');
}

const adminFeedback = document.createElement('div');
adminFeedback.id = 'admin-feedback';
adminFeedback.className = 'admin-feedback';
adminFeedback.setAttribute('role', 'status');
adminFeedback.setAttribute('aria-live', 'polite');
adminArea.insertBefore(adminFeedback, adminArea.firstChild);

function showAdminMessage(message, tone = 'info') {
    if (!message) {
        adminFeedback.textContent = '';
        adminFeedback.classList.remove('is-visible');
        adminFeedback.removeAttribute('data-tone');
        return;
    }

    adminFeedback.textContent = message;
    adminFeedback.dataset.tone = tone;
    adminFeedback.classList.add('is-visible');
}


function resolveSystemTheme() {
    if (window.matchMedia) {
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        return prefersLight ? 'light' : 'dark';
    }
    return 'dark';
}


function detachSystemListener() {
    if (systemMediaQuery && typeof systemMediaQuery.removeEventListener === 'function') {
        systemMediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
    systemMediaQuery = null;
}


function handleSystemThemeChange() {
    const mode = getStoredThemeMode() || 'system';
    if (mode === 'system') {
        const nextTheme = resolveSystemTheme();
        document.documentElement.setAttribute('data-theme', nextTheme);
    }
}


async function persistThemePreference(mode) {
    if (!currentUser) {
        return;
    }

    try {
        await apiFetch('/auth/prefs', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ themeMode: mode })
        });
    } catch (error) {
        console.warn('Theme konnte nicht gespeichert werden:', error.message || error);
    }
}


function applyThemeMode(mode) {
    const normalizedMode = ['light', 'dark', 'system'].includes(mode) ? mode : 'system';

    if (normalizedMode === 'system') {
        document.documentElement.setAttribute('data-theme', resolveSystemTheme());
        detachSystemListener();
        if (window.matchMedia) {
            systemMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
            if (typeof systemMediaQuery.addEventListener === 'function') {
                systemMediaQuery.addEventListener('change', handleSystemThemeChange);
            }
        }
    } else {
        document.documentElement.setAttribute('data-theme', normalizedMode);
        detachSystemListener();
    }

    themeModeInputs.forEach((input) => {
        input.checked = input.value === normalizedMode;
    });

    try {
        localStorage.setItem(THEME_MODE_STORAGE_KEY, normalizedMode);
    } catch (_error) {
        // Ignore storage issues (private mode, etc.)
    }

    persistThemePreference(normalizedMode);
}


function getStoredThemeMode() {
    try {
        const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
        if (stored && ['light', 'dark', 'system'].includes(stored)) {
            return stored;
        }
    } catch (_error) {
        // Ignore storage read issues
    }
    return null;
}


function initTheme() {
    const initialMode = getStoredThemeMode() || 'system';
    applyThemeMode(initialMode);

    themeModeInputs.forEach((input) => {
        input.addEventListener('change', (event) => {
            applyThemeMode(event.target.value);
        });
    });
}


function openSettings() {
    if (!settingsPanel || !settingsBackdrop) {
        return;
    }

    settingsPanel.classList.add('is-open');
    settingsBackdrop.classList.add('is-open');
    settingsPanel.setAttribute('aria-hidden', 'false');
    settingsBackdrop.setAttribute('aria-hidden', 'false');

    if (settingsToggle) {
        settingsToggle.setAttribute('aria-expanded', 'true');
    }

    document.body.classList.add('settings-open');
}


function closeSettings() {
    if (!settingsPanel || !settingsBackdrop) {
        return;
    }

    settingsPanel.classList.remove('is-open');
    settingsBackdrop.classList.remove('is-open');
    settingsPanel.setAttribute('aria-hidden', 'true');
    settingsBackdrop.setAttribute('aria-hidden', 'true');

    if (settingsToggle) {
        settingsToggle.setAttribute('aria-expanded', 'false');
    }

    document.body.classList.remove('settings-open');
}


function setupSettingsPanel() {
    if (settingsToggle) {
        settingsToggle.addEventListener('click', () => {
            if (settingsPanel && settingsPanel.classList.contains('is-open')) {
                closeSettings();
            } else {
                openSettings();
            }
        });
    }

    if (settingsClose) {
        settingsClose.addEventListener('click', closeSettings);
    }

    if (settingsBackdrop) {
        settingsBackdrop.addEventListener('click', closeSettings);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && settingsPanel && settingsPanel.classList.contains('is-open')) {
            closeSettings();
        }
    });
}


async function loadLegalContent(type) {
    if (!legalContent) return;

    const path = type === 'impressum' ? '/impressum.html' : '/datenschutz.html';
    legalContent.innerHTML = '<p>Lädt...</p>';

    try {
        const res = await fetch(path, { credentials: 'include' });
        if (!res.ok) throw new Error('Fehler beim Laden');
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const main = doc.querySelector('main');
        legalContent.innerHTML = main ? main.innerHTML : '<p>Inhalt nicht gefunden.</p>';
    } catch (_error) {
        legalContent.innerHTML = '<p>Inhalt konnte nicht geladen werden.</p>';
    }
}


function openLegal(type) {
    if (!legalModal || !legalBackdrop) return;

    loadLegalContent(type);
    legalModal.classList.add('is-open');
    legalBackdrop.classList.add('is-open');
    legalModal.setAttribute('aria-hidden', 'false');
    legalBackdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('legal-open');
}


function closeLegal() {
    if (!legalModal || !legalBackdrop) return;

    legalModal.classList.remove('is-open');
    legalBackdrop.classList.remove('is-open');
    legalModal.setAttribute('aria-hidden', 'true');
    legalBackdrop.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('legal-open');
}


function setupLegalModal() {
    const legalLinks = document.querySelectorAll('.legal-link');
    legalLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const type = link.dataset.legal === 'impressum' ? 'impressum' : 'datenschutz';
            openLegal(type);
        });
    });

    if (legalClose) {
        legalClose.addEventListener('click', closeLegal);
    }

    if (legalBackdrop) {
        legalBackdrop.addEventListener('click', closeLegal);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && legalModal && legalModal.classList.contains('is-open')) {
            closeLegal();
        }
    });
}


function updateSettingsAuth(user) {
    if (!settingsAuthGuest || !settingsAuthUser) {
        return;
    }

    if (user) {
        settingsAuthGuest.classList.add('is-hidden');
        settingsAuthUser.classList.remove('is-hidden');

        if (settingsUsername) {
            settingsUsername.textContent = user.nickname;
        }

        if (settingsLogout) {
            settingsLogout.onclick = async () => {
                await apiFetch('/auth/logout', { method: 'POST' });
                closeSettings();
                window.location.reload();
            };
        }
    } else {
        settingsAuthGuest.classList.remove('is-hidden');
        settingsAuthUser.classList.add('is-hidden');

        if (settingsLogout) {
            settingsLogout.onclick = null;
        }
    }
}


function updateUserChip(user) {
    if (!userChip) {
        return;
    }

    if (user) {
        userChip.textContent = user.nickname;
        userChip.classList.add('is-visible');
    } else {
        userChip.textContent = '';
        userChip.classList.remove('is-visible');
    }
}


function setHeaderAuthState(isLoggedIn) {
    if (guestActions) {
        guestActions.style.display = isLoggedIn ? 'none' : 'flex';
    }

    if (authedActions) {
        authedActions.style.display = isLoggedIn ? 'flex' : 'none';
    }

    if (!isLoggedIn) {
        closeSettings();
    }
}

const hottakesNotice = document.createElement('p');
hottakesNotice.id = 'hottakes-notice';
hottakesNotice.className = 'hottakes-notice';
hottakesContainer.appendChild(hottakesNotice);


const hottakesList = document.createElement('div');
hottakesList.id = 'hottakes-list';
hottakesContainer.appendChild(hottakesList);


const rankSlots = [];

hottakesList.addEventListener('dragover', (event) => {
    event.preventDefault();
});

hottakesList.addEventListener('drop', (event) => {
    event.preventDefault();
    if (viewMode !== 'active' || isLocked) {
        return;
    }
    const hottakeId = Number.parseInt(event.dataTransfer.getData('text/plain'), 10);
    if (Number.isNaN(hottakeId)) {
        return;
    }

    const element = document.querySelector(`[data-hottake-id="${hottakeId}"]`);
    if (!element) {
        return;
    }

    const previousParent = element.parentElement;
    if (previousParent && previousParent.classList.contains('rank')) {
        const prevIndex = Number(previousParent.dataset.rank) - 1;
        if (prevIndex >= 0 && prevIndex < picks.length) {
            picks[prevIndex] = null;
        }
    }

    hottakesList.appendChild(element);
});


function createRankSlots() {
    ranksContainer.querySelectorAll('.rank-wrapper').forEach((wrapper) => wrapper.remove());
    rankSlots.length = 0;

    for (let i = 1; i <= RANK_COUNT; i += 1) {
        const container = document.createElement('div');
        container.className = 'rank-wrapper';

        const label = document.createElement('div');
        label.textContent = `Platz ${i}`;
        label.className = 'rank-label';
        container.appendChild(label);

        const rankDiv = document.createElement('div');
        rankDiv.className = 'rank';
        rankDiv.dataset.rank = String(i);
        rankDiv.addEventListener('dragover', (event) => {
            event.preventDefault();
        });
        rankDiv.addEventListener('drop', handleRankDrop);

        container.appendChild(rankDiv);
        ranksContainer.appendChild(container);
        rankSlots.push(rankDiv);
    }
}


function handleRankDrop(event) {
    event.preventDefault();
    if (viewMode !== 'active' || isLocked) {
        return;
    }
    const rankDiv = event.currentTarget;
    const hottakeId = Number.parseInt(event.dataTransfer.getData('text/plain'), 10);

    if (Number.isNaN(hottakeId)) {
        return;
    }

    const element = document.querySelector(`[data-hottake-id="${hottakeId}"]`);
    if (!element) {
        return;
    }

    const targetIndex = Number(rankDiv.dataset.rank) - 1;
    if (targetIndex < 0 || targetIndex >= picks.length) {
        return;
    }

    const sourceParent = element.parentElement;
    const sourceIndex =
        sourceParent && sourceParent.classList.contains('rank')
            ? Number(sourceParent.dataset.rank) - 1
            : null;

    if (sourceIndex === targetIndex) {
        return;
    }

    const existing = rankDiv.querySelector('.hottake');
    if (existing === element) {
        return;
    }

    if (sourceIndex !== null && sourceIndex >= 0 && sourceIndex < picks.length) {
        picks[sourceIndex] = null;
    }

    if (existing) {
        const existingId = Number(existing.dataset.hottakeId);
        if (!Number.isNaN(existingId)) {
            if (sourceIndex !== null && sourceParent && sourceParent.classList.contains('rank')) {
                sourceParent.appendChild(existing);
                picks[sourceIndex] = existingId;
            } else {
                hottakesList.appendChild(existing);
                const existingIndex = picks.indexOf(existingId);
                if (existingIndex !== -1) {
                    picks[existingIndex] = null;
                }
            }
        }
    }

    rankDiv.appendChild(element);

    for (let i = 0; i < picks.length; i += 1) {
        if (i !== targetIndex && picks[i] === hottakeId) {
            picks[i] = null;
        }
    }

    picks[targetIndex] = hottakeId;
}


function formatDateTime(value) {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}


function toLocalInputValue(value) {
    if (!value) {
        return '';
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const pad = (num) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}


function formatDuration(ms) {
    if (ms <= 0) {
        return '0s';
    }

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
}


function stopLockCountdown() {
    if (lockCountdownTimer) {
        clearInterval(lockCountdownTimer);
        lockCountdownTimer = null;
    }
}


function applyLockStateUI() {
    const isHistory = viewMode !== 'active';
    const selectedMeta = getSelectedGameDayMeta();
    const finalized = selectedMeta ? !selectedMeta.activeFlag : false;
    const hasExactOpen = openHottakes.length === MIN_OPEN_HOTTAKES;
    const blocked = isLocked || isHistory || finalized || !hasExactOpen;

    if (savePicksButton) {
        savePicksButton.disabled = blocked;
        if (isHistory) {
            savePicksButton.textContent = 'Historie ansehen';
        } else if (isLocked) {
            savePicksButton.textContent = 'Picks gesperrt';
        } else {
            savePicksButton.textContent = 'Picks Speichern';
        }
    }

    if (hottakesNotice) {
        if (isLocked) {
            hottakesNotice.textContent = 'Die Picks sind gesperrt. Der Spieltag läuft bereits oder ist abgeschlossen.';
            hottakesNotice.classList.add('is-visible');
        } else if (!hasExactOpen) {
            hottakesNotice.textContent = `Es müssen genau ${MIN_OPEN_HOTTAKES} Hottakes offen sein. Aktuell: ${openHottakes.length}.`;
            hottakesNotice.classList.add('is-visible');
        } else {
            hottakesNotice.textContent = '';
            hottakesNotice.classList.remove('is-visible');
        }
    }
}


function updateLockBanner(lockTime, diffMs) {
    if (!lockStatus || !lockCountdown) {
        return;
    }

    if (!lockTime) {
        lockStatus.textContent = 'Kein aktiver Spieltag';
        lockCountdown.textContent = 'Countdown inaktiv';
        lockCountdown.dataset.state = 'idle';
        return;
    }

    const formattedLock = formatDateTime(lockTime);

    if (diffMs !== null && diffMs <= 0) {
        lockStatus.textContent = `Gesperrt seit ${formattedLock}`;
        lockCountdown.textContent = 'Submission gesperrt';
        lockCountdown.dataset.state = 'locked';
    } else {
        lockStatus.textContent = `Sperre um ${formattedLock}`;
        lockCountdown.textContent = diffMs === null ? 'Countdown inaktiv' : `Noch ${formatDuration(diffMs)}`;
        lockCountdown.dataset.state = 'open';
    }
}


function refreshLockState() {
    stopLockCountdown();

    const selectedMeta = getSelectedGameDayMeta();

    if (!selectedMeta) {
        isLocked = false;
        updateLockBanner(null, null);
        applyLockStateUI();
        return;
    }

    if (!selectedMeta.activeFlag) {
        isLocked = true;
        updateLockBanner(selectedMeta.lockTime || null, 0);
        applyLockStateUI();
        return;
    }

    if (!selectedMeta.lockTime) {
        isLocked = false;
        updateLockBanner(null, null);
        applyLockStateUI();
        return;
    }

    const lockTime = new Date(selectedMeta.lockTime);

    const update = () => {
        const diffMs = lockTime.getTime() - Date.now();
        isLocked = diffMs <= 0;
        updateLockBanner(lockTime, diffMs);
        applyLockStateUI();

        if (isLocked) {
            stopLockCountdown();
        }
    };

    update();

    if (!isLocked) {
        lockCountdownTimer = window.setInterval(update, 1000);
    }
}


async function loadActiveGameDay() {
    try {
        const data = await apiFetch('/game-days/active', {}, { allowNotFound: true });
        activeGameDay = data || null;
        if (activeGameDay && selectedGameDay === null) {
            selectedGameDay = activeGameDay.gameDay;
            selectedHistoryGameDay = selectedGameDay;
            updateHistorySelect();
        }
    } catch (error) {
        activeGameDay = null;
        console.warn('Aktueller Spieltag konnte nicht geladen werden.', error.message || error);
    }

    refreshLockState();
}


async function setViewMode(mode) {
    viewMode = mode === 'history' ? 'history' : 'active';

    if (viewToggleActive) {
        viewToggleActive.classList.toggle('is-active', viewMode === 'active');
    }

    if (viewToggleHistory) {
        viewToggleHistory.classList.toggle('is-active', viewMode === 'history');
    }

    const target = selectedGameDay !== null ? selectedGameDay : activeGameDay?.gameDay;
    await refreshHottakes(target);
    await loadSubmissionForCurrentUser(target, viewMode === 'history');
    await drawLeaderboard();

    renderHottakes();
}


function setupViewToggle() {
    if (viewToggleActive) {
        viewToggleActive.addEventListener('click', () => setViewMode('active'));
    }

    if (viewToggleHistory) {
        viewToggleHistory.addEventListener('click', () => setViewMode('history'));
    }

    if (viewToggleActive) {
        viewToggleActive.classList.toggle('is-active', viewMode === 'active');
    }

    if (viewToggleHistory) {
        viewToggleHistory.classList.toggle('is-active', viewMode === 'history');
    }
}

function ensureHistorySelect() {
    if (historySelect) {
        return historySelect;
    }

    historySelect = document.createElement('select');
    historySelect.id = 'history-game-day';
    historySelect.className = 'game-day-select';
    historySelect.addEventListener('change', async (event) => {
        const value = Number.parseInt(event.target.value, 10);
        if (Number.isNaN(value)) {
            return;
        }
        selectedGameDay = value;
        selectedHistoryGameDay = value;
        await refreshHottakes(value);
        await loadSubmissionForCurrentUser(value, viewMode === 'history');
        await drawLeaderboard();
        refreshLockState();
        renderHottakes();
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'game-day-select-wrapper';

    const label = document.createElement('label');
    label.htmlFor = historySelect.id;
    label.textContent = 'Spieltag wählen';

    wrapper.append(label, historySelect);

    if (gameDayBanner) {
        gameDayBanner.appendChild(wrapper);
    }

    return historySelect;
}

function updateHistorySelect() {
    const select = ensureHistorySelect();
    select.innerHTML = '';

    if (!Array.isArray(gameDays) || gameDays.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Kein Spieltag vorhanden';
        select.appendChild(option);
        select.disabled = true;
        return;
    }

    select.disabled = false;

    gameDays.forEach((day) => {
        const option = document.createElement('option');
        option.value = String(day.gameDay);
        const isCurrent = activeGameDay && activeGameDay.gameDay === day.gameDay;
        const suffix = isCurrent ? ' (Aktueller Spieltag)' : day.activeFlag ? ' (aktiv)' : '';
        option.textContent = day.description ? `${day.description}${suffix}` : `Spieltag ${day.gameDay}${suffix}`;
        select.appendChild(option);
    });

    if (selectedGameDay === null && gameDays.length > 0) {
        const currentId = activeGameDay?.gameDay;
        selectedGameDay = currentId ?? gameDays[0].gameDay;
        selectedHistoryGameDay = selectedGameDay;
    }

    if (selectedGameDay !== null) {
        select.value = String(selectedGameDay);
    }
}

function getSelectedGameDayMeta() {
    if (selectedGameDay !== null) {
        const match = gameDays.find((day) => day.gameDay === selectedGameDay);
        if (match) return match;
    }
    return activeGameDay;
}

function ensureLeaderboardSelect() {
    if (leaderboardSelect) {
        return leaderboardSelect;
    }

    leaderboardSelect = document.createElement('select');
    leaderboardSelect.id = 'leaderboard-game-day';
    leaderboardSelect.className = 'game-day-select leaderboard-select';
    leaderboardSelect.addEventListener('change', async (event) => {
        const value = event.target.value;
        leaderboardSelection = value === 'all' ? 'all' : Number.parseInt(value, 10);
        await drawLeaderboard();
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'game-day-select-wrapper';

    const label = document.createElement('label');
    label.htmlFor = leaderboardSelect.id;
    label.textContent = 'Leaderboard Ansicht';

    wrapper.append(label, leaderboardSelect);

    if (gameDayBanner) {
        gameDayBanner.appendChild(wrapper);
    }

    return leaderboardSelect;
}

function updateLeaderboardSelect() {
    const select = ensureLeaderboardSelect();
    select.innerHTML = '';

    const globalOption = document.createElement('option');
    globalOption.value = 'all';
    globalOption.textContent = 'Global (alle abgeschlossenen)';
    select.appendChild(globalOption);

    const finalizedDays = gameDays.filter((day) => !day.activeFlag);

    finalizedDays.forEach((day) => {
        const option = document.createElement('option');
        option.value = String(day.gameDay);
        option.textContent = day.description ? `${day.description} (abgeschlossen)` : `Spieltag ${day.gameDay} (abgeschlossen)`;
        select.appendChild(option);
    });

    if (leaderboardSelection === null) {
        leaderboardSelection = 'all';
    }

    select.value = leaderboardSelection === 'all' ? 'all' : String(leaderboardSelection);
}


async function apiFetch(path, options = {}, { allowNotFound = false } = {}) {
    const url = `${API_BASE}${path}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }

    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers, credentials: 'include' });
    const contentType = response.headers.get('content-type') || '';
    let text = '';
    let data = null;

    try {
        text = await response.text();
    } catch (_error) {
        text = '';
    }

    if (contentType.includes('application/json')) {
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (_error) {
                data = null;
            }
        }
    } else {
        data = text;
    }

    if (!response.ok) {
        if (allowNotFound && response.status === 404) {
            return null;
        }

        const message =
            data && typeof data === 'object' && 'message' in data
                ? data.message
                : typeof data === 'string' && data.trim().length
                    ? data.trim()
                    : `Request failed (${response.status})`;

        const hint = contentType.includes('text/html')
            ? 'Server lieferte HTML. Prüfe API_BASE (/api) und die Server-Routing-Reihenfolge.'
            : null;

        throw new Error(hint ? `${message}\n${hint}` : message);
    }

    return data;
}


function sanitizePicks(allowedHottakes = openHottakes) {
    const validIds = new Set(allowedHottakes.map((hot) => hot.id));
    picks = picks.map((id) => (typeof id === 'number' && validIds.has(id) ? id : null));
}


function createHottakeElement(hottake, { readonly = false, picked = false } = {}) {
    const element = document.createElement('p');
    element.textContent = hottake.text;

    const statusClass = STATUS_BADGE_CLASS[hottake.status] || 'is-open';
    element.className = `hottake ${statusClass}`;
    if (readonly) {
        element.classList.add('is-readonly');
    }

    if (picked) {
        element.classList.add('is-picked');
    }

    element.draggable = !readonly && !isLocked;
    element.dataset.hottakeId = String(hottake.id);
    if (!readonly && !isLocked) {
        element.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData('text/plain', String(hottake.id));
            event.dataTransfer.effectAllowed = 'move';
        });
    }
    return element;
}


function renderHottakes() {
    const availableHottakes = viewMode === 'history' ? archivedHottakes : openHottakes;
    const sanitizeSource = viewMode === 'history' ? allHottakes : openHottakes;
    const isReadOnly = viewMode !== 'active' || isLocked;
    const referencePicks = viewMode === 'history' ? lastSubmissionPicks : picks;

    sanitizePicks(sanitizeSource);
    hottakesList.innerHTML = '';
    rankSlots.forEach((slot) => {
        slot.innerHTML = '';
    });

    const hasMinimumOpen = openHottakes.length >= MIN_OPEN_HOTTAKES;
    if (viewMode === 'active' && !isLocked && !hasMinimumOpen) {
        hottakesNotice.textContent = `Es müssen genau ${MIN_OPEN_HOTTAKES} Hottakes offen sein. Aktuell verfügbar: ${openHottakes.length}.`;
        hottakesNotice.classList.add('is-visible');
    } else if (!isLocked) {
        hottakesNotice.textContent = '';
        hottakesNotice.classList.remove('is-visible');
    }

    availableHottakes.forEach((hottake) => {
        const element = createHottakeElement(hottake, {
            readonly: isReadOnly,
            picked: referencePicks.includes(hottake.id)
        });
        const rankIndex = referencePicks.indexOf(hottake.id);
        if (rankIndex !== -1) {
            rankSlots[rankIndex].appendChild(element);
        } else {
            hottakesList.appendChild(element);
        }
    });

    if (adminEnabled) {
        renderAdminOverview();
    }

    applyLockStateUI();
}


async function refreshHottakes(targetGameDay = null) {
    try {
        const fallback = selectedGameDay !== null ? selectedGameDay : activeGameDay?.gameDay;
        const gameDay = targetGameDay !== null ? targetGameDay : fallback;
        const meta = gameDay !== null && gameDay !== undefined ? getSelectedGameDayMeta() : null;

        if (meta && !meta.activeFlag) {
            viewMode = 'history';
        } else {
            viewMode = 'active';
        }

        if (gameDay === null || gameDay === undefined) {
            hottakesList.innerHTML = '<p>Kein Spieltag ausgewählt.</p>';
            openHottakes = [];
            archivedHottakes = [];
            allHottakes = [];
            return;
        }

        const [openData, archivedData] = await Promise.all([
            apiFetch(`/hottakes?gameDay=${encodeURIComponent(gameDay)}`),
            apiFetch(`/hottakes?archived=true&gameDay=${encodeURIComponent(gameDay)}`)
        ]);

        openHottakes = Array.isArray(openData) ? openData : [];
        archivedHottakes = Array.isArray(archivedData) ? archivedData : [];
        allHottakes = [...openHottakes, ...archivedHottakes];
        renderHottakes();
    } catch (error) {
        console.error(error);
        hottakesList.innerHTML = '<p>Fehler beim Laden der Hottakes.</p>';
    }
}


async function drawLeaderboard(targetGameDay = null) {
    leaderboardContainer.innerHTML = '<h2>Leaderboard</h2>';
    const selection = leaderboardSelection === null ? 'all' : leaderboardSelection;
    const gameDayParam = targetGameDay !== null ? targetGameDay : selection;

    if (gameDayParam === null || gameDayParam === undefined) {
        const row = document.createElement('p');
        row.textContent = 'Kein Spieltag ausgewählt.';
        leaderboardContainer.appendChild(row);
        return;
    }

    try {
        const param = gameDayParam === 'all' ? 'all' : encodeURIComponent(gameDayParam);
        const response = await apiFetch(`/leaderboard?gameDay=${param}`);
        const entries = Array.isArray(response) ? response : [];

        if (entries.length === 0) {
            const emptyRow = document.createElement('p');
            emptyRow.textContent = 'Noch keine Scores.';
            leaderboardContainer.appendChild(emptyRow);
            return;
        }

        entries.forEach((entry, index) => {
            const row = document.createElement('p');
            row.textContent = `${index + 1}. ${entry.nickname}: ${entry.score} Punkte`;
            leaderboardContainer.appendChild(row);
        });
    } catch (error) {
        console.error(error);
        const row = document.createElement('p');
        row.textContent = 'Fehler beim Laden des Leaderboards.';
        leaderboardContainer.appendChild(row);
    }
}


async function loadSubmissionForCurrentUser(gameDay = null, isHistory = false) {
    if (!currentUser) {
        return;
    }

    const fallback = selectedGameDay !== null ? selectedGameDay : activeGameDay?.gameDay;
    const targetGameDay = gameDay !== null ? gameDay : fallback;
    if (targetGameDay === null || targetGameDay === undefined) {
        return;
    }

    try {
        const submission = await apiFetch(`/submissions/${encodeURIComponent(currentUser.nickname)}?gameDay=${encodeURIComponent(targetGameDay)}`, {}, { allowNotFound: true });
        const nextPicks = Array(RANK_COUNT).fill(null);

        lastSubmissionPicks = submission && Array.isArray(submission.picks)
            ? submission.picks.slice(0, RANK_COUNT)
            : [];

        if (submission && Array.isArray(submission.picks)) {
            submission.picks.slice(0, RANK_COUNT).forEach((id, index) => {
                if (typeof id === 'number') {
                    nextPicks[index] = id;
                }
            });
        }

        if (isHistory) {
            renderHottakes();
        } else {
            picks = nextPicks;
            renderHottakes();
        }
    } catch (error) {
        alert(error.message);
    }
}


async function saveSubmission() {
    if (viewMode !== 'active') {
        alert('Historie ist schreibgeschützt. Wechsle zur aktiven Ansicht.');
        return;
    }

    if (selectedGameDay === null) {
        alert('Es ist kein Spieltag ausgewählt.');
        return;
    }

    if (isLocked) {
        alert('Die Picks sind gesperrt. Der Spieltag hat bereits begonnen.');
        return;
    }

    if (openHottakes.length !== MIN_OPEN_HOTTAKES) {
        alert(`Es müssen genau ${MIN_OPEN_HOTTAKES} Hottakes offen sein, um zu tippen.`);
        return;
    }

    if (picks.some((entry) => entry === null)) {
        alert('Bitte wähle alle 5 Hottakes aus, bevor du speicherst.');
        return;
    }

    if (!currentUser) {
        alert('Bitte melde dich zuerst an.');
        return;
    }

    try {
        await apiFetch(`/submissions?gameDay=${encodeURIComponent(selectedGameDay)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ picks })
        });

        lastSubmissionPicks = picks.slice(0, RANK_COUNT);

        alert('Deine Picks wurden gespeichert.');
        await drawLeaderboard();
    } catch (error) {
        alert(error.message);
    }
}


function renderAdminOverview() {
    adminList.innerHTML = '<h3 class="admin-section-title">Aktuelle Hottakes</h3>';

    if (!allHottakes.length) {
        const info = document.createElement('p');
        info.className = 'admin-empty-state';
        info.textContent = 'Noch keine Hottakes vorhanden.';
        adminList.appendChild(info);
        return;
    }

    const list = document.createElement('ul');
    list.className = 'admin-hottake-list';

    allHottakes.forEach((hot, index) => {
        const item = document.createElement('li');
        item.className = 'admin-hottake-item';

        const text = document.createElement('span');
        text.className = 'admin-hottake-text';
        text.textContent = `${index + 1}. ${hot.text}`;

        const controls = document.createElement('span');
        controls.className = 'admin-hottake-controls';

        const statusBadge = document.createElement('span');
        const badgeClass = STATUS_BADGE_CLASS[hot.status] || 'is-open';
        statusBadge.className = `admin-badge ${badgeClass}`;
        statusBadge.textContent = STATUS_LABELS[hot.status] || hot.status;

        const statusSelect = document.createElement('select');
        statusSelect.className = 'admin-status-select';

        STATUS_VALUES.forEach((status) => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = STATUS_LABELS[status] || status;
            statusSelect.appendChild(option);
        });

        statusSelect.value = hot.status;

        statusSelect.addEventListener('change', async (event) => {
            const nextStatus = event.target.value;

            if (!STATUS_VALUES.includes(nextStatus)) {
                statusSelect.value = hot.status;
                showAdminMessage('Ungültiger Status ausgewählt.', 'error');
                return;
            }

            if (nextStatus === hot.status) {
                return;
            }

            statusSelect.disabled = true;

            try {
                await apiFetch(`/hottakes/${hot.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: nextStatus })
                });

                showAdminMessage(`Status aktualisiert: ${STATUS_LABELS[nextStatus]}.`, 'success');
                await refreshHottakes();
                await drawLeaderboard();
            } catch (error) {
                statusSelect.value = hot.status;
                showAdminMessage(error.message, 'error');
            } finally {
                statusSelect.disabled = false;
            }
        });

        controls.append(statusBadge, statusSelect);
        item.append(text, controls);
        list.appendChild(item);
    });

    adminList.appendChild(list);
}


function renderAdminForm() {
    adminAdd.innerHTML = '<h3 class="admin-section-title">Neuen Hottake hinzufügen</h3>';

    const form = document.createElement('form');
    form.className = 'admin-form';

    const textLabel = document.createElement('label');
    textLabel.className = 'admin-form-label';
    textLabel.textContent = 'Titel & Beschreibung';

    const textInput = document.createElement('textarea');
    textInput.name = 'text';
    textInput.placeholder = 'Beschreibe deinen Hottake...';
    textInput.required = true;
    textInput.rows = 4;
    textLabel.appendChild(textInput);

    const statusHint = document.createElement('p');
    statusHint.className = 'admin-form-hint';
    statusHint.textContent = 'Neue Hottakes starten immer mit dem Status Offen.';

    const gameDayLabel = document.createElement('label');
    gameDayLabel.className = 'admin-form-label';
    gameDayLabel.textContent = 'Spieltag wählen';

    const gameDaySelect = document.createElement('select');
    gameDaySelect.name = 'gameDay';
    gameDaySelect.required = true;

    const openDays = gameDays.filter((day) => day.activeFlag);
    if (openDays.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Kein offener Spieltag vorhanden';
        gameDaySelect.appendChild(option);
        gameDaySelect.disabled = true;
    } else {
        openDays.forEach((day) => {
            const option = document.createElement('option');
            option.value = String(day.gameDay);
            option.textContent = day.description || `Spieltag ${day.gameDay}`;
            gameDaySelect.appendChild(option);
        });
        if (selectedGameDay !== null) {
            gameDaySelect.value = String(selectedGameDay);
        }
    }
    gameDayLabel.appendChild(gameDaySelect);

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Hottake speichern';

    form.append(textLabel, statusHint, gameDayLabel, submitButton);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const text = textInput.value.trim();
        if (text.length < 3) {
            showAdminMessage('Der Text muss mindestens 3 Zeichen lang sein.', 'error');
            textInput.focus();
            return;
        }

        const selectedGameDayNumber = Number.parseInt(gameDaySelect.value, 10);
        const payload = Number.isNaN(selectedGameDayNumber) ? { text } : { text, gameDay: selectedGameDayNumber };

        submitButton.disabled = true;
        submitButton.textContent = 'Speichern...';

        try {
            await apiFetch('/hottakes', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            textInput.value = '';

            await refreshHottakes();
            await drawLeaderboard();
            showAdminMessage('Hottake gespeichert.', 'success');
        } catch (error) {
            showAdminMessage(error.message, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Hottake speichern';
        }
    });

    adminAdd.appendChild(form);
}


function renderGameDayAdmin() {
    if (!adminGameDay) {
        return;
    }

    adminGameDay.innerHTML = '<h3 class="admin-section-title">Spieltag & Sperre</h3>';

    const status = document.createElement('div');
    status.className = 'admin-game-status';
    const selectedMeta = getSelectedGameDayMeta();

    if (selectedMeta) {
        const title = document.createElement('p');
        title.className = 'admin-status-line';
        const stateLabel = selectedMeta.activeFlag ? '(offen)' : '(abgeschlossen)';
        title.innerHTML = `<strong>Aktuell gewählt:</strong> ${selectedMeta.description} ${stateLabel}`;

        const lockInfo = document.createElement('p');
        lockInfo.className = 'admin-status-line';
        lockInfo.textContent = `Lock: ${formatDateTime(selectedMeta.lockTime) || 'keine Zeit gesetzt'}`;

        const dayInfo = document.createElement('p');
        dayInfo.className = 'admin-status-line';
        dayInfo.textContent = `Spieltag-Nr.: ${selectedMeta.gameDay}`;

        status.append(title, lockInfo, dayInfo);
    } else {
        const empty = document.createElement('p');
        empty.className = 'admin-status-line';
        empty.textContent = 'Kein Spieltag gewählt.';
        status.appendChild(empty);
    }

    const form = document.createElement('form');
    form.className = 'admin-form admin-form--stacked';

    const descLabel = document.createElement('label');
    descLabel.className = 'admin-form-label';
    descLabel.textContent = 'Beschreibung';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.required = true;
    descInput.name = 'description';
    descInput.placeholder = 'z. B. Spieltag 5';
    descInput.value = selectedMeta ? selectedMeta.description : '';
    descLabel.appendChild(descInput);

    const lockLabel = document.createElement('label');
    lockLabel.className = 'admin-form-label';
    lockLabel.textContent = 'Lock Time (Datum & Uhrzeit)';
    const lockInput = document.createElement('input');
    lockInput.type = 'datetime-local';
    lockInput.name = 'lockTime';
    lockInput.required = true;
    lockInput.value = toLocalInputValue(selectedMeta?.lockTime || null);
    lockLabel.appendChild(lockInput);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = activeGameDay ? 'Neuen Spieltag anlegen' : 'Spieltag erstellen';

    const finalize = document.createElement('button');
    finalize.type = 'button';
    finalize.textContent = 'Aktiven Spieltag abschließen';
    finalize.className = 'admin-finalize';
    finalize.disabled = !selectedMeta || !selectedMeta.activeFlag;

    finalize.addEventListener('click', async () => {
        if (!selectedMeta) return;
        finalize.disabled = true;

        try {
            await apiFetch(`/admin/game-days/${selectedMeta.id}/finalize`, { method: 'POST' });
            showAdminMessage('Spieltag wurde beendet.', 'success');
                await loadGameDays();
                await loadActiveGameDay();
                renderGameDayAdmin();
        } catch (error) {
            showAdminMessage(error.message, 'error');
        } finally {
            finalize.disabled = false;
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const description = descInput.value.trim();
        const lockTimeValue = lockInput.value ? new Date(lockInput.value).toISOString() : null;

        if (!description || !lockTimeValue) {
            showAdminMessage('Bitte Beschreibung und Lock-Zeit angeben.', 'error');
            return;
        }

        submit.disabled = true;
        submit.textContent = 'Wird gespeichert...';

        try {
            const payload = { description, lockTime: lockTimeValue };
            const created = await apiFetch('/admin/game-days', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            activeGameDay = created;
            selectedGameDay = created.gameDay;
            showAdminMessage('Spieltag gespeichert.', 'success');
            refreshLockState();
            await loadGameDays();
            renderGameDayAdmin();
        } catch (error) {
            showAdminMessage(error.message, 'error');
        } finally {
            submit.disabled = false;
            submit.textContent = activeGameDay ? 'Neuen Spieltag anlegen' : 'Spieltag erstellen';
        }
    });

    form.append(descLabel, lockLabel, submit, finalize);
    adminGameDay.append(status, form);
}


function enableAdminArea() {
    adminEnabled = true;
    adminArea.style.display = 'flex';
    refreshHottakes(activeGameDay?.gameDay);
    drawLeaderboard();
    renderAdminOverview();
    renderAdminForm();
    renderGameDayAdmin();
    renderHottakes();
    showAdminMessage('Admin-Modus aktiv. Du kannst neue Hottakes speichern.', 'info');
    setTimeout(() => {
        adminArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
}


function disableAdminArea() {
    adminEnabled = false;
    adminArea.style.display = 'none';
    showAdminMessage('', 'info');
    renderHottakes();
}


savePicksButton.addEventListener('click', saveSubmission);


async function checkLoginStatus() {
    try {
        const data = await apiFetch('/auth/me', {}, { allowNotFound: true });
        if (data && data.user) {

            updateUIForLogin(data.user);
        } else {

            console.log('User is guest (no session found)');
            updateUIForGuest();
        }
    } catch (error) {

        const isAuthError = error.message.includes('Authentication required') ||
            error.message.includes('Invalid or expired token') ||
            error.message.includes('401');

        if (isAuthError) {
            console.log('User is guest (Unauthorized)');
            updateUIForGuest();
            return;
        }

        console.warn('Auth check failed:', error);

        updateUIForGuest();
    }
}


function updateUIForLogin(user) {
    currentUser = user;
    updateUserChip(user);
    updateSettingsAuth(user);
    setHeaderAuthState(true);
    persistThemePreference(getStoredThemeMode() || 'system');

    const userInfo = document.getElementById('user-info');
    const userDisplay = document.getElementById('user-nickname-display');
    if (userInfo && userDisplay) {
        userDisplay.textContent = user.nickname;
        userInfo.style.display = 'block';
    }


    const guestArea = document.getElementById('guest-nickname-area');
    if (guestArea) guestArea.style.display = 'none';

    const welcomeBanner = document.getElementById('welcome-banner');
    if (welcomeBanner) welcomeBanner.style.display = 'none';


    const gameContainer = document.getElementById('game');
    const adminArea = document.getElementById('admin-area');

    if (user.nickname === 'lille08') {

        if (gameContainer) gameContainer.style.display = 'none';
        if (savePicksButton) savePicksButton.style.display = 'none';

        if (adminArea) {
            adminArea.style.display = 'flex';
            enableAdminArea();
        }
    } else {
        adminEnabled = false;

        if (gameContainer) gameContainer.style.display = 'flex';
        if (savePicksButton) {
            savePicksButton.style.display = 'inline-block';
            savePicksButton.disabled = false;
            savePicksButton.textContent = 'Picks Speichern';
        }
        if (adminArea) {
            adminArea.style.display = 'none';
        }

        loadSubmissionForCurrentUser();
    }
}


function updateUIForGuest() {
    currentUser = null;
    updateUserChip(null);
    updateSettingsAuth(null);
    closeSettings();
    setHeaderAuthState(false);
    setViewMode('active');

    adminEnabled = false;


    const guestArea = document.getElementById('guest-nickname-area');
    if (guestArea) {
        guestArea.innerHTML = '';
        guestArea.style.display = 'none';
    }

    const welcomeBanner = document.getElementById('welcome-banner');
    if (welcomeBanner) welcomeBanner.style.display = 'block';


    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.style.display = 'none';



    const gameContainer = document.getElementById('game');
    const adminArea = document.getElementById('admin-area');

    if (gameContainer) gameContainer.style.display = 'none';
    if (adminArea) adminArea.style.display = 'none';

    if (savePicksButton) {
        savePicksButton.disabled = true;
        savePicksButton.style.display = 'none';
    }
}


async function initializeApp() {
    initTheme();
    setupSettingsPanel();
    setupLegalModal();
    setupViewToggle();
    createRankSlots();
    await loadGameDays();
    await loadActiveGameDay();
    await checkLoginStatus();
    await refreshHottakes();
    await drawLeaderboard();
}

initializeApp().catch((error) => {
    console.error(error);
    alert('Fehler beim Initialisieren der App.');
});




