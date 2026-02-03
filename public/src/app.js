const API_BASE = window.APP_API_BASE || '/api';
const RANK_COUNT = 3;
const MIN_OPEN_HOTTAKES = 10;
const SWIPE_THRESHOLD = 50;
const AUTO_SAVE_DEBOUNCE_MS = 3000;


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

const GAME_DAY_STATUS = {
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE',
    FINALIZED: 'FINALIZED',
    ARCHIVED: 'ARCHIVED'
};


let allHottakes = [];
let openHottakes = [];
let archivedHottakes = [];
let picks = Array(RANK_COUNT).fill(null);
let lastSubmissionPicks = [];
let lastSubmissionSwipeDecisions = [];
let lastSubmissionGameDay = null;
let currentUser = null;
let adminEnabled = false;
let viewMode = 'active';
let activeGameDay = null;
let gameDays = [];
let selectedHistoryGameDay = null;
let selectedGameDay = null;
let leaderboardSelection = 'all';
let leaderboardRequestToken = 0;
let lockCountdownTimer = null;
let isLocked = false;
let swipeDeck = [];
let swipeIndex = 0;
let swipeDecisions = [];
let swipeCompleted = false;
let swipeGameDay = null;
let swipeSessionHistory = [];
let swipeResetPicksOnFinish = true;
let swipeTouchStartX = null;
let swipeTouchDeltaX = 0;
let swipeAnimating = false;
let isDragging = false;
let dragState = null;
let pendingGesture = null;
let lastDragAt = 0;
let dragFrameId = null;
const DRAG_START_THRESHOLD = 10;
const TAP_MAX_DURATION_MS = 200;
const LONG_PRESS_MS = 200;
const DRAFT_STORAGE_PREFIX = 'hottakes-draft';
let autoSaveTimer = null;
let autoSaveHasSavedOnce = false;
let autoSaveGameDay = null;
let isSavingSubmission = false;
let autoSaveToastTimer = null;

const hottakesContainer = document.getElementById('hottakes-container');
const ranksContainer = document.getElementById('ranks-container');
const leaderboardContainer = document.getElementById('leaderboard-container');
const gameDayShell = document.getElementById('game-day-shell');
const leaderboardHeader = document.createElement('div');
const leaderboardTitle = document.createElement('h2');
const leaderboardList = document.createElement('div');
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
const userChip = document.getElementById('user-chip'); //Benutzernickname im Header
const legalBackdrop = document.getElementById('legal-backdrop');
const legalModal = document.getElementById('legal-modal');
const legalContent = document.getElementById('legal-content');
const legalClose = document.getElementById('legal-close');
const guestActions = document.getElementById('guest-actions');
const authedActions = document.getElementById('authed-actions');
const swipeOverlay = document.getElementById('swipe-overlay');
const swipeCard = document.getElementById('swipe-card');
const swipeCardBack = document.getElementById('swipe-card-back');
const swipeBackButton = document.getElementById('swipe-back');
const swipeCloseButton = document.getElementById('swipe-close');
const swipeSkipButton = document.getElementById('swipe-skip');
const swipeProgress = document.getElementById('swipe-progress');

const lockCountdown = document.getElementById('lock-countdown');
const lockStatus = document.getElementById('lock-status');
const gameDayBanner = document.getElementById('game-day-banner');
const gameDayActions = document.querySelector('#game-day-banner .game-day-actions');
const gameDayInfo = document.getElementById('game-day-info');
let historySelect = null;
let leaderboardSelect = null;
const autoSaveToast = document.createElement('div');

// Sicherstellen, dass alle notwendigen DOM-Elemente vorhanden sind
if (
    !hottakesContainer ||
    !ranksContainer ||
    !leaderboardContainer ||
    !adminArea ||
    !adminList ||
    !adminAdd
) {
    throw new Error('Hottakes App Initialisierung fehlgeschlagen: DOM-Elemente nicht gefunden.');
}

leaderboardHeader.className = 'leaderboard-header';
leaderboardTitle.textContent = 'Leaderboard';
leaderboardHeader.appendChild(leaderboardTitle);
leaderboardList.id = 'leaderboard-list';

if (leaderboardContainer) {
    leaderboardContainer.append(leaderboardHeader, leaderboardList);
}

autoSaveToast.className = 'auto-save-toast';
autoSaveToast.textContent = 'Gespeichert';
autoSaveToast.setAttribute('role', 'status');
autoSaveToast.setAttribute('aria-live', 'polite');
document.body.appendChild(autoSaveToast);

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

// Ermittelt das aktuelle System-Theme (light/dark)
function resolveSystemTheme() {
    if (window.matchMedia) {
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        return prefersLight ? 'light' : 'dark';
    }
    return 'dark';
}

// Wenn Theme auf dark/light gesetzt ist, wird der Listener entfernt
function detachSystemListener() {
    if (systemMediaQuery && typeof systemMediaQuery.removeEventListener === 'function') {
        systemMediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
    systemMediaQuery = null;
}

// Reagiert auf Änderungen des System-Themes
function handleSystemThemeChange() {
    const mode = getStoredThemeMode() || 'system';
    if (mode === 'system') {
        const nextTheme = resolveSystemTheme();
        document.documentElement.setAttribute('data-theme', nextTheme);
    }
}

// Theme-Auswahl wird gespeichert (nur wenn User eingeloggt)
// async macht die Funktion asynchron, sodass sie ein Promise zurückgibt.
// await kann dann innerhalb der Funktion verwendet werden, um auf das Ergebnis von Promises zu warten.
// Promises sind Objekte, die einen Wert jetzt, in der Zukunft oder nie liefern (z.B. bei Serveranfragen).
// fetch (bzw. apiFetch) ist eine Funktion, die asynchron Daten vom Server holt und ein Promise zurückgibt.
async function persistThemePreference(mode) {
    if (!currentUser) {
        return;
    }

    try {
        await apiFetch('/auth/prefs', { // await pausiert die Funktion, bis das Promise von apiFetch erfüllt ist (Antwort vom Server kommt)
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ themeMode: mode })
        });
    } catch (error) {
        console.warn('Theme konnte nicht gespeichert werden:', error.message || error); // Fehler beim Speichern werden hier abgefangen
    }
}

// Wendet das ausgewählte Theme an
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
        // Ignoriert Probleme beim Speichern
    }

    persistThemePreference(normalizedMode);
}

// Liest das gespeicherte Theme aus dem Local Storage
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

// Initialisiert das Theme basierend auf gespeicherter Einstellung oder System-Theme
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
    startSwipeFlow();
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
    startSwipeFlow();
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

function openSwipeOverlay() {
    if (!swipeOverlay) {
        return;
    }

    swipeOverlay.classList.add('is-open');
    swipeOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('swipe-open');
    swipeOverlay.classList.remove('is-swipe-left', 'is-swipe-right');
}

function closeSwipeOverlay() {
    if (!swipeOverlay) {
        return;
    }

    swipeOverlay.classList.remove('is-open');
    swipeOverlay.classList.remove('is-swipe-left', 'is-swipe-right');
    swipeOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('swipe-open');
}

function shouldAutoStartSwipe() {
    if (!currentUser || adminEnabled) {
        return false;
    }

    if (viewMode !== 'active' || isLocked) {
        return false;
    }

    if (openHottakes.length !== MIN_OPEN_HOTTAKES) {
        return false;
    }

    if (document.body.classList.contains('settings-open') || document.body.classList.contains('legal-open')) {
        return false;
    }

    if (swipeOverlay && swipeOverlay.classList.contains('is-open')) {
        return false;
    }

    const targetGameDay = selectedGameDay ?? activeGameDay?.gameDay ?? null;
    const hasSavedSwipe = lastSubmissionGameDay === targetGameDay &&
        hasCompleteSwipeDecisionsFor(lastSubmissionSwipeDecisions, openHottakes);

    if (hasSavedSwipe) {
        return false;
    }

    return !hasCompleteSwipeDecisions();
}

function isFinalSwipeDecision(decision) {
    // English comment: Only hit/pass count as a final decision. Skip stays "open".
    return decision === 'hit' || decision === 'pass';
}

function getSwipeDecisionMap(decisions = swipeDecisions) {
    const map = new Map();
    const source = Array.isArray(decisions) ? decisions : [];
    source.forEach((entry) => {
        if (!entry || typeof entry.hottakeId !== 'number') {
            return;
        }
        map.set(entry.hottakeId, entry.decision);
    });
    return map;
}

function sortSwipeDecisions() {
    const order = new Map(openHottakes.map((hot, index) => [hot.id, index]));
    swipeDecisions.sort((a, b) => {
        const aIndex = order.has(a.hottakeId) ? order.get(a.hottakeId) : Number.MAX_SAFE_INTEGER;
        const bIndex = order.has(b.hottakeId) ? order.get(b.hottakeId) : Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
    });
}

function upsertSwipeDecision(hottakeId, decision) {
    const existingIndex = swipeDecisions.findIndex((entry) => entry.hottakeId === hottakeId);
    const previousDecision = existingIndex >= 0 ? swipeDecisions[existingIndex].decision : null;
    if (existingIndex >= 0) {
        swipeDecisions[existingIndex].decision = decision;
    } else {
        swipeDecisions.push({ hottakeId, decision });
    }
    sortSwipeDecisions();
    return previousDecision;
}

function revertSwipeDecision(hottakeId, previousDecision) {
    if (previousDecision) {
        upsertSwipeDecision(hottakeId, previousDecision);
        return;
    }

    swipeDecisions = swipeDecisions.filter((entry) => entry.hottakeId !== hottakeId);
}

function hasCompleteSwipeDecisionsFor(decisions, hottakes = openHottakes) {
    if (!Array.isArray(hottakes) || hottakes.length === 0) {
        return false;
    }
    const map = getSwipeDecisionMap(decisions);
    return hottakes.every((hot) => isFinalSwipeDecision(map.get(hot.id)));
}

function hasCompleteSwipeDecisions() {
    return hasCompleteSwipeDecisionsFor(swipeDecisions, openHottakes);
}

function buildSwipeDeck(startHottakeId = null) {
    const decisionMap = getSwipeDecisionMap();
    const openDeck = openHottakes.filter((hot) => !isFinalSwipeDecision(decisionMap.get(hot.id)));
    if (!startHottakeId) {
        return openDeck;
    }

    const startHottake = openDeck.find((hot) => hot.id === startHottakeId) ||
        allHottakes.find((hot) => hot.id === startHottakeId);

    const remaining = openDeck.filter((hot) => hot.id !== startHottakeId);

    if (startHottake) {
        return [startHottake, ...remaining];
    }

    return remaining;
}

function getOpenHottakesCounterText(openCount) {
    if (openCount === 1) {
        return '1 offener Hottake';
    }

    return `${openCount} offene Hottakes`;
}

function getRemainingOpenHottakesCount() {
    if (!Array.isArray(openHottakes) || openHottakes.length === 0) {
        return 0;
    }

    const decisionMap = getSwipeDecisionMap();
    return openHottakes.filter((hot) => !isFinalSwipeDecision(decisionMap.get(hot.id))).length;
}

function renderGameDayInfo(lockTime, diffMs, openCount = 0) {
    if (!gameDayInfo) {
        return;
    }

    const items = [];

    if (!lockTime) {
        gameDayInfo.replaceChildren();
        return;
    }

    const formattedLock = formatDateTime(lockTime);
    const isLockedState = diffMs !== null && diffMs <= 0;

    const remainingOpenCount = typeof openCount === 'number' ? openCount : getRemainingOpenHottakesCount();

    if (isLockedState) {
        rankReadOnlyNotice.textContent = 'Spieltag gesperrt';
        items.push(rankReadOnlyNotice);
    } else {
        lockScheduleNotice.textContent = `Sperre: ${formattedLock}`;
        items.push(lockScheduleNotice);

        if (remainingOpenCount > 0) {
            openHottakesCounter.textContent = getOpenHottakesCounterText(remainingOpenCount);
            items.push(openHottakesCounter);
        }
    }

    gameDayInfo.replaceChildren(...items);
}

function renderSwipeCard() {
    if (!swipeCard || !swipeProgress) {
        return;
    }

    swipeCard.classList.remove('is-swiping-left', 'is-swiping-right');
    swipeCard.style.transform = '';
    if (swipeOverlay) {
        swipeOverlay.classList.remove('is-swipe-left', 'is-swipe-right');
    }
    if (swipeCardBack) {
        swipeCardBack.style.transform = '';
        swipeCardBack.style.opacity = '';
    }

    const current = swipeDeck[swipeIndex];
    const next = swipeDeck[swipeIndex + 1];

    const buildCardContent = (hottake) => {
        const content = document.createElement('div');
        content.className = 'swipe-card-content';

        if (!hottake) {
            content.textContent = 'Alle Hottakes geswiped!';
            return content;
        }

        const text = document.createElement('p');
        text.className = 'swipe-text';
        text.textContent = hottake.text;

        const leftArrow = document.createElement('div');
        leftArrow.className = 'swipe-arrow swipe-arrow--left';
        leftArrow.textContent = '← Passiert nicht';

        const rightArrow = document.createElement('div');
        rightArrow.className = 'swipe-arrow swipe-arrow--right';
        rightArrow.textContent = 'Passiert →';

        const arrowsRow = document.createElement('div');
        arrowsRow.className = 'swipe-arrows';
        arrowsRow.append(leftArrow, rightArrow);

        content.append(text, arrowsRow);
        return content;
    };

    swipeCard.innerHTML = '';
    swipeCard.append(buildCardContent(current));

    if (swipeCardBack) {
        swipeCardBack.innerHTML = '';
        swipeCardBack.append(buildCardContent(next));
    }

    const deckSize = swipeDeck.length;
    swipeProgress.textContent = deckSize
        ? `${Math.min(swipeIndex + 1, deckSize)} / ${deckSize}`
        : '0 / 0';

    if (swipeBackButton) {
        swipeBackButton.disabled = swipeIndex === 0;
        swipeBackButton.classList.toggle('is-hidden', swipeIndex === 0);
    }
}

function finishSwipeFlow() {
    swipeCompleted = hasCompleteSwipeDecisions();
    closeSwipeOverlay();

    if (swipeResetPicksOnFinish) {
        // English comment: After the full swipe flow, keep ranks empty until the user ranks their Top 3.
        picks = Array(RANK_COUNT).fill(null);
        handlePicksChanged();
    }

    renderHottakes();
}

function handleSwipeDecision(decision) {
    if (swipeAnimating) {
        return;
    }

    const current = swipeDeck[swipeIndex];
    if (!current) {
        return;
    }

    const previousDecision = upsertSwipeDecision(current.id, decision);
    swipeSessionHistory.push({ hottakeId: current.id, previousDecision });
    swipeCompleted = hasCompleteSwipeDecisions();
    saveDraftState();
    swipeIndex += 1;

    if (swipeIndex >= swipeDeck.length) {
        finishSwipeFlow();
        return;
    }

    renderSwipeCard();
}

function animateSwipe(decision) {
    if (!swipeCard || !swipeOverlay) {
        handleSwipeDecision(decision);
        return;
    }

    swipeAnimating = true;
    const directionClass = decision === 'hit' ? 'is-swiping-right' : 'is-swiping-left';
    const overlayClass = decision === 'hit' ? 'is-swipe-right' : 'is-swipe-left';

    swipeOverlay.classList.add(overlayClass);
    swipeCard.classList.add(directionClass);

    window.setTimeout(() => {
        swipeCard.classList.remove(directionClass);
        swipeOverlay.classList.remove(overlayClass);
        swipeCard.classList.add('is-resetting');
        swipeCard.style.transform = '';
        window.setTimeout(() => {
            swipeCard.classList.remove('is-resetting');
        }, 0);
        swipeAnimating = false;
        handleSwipeDecision(decision);
    }, 180);
}

function handleSwipeBack() {
    if (swipeAnimating || swipeIndex === 0) {
        return;
    }

    const lastAction = swipeSessionHistory.pop();
    if (lastAction) {
        revertSwipeDecision(lastAction.hottakeId, lastAction.previousDecision);
    } else {
        swipeDecisions.pop();
    }
    swipeCompleted = hasCompleteSwipeDecisions();
    saveDraftState();
    swipeIndex = Math.max(0, swipeIndex - 1);
    renderSwipeCard();
}

function handleSwipeSkip() {
    if (swipeAnimating) {
        return;
    }

    handleSwipeDecision('skip');
}

function exitSwipeOverlay() {
    closeSwipeOverlay();
    renderHottakes();
}

function startSwipeFlow() {
    if (!shouldAutoStartSwipe()) {
        return;
    }

    const hasExistingDecisions = swipeDecisions.length > 0;

    swipeDeck = buildSwipeDeck();
    swipeSessionHistory = [];
    swipeAnimating = false;
    swipeResetPicksOnFinish = true;

    if (!hasExistingDecisions) {
        // English comment: Reset swipe state so each fresh flow starts clean.
        swipeIndex = 0;
        swipeCompleted = false;
        swipeDecisions = [];
        picks = Array(RANK_COUNT).fill(null);
        handlePicksChanged();
    } else {
        sortSwipeDecisions();
        const decisionMap = getSwipeDecisionMap();
        const nextIndex = swipeDeck.findIndex((hot) => !isFinalSwipeDecision(decisionMap.get(hot.id)));
        swipeIndex = nextIndex === -1 ? swipeDeck.length : nextIndex;
        swipeCompleted = hasCompleteSwipeDecisions();
    }

    openSwipeOverlay();
    renderSwipeCard();
}

function resetSwipeFlow() {
    swipeCompleted = false;
    startSwipeFlow();
}

function startSwipeFlowForHottake(hottakeId) {
    if (!currentUser || adminEnabled) {
        return;
    }

    if (viewMode !== 'active' || isLocked) {
        return;
    }

    if (swipeOverlay && swipeOverlay.classList.contains('is-open')) {
        return;
    }

    const deck = buildSwipeDeck(hottakeId);
    if (!deck.length) {
        return;
    }

    swipeDeck = deck;
    swipeIndex = 0;
    swipeAnimating = false;
    swipeSessionHistory = [];
    swipeResetPicksOnFinish = false;
    openSwipeOverlay();
    renderSwipeCard();
}

function handleAutoScroll(event) {
    if (!isDragging) {
        return;
    }

    const clientY = typeof event === 'number' ? event : event?.clientY;
    if (typeof clientY !== 'number') {
        return;
    }

    const margin = 80;
    if (clientY < margin) {
        window.scrollBy(0, -12);
    }
    if (clientY > window.innerHeight - margin) {
        window.scrollBy(0, 12);
    }
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
if (ranksContainer) {
    ranksContainer.appendChild(hottakesNotice);
} else {
    hottakesContainer.appendChild(hottakesNotice);
}

const rankSummary = document.createElement('p');
rankSummary.id = 'rank-summary';
rankSummary.className = 'rank-summary';
if (ranksContainer) {
    ranksContainer.appendChild(rankSummary);
}

const lockScheduleNotice = document.createElement('p');
lockScheduleNotice.id = 'lock-schedule-notice';
lockScheduleNotice.className = 'lock-notice lock-notice--schedule';

const openHottakesCounter = document.createElement('p');
openHottakesCounter.id = 'open-hottakes-counter';
openHottakesCounter.className = 'open-hottakes-counter';

const rankReadOnlyNotice = document.createElement('p');
rankReadOnlyNotice.id = 'rank-readonly-notice';
rankReadOnlyNotice.className = 'lock-notice lock-notice--locked';

const rankHint = null;


const hottakesList = document.createElement('div');
hottakesList.id = 'hottakes-list';
hottakesContainer.appendChild(hottakesList);


const rankSlots = [];


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
        container.appendChild(rankDiv);
        ranksContainer.appendChild(container);
        rankSlots.push(rankDiv);
    }
}


function syncPicksFromRanks() {
    picks = Array(RANK_COUNT).fill(null);
    rankSlots.forEach((slot, index) => {
        const element = slot.querySelector('.hottake');
        if (element) {
            const id = Number(element.dataset.hottakeId);
            if (!Number.isNaN(id)) {
                picks[index] = id;
            }
        }
    });
}

function clearSelections() {
    clearDropHighlights();
    clearSwapIndicators();
    updateTargetAffordance();
}

function updateTargetAffordance() {
    const isTargeting = Boolean(dragState);
    document.body.classList.toggle('is-targeting', isTargeting);
}

function clearSwapIndicators() {
    rankSlots.forEach((slot) => slot.classList.remove('is-swap-target'));
}

function updateSwapIndicatorForRank(rankDiv) {
    clearSwapIndicators();
    if (rankDiv && rankDiv.querySelector('.hottake')) {
        rankDiv.classList.add('is-swap-target');
    }
}

function animateSwapOut(element) {
    if (!element || typeof element.animate !== 'function') {
        return;
    }

    element.animate(
        [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(14px)', opacity: 0.5 }
        ],
        { duration: 180, easing: 'ease-out' }
    );
}

function animateSwapIn(element) {
    if (!element || typeof element.animate !== 'function') {
        return;
    }

    element.animate(
        [
            { transform: 'scale(1.2)' },
            { transform: 'scale(1)' }
        ],
        { duration: 220, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' }
    );
}

function moveHottakeToList(element, sourceParent) {
    if (sourceParent && sourceParent.classList.contains('rank')) {
        const prevIndex = Number(sourceParent.dataset.rank) - 1;
        if (prevIndex >= 0 && prevIndex < picks.length) {
            picks[prevIndex] = null;
        }
    }

    hottakesList.appendChild(element);
    syncPicksFromRanks();
    handlePicksChanged();
}

function moveHottakeToRank(element, rankDiv, sourceParent, hottakeId, originPlaceholder = null, originNextSibling = null) {
    const targetIndex = Number(rankDiv.dataset.rank) - 1;
    if (targetIndex < 0 || targetIndex >= picks.length) {
        return;
    }

    const sourceIndex =
        sourceParent && sourceParent.classList.contains('rank')
            ? Number(sourceParent.dataset.rank) - 1
            : null;

    if (sourceIndex === targetIndex) {
        rankDiv.appendChild(element);
        syncPicksFromRanks();
        return;
    }

    const existing = rankDiv.querySelector('.hottake');
    const existingId = existing ? Number(existing.dataset.hottakeId) : null;
    if (existing && existing !== element) {
        animateSwapOut(existing);
        if (sourceParent && sourceParent.classList.contains('rank')) {
            // English comment: Swap rank↔rank by moving the existing item back to the source slot.
            sourceParent.appendChild(existing);
            animateSwapIn(existing);
        } else if (sourceParent && sourceParent.id === 'hottakes-list') {
            // English comment: Keep list order by inserting into the dragged item's old position.
            if (originPlaceholder && originPlaceholder.parentElement === sourceParent) {
                sourceParent.insertBefore(existing, originPlaceholder);
            } else if (originNextSibling && originNextSibling.parentElement === sourceParent) {
                sourceParent.insertBefore(existing, originNextSibling);
            } else {
                sourceParent.appendChild(existing);
            }
        } else {
            hottakesList.appendChild(existing);
        }
    }

    if (sourceIndex !== null && sourceIndex >= 0 && sourceIndex < picks.length) {
        picks[sourceIndex] = existingId ?? null;
    }

    rankDiv.appendChild(element);
    animateSwapIn(element);

    for (let i = 0; i < picks.length; i += 1) {
        if (i !== targetIndex && picks[i] === hottakeId) {
            picks[i] = null;
        }
    }

    picks[targetIndex] = hottakeId;
}


function beginHottakeDrag({ element, hottakeId, clientX, clientY, inputType = 'mouse', touchId = null }) {
    if (dragState || viewMode !== 'active' || isLocked) {
        return;
    }

    clearSelections();

    const rect = element.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    const placeholder = document.createElement('div');
    placeholder.className = 'hottake-placeholder';
    placeholder.style.height = `${rect.height}px`;
    placeholder.style.width = `${rect.width}px`;

    const originParent = element.parentElement;
    const originNextSibling = element.nextSibling;

    if (originParent) {
        originParent.insertBefore(placeholder, element);
    }

    element.classList.add('is-dragging');
    element.style.width = `${rect.width}px`;
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.position = 'fixed';
    element.style.zIndex = '999';
    element.style.pointerEvents = 'none';

    document.body.appendChild(element);

    dragState = {
        element,
        hottakeId,
        offsetX,
        offsetY,
        baseLeft: rect.left,
        baseTop: rect.top,
        originParent,
        originNextSibling,
        placeholder,
        inputType,
        touchId,
        activeDropTarget: null,
        activeSwapTarget: null,
        pendingPoint: { x: clientX, y: clientY }
    };

    isDragging = true;
    document.body.classList.add('is-dragging');
    updateTargetAffordance();
    updateDragPosition(clientX, clientY);
}

function updateDragPosition(clientX, clientY) {
    if (!dragState) {
        return;
    }

    dragState.pendingPoint = { x: clientX, y: clientY };

    if (dragFrameId !== null) {
        return;
    }

    dragFrameId = window.requestAnimationFrame(() => {
        dragFrameId = null;
        if (!dragState) {
            return;
        }

        const { x, y } = dragState.pendingPoint;
        const translateX = x - dragState.offsetX - dragState.baseLeft;
        const translateY = y - dragState.offsetY - dragState.baseTop;
        dragState.element.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;

        handleAutoScroll(y);

        const target = document.elementFromPoint(x, y);
        const rankTarget = target ? target.closest('.rank') : null;
        const listTarget = target ? target.closest('#hottakes-list') : null;
        const hottakeTarget = target ? target.closest('.hottake') : null;
        setActiveDropTarget(rankTarget || listTarget, hottakeTarget);
    });
}

function clearDropHighlights() {
    rankSlots.forEach((slot) => slot.classList.remove('is-dragover'));
    hottakesList.classList.remove('is-dragover');
    document.querySelectorAll('.hottake.is-drop-target').forEach((item) => {
        item.classList.remove('is-drop-target');
    });
}

function setActiveDropTarget(target, hottakeTarget) {
    if (!dragState) {
        return;
    }

    if (dragState.activeDropTarget === target && dragState.activeSwapTarget === hottakeTarget) {
        return;
    }

    clearDropHighlights();

    if (target) {
        if (target.classList.contains('rank')) {
            target.classList.add('is-dragover');
            updateSwapIndicatorForRank(target);
        } else if (target.id === 'hottakes-list') {
            const originIsList = dragState.originParent && dragState.originParent.id === 'hottakes-list';
            if (!originIsList) {
                target.classList.add('is-dragover');
            }
            clearSwapIndicators();
        }
    } else {
        clearSwapIndicators();
    }

    dragState.activeDropTarget = target;
    dragState.activeSwapTarget = null;

    if (hottakeTarget && hottakeTarget.classList.contains('hottake')) {
        const parentList = hottakeTarget.parentElement;
        if (parentList && parentList.id === 'hottakes-list' && hottakeTarget !== dragState.element) {
            hottakeTarget.classList.add('is-drop-target');
            dragState.activeSwapTarget = hottakeTarget;
        }
    }
}

function placeHottakeInList(element, sourceParent) {
    moveHottakeToList(element, sourceParent);
}

function placeHottakeInRank(element, rankDiv, sourceParent, hottakeId, originPlaceholder = null, originNextSibling = null) {
    moveHottakeToRank(element, rankDiv, sourceParent, hottakeId, originPlaceholder, originNextSibling);
    syncPicksFromRanks();
    handlePicksChanged();
}

function finishHottakeDrag(clientX, clientY) {
    if (!dragState) {
        return;
    }

    const { element, originParent, originNextSibling, placeholder } = dragState;

    const target = document.elementFromPoint(clientX, clientY);
    const rankTarget = target ? target.closest('.rank') : null;
    const listTarget = target ? target.closest('#hottakes-list') : null;
    const hottakeTarget = target ? target.closest('.hottake') : null;

    if (rankTarget) {
        placeHottakeInRank(
            element,
            rankTarget,
            originParent,
            dragState.hottakeId,
            dragState.placeholder,
            dragState.originNextSibling
        );
    } else if (hottakeTarget && hottakeTarget.parentElement && hottakeTarget.parentElement.id === 'hottakes-list' && hottakeTarget !== element) {
        swapHottakeWithListItem(element, hottakeTarget, originParent, placeholder);
    } else if (listTarget) {
        if (originParent && originParent.classList.contains('rank')) {
            // English comment: Keep ranks filled; only allow swaps with list items.
        } else {
            placeHottakeInList(element, originParent);
        }
    } else if (originParent) {
        const originRect = placeholder?.getBoundingClientRect();
        const currentRect = element.getBoundingClientRect();
        if (originRect) {
            const deltaX = originRect.left - currentRect.left;
            const deltaY = originRect.top - currentRect.top;
            const snapAnimation = element.animate(
                [
                    { transform: 'translate(0, 0)' },
                    { transform: `translate(${deltaX}px, ${deltaY}px)` }
                ],
                { duration: 300, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' }
            );

            snapAnimation.onfinish = () => {
                if (originNextSibling) {
                    originParent.insertBefore(element, originNextSibling);
                } else {
                    originParent.appendChild(element);
                }
                cleanupDragState(element, placeholder);
            };

            dragState = null;
            return;
        }

        if (originNextSibling) {
            originParent.insertBefore(element, originNextSibling);
        } else {
            originParent.appendChild(element);
        }
    }

    cleanupDragState(element, placeholder);
}

function cleanupDragState(element, placeholder) {
    if (placeholder && placeholder.parentElement) {
        placeholder.remove();
    }

    clearDropHighlights();
    clearSwapIndicators();
    element.classList.remove('is-dragging');
    element.style.position = '';
    element.style.left = '';
    element.style.top = '';
    element.style.width = '';
    element.style.zIndex = '';
    element.style.pointerEvents = '';
    element.style.transform = '';

    dragState = null;
    isDragging = false;
    document.body.classList.remove('is-dragging');
    updateTargetAffordance();
}

function swapHottakeWithListItem(element, targetItem, originParent, placeholder) {
    if (!originParent) {
        return;
    }

    const targetParent = targetItem.parentElement;
    if (!targetParent || targetParent.id !== 'hottakes-list') {
        return;
    }

    // English comment: Insert dragged item first while the target still sits in the list.
    targetParent.insertBefore(element, targetItem);

    if (originParent.classList.contains('rank')) {
        // English comment: Move the list item into the original rank slot.
        originParent.appendChild(targetItem);
    } else if (placeholder && placeholder.parentElement === originParent) {
        // English comment: Return the list item to the dragged item's old position.
        originParent.insertBefore(targetItem, placeholder);
    } else {
        originParent.appendChild(targetItem);
    }

    animateSwapOut(targetItem);
    animateSwapIn(element);
    syncPicksFromRanks();
    handlePicksChanged();
}

function swapRankWithListItemClick(rankItem, listItem, rankParent) {
    const targetParent = listItem?.parentElement;
    if (!targetParent || targetParent.id !== 'hottakes-list') {
        return;
    }

    // English comment: Swap rank item with a list item on click.
    targetParent.insertBefore(rankItem, listItem);
    rankParent.appendChild(listItem);
    animateSwapOut(listItem);
    animateSwapIn(rankItem);
    syncPicksFromRanks();
    handlePicksChanged();
}

function swapListItemsInList(element, targetItem) {
    const parent = element?.parentElement;
    if (!parent || parent.id !== 'hottakes-list' || targetItem?.parentElement !== parent) {
        return;
    }

    // English comment: Swap positions of two list items without affecting rank picks.
    const marker = document.createElement('span');
    marker.style.display = 'none';
    parent.insertBefore(marker, element);
    parent.insertBefore(element, targetItem);
    parent.insertBefore(targetItem, marker);
    marker.remove();
    animateSwapOut(targetItem);
    animateSwapIn(element);
}

function cancelHottakeDrag() {
    if (!dragState) {
        return;
    }

    const { element, originParent, originNextSibling, placeholder } = dragState;

    if (originParent) {
        if (originNextSibling) {
            originParent.insertBefore(element, originNextSibling);
        } else {
            originParent.appendChild(element);
        }
    }

    cleanupDragState(element, placeholder);
}

function showRankSummary(message, ms = 2500) {
    if (!rankSummary) {
        return;
    }

    rankSummary.textContent = message;
    rankSummary.classList.add('is-visible');

    window.setTimeout(() => {
        rankSummary.classList.remove('is-visible');
    }, ms);
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
    // Internal UI state:
    // - active: user can edit picks (if not locked and rules allow)
    // - readonly: UI is read-only (finished game days)
    const isReadOnlyMode = viewMode !== 'active';
    const selectedMeta = getSelectedGameDayMeta();
    // Only FINALIZED/ARCHIVED should behave like a finished day (read-only + locked).
    // PENDING is a future day and should still allow picks (as long as lockTime not reached).
    const finalized = selectedMeta
        ? [GAME_DAY_STATUS.FINALIZED, GAME_DAY_STATUS.ARCHIVED].includes(selectedMeta.status)
        : false;
    const hasExactOpen = openHottakes.length === MIN_OPEN_HOTTAKES;
    const hasSwipeDecisions = viewMode !== 'active' || hasCompleteSwipeDecisions();
    const isReadOnlyState = isLocked || isReadOnlyMode || finalized;
    const blocked = isReadOnlyState || !hasExactOpen || !hasSwipeDecisions;

    // Prüfe, ob es ein zukünftiger Spieltag ohne Hottakes ist
    const isFutureWithoutHottakes = selectedMeta && 
        selectedMeta.lockTime && 
        new Date(selectedMeta.lockTime).getTime() > Date.now() && 
        openHottakes.length === 0;

    document.body.classList.toggle('picks-locked', isLocked || finalized);

    if (isReadOnlyState) {
        closeSwipeOverlay();
        clearSelections();
    }

    if (savePicksButton) {
        const isBusy = isSavingSubmission;
        savePicksButton.disabled = blocked;
        // Hide the save button whenever picks must not be editable (readonly / locked / finalized).
        // The server also enforces rules, but UI should make the allowed actions obvious.
        if (isReadOnlyState || adminEnabled || !hasExactOpen) {
            savePicksButton.style.display = 'none';
        } else {
            savePicksButton.style.display = 'inline-block';
            if (!isBusy) {
                savePicksButton.textContent = 'Picks Speichern';
            }
        }
        if (isBusy) {
            savePicksButton.disabled = true;
        }
    }

    if (hottakesNotice) {
        if (isFutureWithoutHottakes) {
            // Zukünftiger Spieltag ohne Hottakes
            hottakesNotice.textContent = 'Es gibt noch keine Hottakes für diesen Spieltag.';
            hottakesNotice.classList.add('is-visible');
        } else if (isLocked) {
            hottakesNotice.textContent = '';
            hottakesNotice.classList.remove('is-visible');
        } else if (!hasExactOpen) {
            // Nicht genug offene Hottakes
            hottakesNotice.textContent = `Es müssen genau ${MIN_OPEN_HOTTAKES} Hottakes offen sein. Aktuell: ${openHottakes.length}.`;
            hottakesNotice.classList.add('is-visible');
        } else {
            hottakesNotice.textContent = '';
            hottakesNotice.classList.remove('is-visible');
        }
    }
}


function updateLockBanner(lockTime, diffMs, openCount = 0) {
    if (!lockStatus || !lockCountdown) {
        return;
    }

    if (!lockTime) {
        lockStatus.textContent = 'Kein aktiver Spieltag';
        lockCountdown.textContent = 'Countdown inaktiv';
        lockCountdown.dataset.state = 'idle';
        renderGameDayInfo(null, null, getRemainingOpenHottakesCount());
        return;
    }

    // Wenn diffMs <= 0, ist der Spieltag bereits gesperrt (läuft oder ist vorbei)
    if (diffMs !== null && diffMs <= 0) {
        lockStatus.textContent = '';
        lockCountdown.textContent = '';
        lockCountdown.dataset.state = 'locked';
    } else {
        // Spieltag noch offen, Countdown läuft
        lockStatus.textContent = '';
        lockCountdown.textContent = diffMs === null ? 'Countdown inaktiv' : `Noch ${formatDuration(diffMs)}`;
        lockCountdown.dataset.state = 'open';
    }

    renderGameDayInfo(lockTime, diffMs, getRemainingOpenHottakesCount());
}


function refreshLockState() {
    stopLockCountdown();

    const selectedMeta = getSelectedGameDayMeta();

    if (!selectedMeta) {
        isLocked = false;
        updateLockBanner(null, null, openHottakes.length);
        applyLockStateUI();
        return;
    }

    // FINALIZED/ARCHIVED: always locked.
    if ([GAME_DAY_STATUS.FINALIZED, GAME_DAY_STATUS.ARCHIVED].includes(selectedMeta.status)) {
        isLocked = true;
        updateLockBanner(selectedMeta.lockTime || null, 0, openHottakes.length);
        applyLockStateUI();
        return;
    }

    // ACTIVE and PENDING behave the same for locking: locked only after lockTime.
    // (PENDING is in the future; before lockTime it must NOT show as locked.)

    if (!selectedMeta.lockTime) {
        isLocked = false;
        updateLockBanner(null, null, openHottakes.length);
        applyLockStateUI();
        return;
    }

    const lockTime = new Date(selectedMeta.lockTime);

    const update = () => {
        const diffMs = lockTime.getTime() - Date.now();
        isLocked = diffMs <= 0;
        updateLockBanner(lockTime, diffMs, openHottakes.length);
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
            resetAutoSaveState(selectedGameDay);
            updateHistorySelect();
        }
    } catch (error) {
        activeGameDay = null;
        console.warn('Aktueller Spieltag konnte nicht geladen werden.', error.message || error);
    }

    refreshLockState();
}


// Note: "active" vs "readonly" is derived from the selected game day's status.
// Older UI toggles were removed from the HTML.

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
        resetAutoSaveState(value);
        await refreshHottakes(value);
        await loadSubmissionForCurrentUser(value, viewMode === 'readonly');
        await drawLeaderboard();
        refreshLockState();
        renderHottakes();
    });

    if (gameDayActions) {
        gameDayActions.appendChild(historySelect);
    } else if (gameDayBanner) {
        gameDayBanner.appendChild(historySelect);
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
        const isActive = day.status === GAME_DAY_STATUS.ACTIVE;
        const suffix = isActive ? ' (aktiv)' : '';
        option.textContent = day.description ? `${day.description}${suffix}` : `Spieltag ${day.gameDay}${suffix}`;
        select.appendChild(option);
    });

    if (selectedGameDay === null && gameDays.length > 0) {
        const currentId = activeGameDay?.gameDay;
        selectedGameDay = currentId ?? gameDays[0].gameDay;
        selectedHistoryGameDay = selectedGameDay;
        resetAutoSaveState(selectedGameDay);
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

    if (leaderboardHeader) {
        leaderboardHeader.appendChild(leaderboardSelect);
    }

    return leaderboardSelect;
}

function updateLeaderboardSelect() {
    const select = ensureLeaderboardSelect();
    select.innerHTML = '';

    const globalOption = document.createElement('option');
    globalOption.value = 'all';
    globalOption.textContent = 'Gesamtansicht';
    select.appendChild(globalOption);

    // Leaderboard per game day only makes sense for finished game days.
    // - PENDING: not started / no meaningful leaderboard
    // - ACTIVE: still running, use Gesamtansicht instead
    // - ARCHIVED: hidden from the public leaderboard selection
    const selectableDays = gameDays.filter((day) => 
        [GAME_DAY_STATUS.FINALIZED, GAME_DAY_STATUS.ACTIVE].includes(day.status)
    );

    selectableDays.forEach((day) => {
        const option = document.createElement('option');
        const isActive = day.status === GAME_DAY_STATUS.ACTIVE;
        const suffix = isActive ? ' (aktiv)' : '';
        option.value = String(day.gameDay);
        option.textContent = day.description ? `${day.description}${suffix}` : `Spieltag ${day.gameDay}${suffix}`;
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

function canUseDrafts() {
    return viewMode === 'active' && !isLocked;
}

function getDraftStorageKey() {
    const userKey = currentUser?.id ?? 'guest';
    const gameDayKey = selectedGameDay ?? activeGameDay?.gameDay ?? 'active';
    return `${DRAFT_STORAGE_PREFIX}:${userKey}:${gameDayKey}`;
}

function saveDraftState() {
    if (!canUseDrafts()) {
        return;
    }

    const key = getDraftStorageKey();
    const payload = {
        picks: picks.slice(0, RANK_COUNT),
        swipeDecisions: swipeDecisions.slice(),
        timestamp: Date.now()
    };

    try {
        localStorage.setItem(key, JSON.stringify(payload));
    } catch (_error) {
        // English comment: Ignore storage failures (private mode, quota, etc.).
    }
}

function clearDraftState() {
    const key = getDraftStorageKey();
    try {
        localStorage.removeItem(key);
    } catch (_error) {
        // English comment: Ignore storage failures (private mode, quota, etc.).
    }
}

function loadDraftState(allowedHottakes = openHottakes) {
    if (!canUseDrafts()) {
        return;
    }

    if (!picks.every((entry) => entry === null) || swipeDecisions.length > 0) {
        return;
    }

    const key = getDraftStorageKey();
    let raw = null;
    try {
        raw = localStorage.getItem(key);
    } catch (_error) {
        return;
    }

    if (!raw) {
        return;
    }

    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch (_error) {
        return;
    }

    if (!parsed || typeof parsed !== 'object') {
        return;
    }

    const validIds = new Set((allowedHottakes || []).map((hot) => hot.id));
    const nextPicks = Array.isArray(parsed.picks)
        ? parsed.picks.slice(0, RANK_COUNT).map((id) => (typeof id === 'number' && validIds.has(id) ? id : null))
        : Array(RANK_COUNT).fill(null);

    const nextDecisions = Array.isArray(parsed.swipeDecisions)
        ? parsed.swipeDecisions.filter((entry) => {
              if (!entry || typeof entry !== 'object') {
                  return false;
              }
              if (typeof entry.hottakeId !== 'number' || !validIds.has(entry.hottakeId)) {
                  return false;
              }
              return entry.decision === 'hit' || entry.decision === 'pass' || entry.decision === 'skip';
          })
        : [];

    picks = nextPicks;
    swipeDecisions = nextDecisions;
    sortSwipeDecisions();

    const allowedList = Array.isArray(allowedHottakes) ? allowedHottakes : [];
    const decisionMap = getSwipeDecisionMap(nextDecisions);
    swipeCompleted = allowedList.length > 0 && allowedList.every((hot) => isFinalSwipeDecision(decisionMap.get(hot.id)));
    swipeIndex = swipeCompleted ? allowedList.length : 0;
}

function resetAutoSaveState(nextGameDay = null) {
    autoSaveHasSavedOnce = false;
    autoSaveGameDay = nextGameDay;
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
    }
}

function areRanksFilled() {
    return picks.every((entry) => entry !== null);
}

function hasSubmissionChanged() {
    for (let i = 0; i < RANK_COUNT; i += 1) {
        const savedId = typeof lastSubmissionPicks?.[i] === 'number' ? lastSubmissionPicks[i] : null;
        if (savedId !== picks[i]) {
            return true;
        }
    }

    if (lastSubmissionSwipeDecisions?.length !== swipeDecisions.length) {
        return true;
    }

    for (let i = 0; i < swipeDecisions.length; i += 1) {
        const savedEntry = lastSubmissionSwipeDecisions[i];
        const currentEntry = swipeDecisions[i];
        if (!savedEntry || !currentEntry) {
            return true;
        }
        if (savedEntry.hottakeId !== currentEntry.hottakeId || savedEntry.decision !== currentEntry.decision) {
            return true;
        }
    }

    return false;
}

function canAutoSaveNow() {
    if (viewMode !== 'active') {
        return false;
    }

    if (isLocked || selectedGameDay === null) {
        return false;
    }

    if (openHottakes.length !== MIN_OPEN_HOTTAKES) {
        return false;
    }

    if (!hasCompleteSwipeDecisions()) {
        return false;
    }

    if (!areRanksFilled()) {
        return false;
    }

    if (!currentUser) {
        return false;
    }

    return true;
}

function triggerAutoSave() {
    if (!canAutoSaveNow()) {
        return;
    }

    if (isSavingSubmission || !hasSubmissionChanged()) {
        return;
    }

    saveSubmission({ silent: true, source: 'auto' });
}

function scheduleAutoSave({ immediate = false } = {}) {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
    }

    if (immediate) {
        triggerAutoSave();
        return;
    }

    autoSaveTimer = window.setTimeout(() => {
        autoSaveTimer = null;
        triggerAutoSave();
    }, AUTO_SAVE_DEBOUNCE_MS);
}

function handlePicksChanged() {
    saveDraftState();

    if (autoSaveGameDay !== selectedGameDay) {
        resetAutoSaveState(selectedGameDay);
    }

    if (!autoSaveHasSavedOnce && areRanksFilled()) {
        autoSaveHasSavedOnce = true;
        scheduleAutoSave({ immediate: true });
        return;
    }

    if (autoSaveHasSavedOnce) {
        scheduleAutoSave();
    }
}

function showAutoSaveToast() {
    if (!autoSaveToast) {
        return;
    }

    autoSaveToast.classList.add('is-visible');

    if (autoSaveToastTimer) {
        clearTimeout(autoSaveToastTimer);
    }

    autoSaveToastTimer = window.setTimeout(() => {
        autoSaveToast.classList.remove('is-visible');
        autoSaveToastTimer = null;
    }, 1000);
}


function createHottakeElement(hottake, { readonly = false, picked = false, decision = null } = {}) {
    const element = document.createElement('p');
    element.textContent = '';

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';

    const textSpan = document.createElement('span');
    textSpan.className = 'hottake-text';
    textSpan.textContent = hottake.text;

    const statusClass = STATUS_BADGE_CLASS[hottake.status] || 'is-open';
    element.className = `hottake ${statusClass}`;
    if (readonly) {
        element.classList.add('is-readonly');
    }

    if (decision === 'hit') {
        element.classList.add('is-swipe-hit');
    } else if (decision === 'pass') {
        element.classList.add('is-swipe-pass');
    }

    if (picked) {
        element.classList.add('is-picked');
    }

    element.draggable = false;
    element.dataset.hottakeId = String(hottake.id);
    if (!readonly && !isLocked) {
        handle.draggable = false;
        const startGesture = (event, inputType) => {
            if (viewMode !== 'active' || isLocked) {
                return;
            }
            if (inputType === 'mouse' && event.button !== 0) {
                return;
            }

            if (pendingGesture?.holdTimer) {
                window.clearTimeout(pendingGesture.holdTimer);
            }

            const point = inputType === 'touch' ? event.touches[0] : event;
            const touchId = inputType === 'touch' ? point.identifier : null;

            pendingGesture = {
                element,
                hottakeId: hottake.id,
                startX: point.clientX,
                startY: point.clientY,
                lastX: point.clientX,
                lastY: point.clientY,
                startTime: Date.now(),
                inputType,
                touchId,
                holdTimer: window.setTimeout(() => {
                    if (!pendingGesture || dragState) {
                        return;
                    }
                    beginHottakeDrag({
                        element: pendingGesture.element,
                        hottakeId: pendingGesture.hottakeId,
                        clientX: pendingGesture.lastX,
                        clientY: pendingGesture.lastY,
                        inputType: pendingGesture.inputType,
                        touchId: pendingGesture.touchId
                    });
                    pendingGesture = null;
                }, LONG_PRESS_MS)
            };
        };

        handle.addEventListener('touchstart', (event) => startGesture(event, 'touch'), { passive: true });
        element.addEventListener('touchstart', (event) => startGesture(event, 'touch'), { passive: true });
        handle.addEventListener('mousedown', (event) => startGesture(event, 'mouse'));
        element.addEventListener('mousedown', (event) => startGesture(event, 'mouse'));
    }

    element.addEventListener('click', () => {
        if (viewMode !== 'active' || isLocked || adminEnabled) {
            return;
        }
        if (!currentUser) {
            return;
        }
        if (dragState || isDragging) {
            return;
        }
        if (Date.now() - lastDragAt < 250) {
            return;
        }
        startSwipeFlowForHottake(hottake.id);
    });

    element.append(handle, textSpan);
    return element;
}


function renderHottakes() {
    clearSelections();
    const isReadOnly = viewMode !== 'active' || isLocked;
    const useSavedPicks = isReadOnly;
    const availableHottakes = isLocked
        ? openHottakes
        : viewMode !== 'active'
            ? allHottakes
            : openHottakes;
    const sanitizeSource = availableHottakes;
    const referencePicks = useSavedPicks ? lastSubmissionPicks : picks;

    sanitizePicks(sanitizeSource);
    hottakesList.innerHTML = '';
    rankSlots.forEach((slot) => {
        slot.innerHTML = '';
    });

    const hasExactOpen = openHottakes.length === MIN_OPEN_HOTTAKES;
    if (viewMode === 'active' && !isLocked && !hasExactOpen) {
        hottakesNotice.textContent = `Es müssen genau ${MIN_OPEN_HOTTAKES} Hottakes offen sein. Aktuell verfügbar: ${openHottakes.length}.`;
        hottakesNotice.classList.add('is-visible');
    } else if (!isLocked) {
        hottakesNotice.textContent = '';
        hottakesNotice.classList.remove('is-visible');
    }

    const decisionMap = getSwipeDecisionMap();
    const elements = new Map();

    availableHottakes.forEach((hottake) => {
        const element = createHottakeElement(hottake, {
            readonly: isReadOnly,
            picked: referencePicks.includes(hottake.id),
            decision: decisionMap.get(hottake.id) || null
        });
        elements.set(hottake.id, element);
    });

    referencePicks.forEach((id, index) => {
        if (typeof id !== 'number') {
            return;
        }
        const element = elements.get(id);
        if (!element || !rankSlots[index]) {
            return;
        }
        rankSlots[index].appendChild(element);
        elements.delete(id);
    });

    availableHottakes.forEach((hottake) => {
        const element = elements.get(hottake.id);
        if (element) {
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

        if (gameDay !== autoSaveGameDay) {
            resetAutoSaveState(gameDay);
        }

        if (gameDay !== swipeGameDay) {
            // English comment: Reset swipe completion when switching game days.
            swipeGameDay = gameDay;
            const hasStoredSwipe = lastSubmissionGameDay === gameDay &&
                Array.isArray(lastSubmissionSwipeDecisions) &&
                lastSubmissionSwipeDecisions.length > 0;

            if (hasStoredSwipe) {
                swipeDecisions = lastSubmissionSwipeDecisions.slice();
                sortSwipeDecisions();
            } else {
                swipeDecisions = [];
            }
        }

        // Only finished days should force readonly. Future (PENDING) days are still editable.
        if (meta && [GAME_DAY_STATUS.FINALIZED, GAME_DAY_STATUS.ARCHIVED].includes(meta.status)) {
            viewMode = 'readonly';
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
        refreshLockState();
        loadDraftState(openHottakes);
        swipeCompleted = hasCompleteSwipeDecisions();
        renderHottakes();
        startSwipeFlow();
    } catch (error) {
        console.error(error);
        hottakesList.innerHTML = '<p>Fehler beim Laden der Hottakes.</p>';
    }
}


async function drawLeaderboard(targetGameDay = null) {
    const requestToken = ++leaderboardRequestToken;
    if (leaderboardList) {
        leaderboardList.innerHTML = '';
    }
    const selection = leaderboardSelection === null ? 'all' : leaderboardSelection;
    const gameDayParam = targetGameDay !== null ? targetGameDay : selection;

    if (gameDayParam === null || gameDayParam === undefined) {
        const row = document.createElement('p');
        row.textContent = 'Kein Spieltag ausgewählt.';
        leaderboardList.appendChild(row);
        return;
    }

    try {
        const param = gameDayParam === 'all' ? 'all' : encodeURIComponent(gameDayParam);
        const response = await apiFetch(`/leaderboard?gameDay=${param}`);
        const entries = Array.isArray(response) ? response : [];

        if (requestToken !== leaderboardRequestToken) {
            return;
        }

        // Deduplicate by nickname and score (robust against API duplicates)
        const seen = new Set();
        const deduped = [];
        for (const entry of entries) {
            const key = `${entry.nickname}|${entry.score}`;
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(entry);
            }
        }
        deduped.sort((a, b) => b.score - a.score);

        if (deduped.length === 0) {
            const emptyRow = document.createElement('p');
            emptyRow.textContent = 'Noch keine Scores.';
            leaderboardList.appendChild(emptyRow);
            return;
        }

        deduped.forEach((entry, index) => {
            const row = document.createElement('p');
            row.textContent = `${index + 1}. ${entry.nickname}: ${entry.score} Punkte`;
            leaderboardList.appendChild(row);
        });
    } catch (error) {
        console.error(error);
        const row = document.createElement('p');
        row.textContent = 'Fehler beim Laden des Leaderboards.';
        leaderboardList.appendChild(row);
    }
}


async function loadSubmissionForCurrentUser(gameDay = null, isReadOnly = false) {
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

        lastSubmissionSwipeDecisions = submission && Array.isArray(submission.swipeDecisions)
            ? submission.swipeDecisions
            : [];
        lastSubmissionGameDay = submission ? targetGameDay : null;

        const hasStoredSwipe = lastSubmissionGameDay === targetGameDay &&
            Array.isArray(lastSubmissionSwipeDecisions) &&
            lastSubmissionSwipeDecisions.length > 0;
        if (hasStoredSwipe) {
            swipeDecisions = lastSubmissionSwipeDecisions.slice();
            sortSwipeDecisions();
            swipeCompleted = hasCompleteSwipeDecisionsFor(lastSubmissionSwipeDecisions, openHottakes);
            swipeGameDay = targetGameDay;
        } else {
            swipeDecisions = [];
            swipeCompleted = false;
        }

        if (submission && Array.isArray(submission.picks)) {
            submission.picks.slice(0, RANK_COUNT).forEach((id, index) => {
                if (typeof id === 'number') {
                    nextPicks[index] = id;
                }
            });
        }

        if (isReadOnly) {
            swipeDecisions = lastSubmissionSwipeDecisions.slice();
            sortSwipeDecisions();
            renderHottakes();
        } else {
            picks = nextPicks;
            renderHottakes();
        }
    } catch (error) {
        alert(error.message);
    }
}


async function saveSubmission({ silent = false, source = 'manual' } = {}) {
    // Safety guard: In the current UI, the save button should not be visible/clickable in readonly mode.
    if (viewMode !== 'active') return;

    if (isSavingSubmission) {
        return;
    }

    if (selectedGameDay === null) {
        if (!silent) {
            alert('Es ist kein Spieltag ausgewählt.');
        }
        return;
    }

    if (isLocked) {
        if (!silent) {
            alert('Die Picks sind gesperrt. Der Spieltag hat bereits begonnen.');
        }
        return;
    }

    if (openHottakes.length !== MIN_OPEN_HOTTAKES) {
        if (!silent) {
            alert(`Es müssen genau ${MIN_OPEN_HOTTAKES} Hottakes offen sein, um zu tippen.`);
        }
        return;
    }

    if (!hasCompleteSwipeDecisions()) {
        if (!silent) {
            alert('Bitte entscheide alle Hottakes im Swipe-Modus.');
        }
        return;
    }

    if (picks.some((entry) => entry === null)) {
        if (!silent) {
            alert('Bitte wähle alle 3 Hottakes aus, bevor du speicherst.');
        }
        return;
    }

    if (!currentUser) {
        if (!silent) {
            alert('Bitte melde dich zuerst an.');
        }
        return;
    }

    if (silent && !hasSubmissionChanged()) {
        return;
    }

    const previousLabel = savePicksButton?.textContent;
    if (savePicksButton && !silent) {
        savePicksButton.dataset.busy = 'true';
        savePicksButton.disabled = true;
        savePicksButton.textContent = 'Speichert...';
    }

    isSavingSubmission = true;

    try {
        await apiFetch(`/submissions?gameDay=${encodeURIComponent(selectedGameDay)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ picks, swipeDecisions })
        });

        lastSubmissionPicks = picks.slice(0, RANK_COUNT);
        lastSubmissionSwipeDecisions = swipeDecisions.slice();
        lastSubmissionGameDay = selectedGameDay;
        clearDraftState();

        if (!silent) {
            alert('Deine Picks wurden gespeichert.');
            await drawLeaderboard();
        } else if (source === 'auto') {
            showAutoSaveToast();
        }
    } catch (error) {
        if (!silent) {
            alert(error.message);
        } else {
            console.warn('Auto-save fehlgeschlagen.', error);
        }
    } finally {
        isSavingSubmission = false;
        if (savePicksButton && !silent) {
            savePicksButton.dataset.busy = 'false';
            savePicksButton.textContent = previousLabel || 'Picks Speichern';
        }
        applyLockStateUI();
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
    textLabel.textContent = 'Beschreibung';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.name = 'text';
    textInput.placeholder = 'Beschreibe deinen Hottake...';
    textInput.required = true;
    textInput.maxLength = 280;
    textLabel.appendChild(textInput);

    const statusHint = document.createElement('p');
    statusHint.className = 'admin-form-hint';
    statusHint.textContent = 'Neue Hottakes starten immer mit dem Status Offen.';

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Hottake speichern';

    const targetMeta = getSelectedGameDayMeta();
    // Allow creating hottakes for upcoming (PENDING) and current (ACTIVE) game days.
    const targetInactive =
        !targetMeta || ![GAME_DAY_STATUS.PENDING, GAME_DAY_STATUS.ACTIVE].includes(targetMeta.status);
    if (targetInactive) {
        const warn = document.createElement('p');
        warn.className = 'admin-form-hint';
        warn.textContent = 'Wähle einen zukünftigenSpieltag, um Hottakes anzulegen.';
        form.appendChild(warn);
    }

    submitButton.disabled = targetInactive;

    form.append(textLabel, statusHint, submitButton);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const text = textInput.value.trim();
        if (text.length < 3) {
            showAdminMessage('Der Text muss mindestens 3 Zeichen lang sein.', 'error');
            textInput.focus();
            return;
        }

        if (selectedGameDay === null) {
            showAdminMessage('Bitte wähle zuerst einen Spieltag.', 'error');
            return;
        }

        const payload = { text, gameDay: selectedGameDay };

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

    const selectorWrap = document.createElement('div');
    selectorWrap.className = 'admin-form admin-form--stacked';

    const selectLabel = document.createElement('label');
    selectLabel.className = 'admin-form-label';
    

    const select = document.createElement('select');
    select.className = 'admin-select';
    select.name = 'selectedGameDay';

    if (!Array.isArray(gameDays) || gameDays.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Kein Spieltag vorhanden';
        select.appendChild(opt);
        select.disabled = true;
    } else {
        gameDays.forEach((day) => {
            const option = document.createElement('option');
            option.value = String(day.gameDay);
            const statusLabel =
                day.status === GAME_DAY_STATUS.ACTIVE
                    ? ' (aktiv)'
                    : '';
            option.textContent = day.description ? `${day.description}${statusLabel}` : `Spieltag ${day.gameDay}${statusLabel}`;
            select.appendChild(option);
        });

        if (selectedGameDay !== null) {
            select.value = String(selectedGameDay);
        }
    }

    select.addEventListener('change', async (event) => {
        const value = Number.parseInt(event.target.value, 10);
        if (Number.isNaN(value)) {
            return;
        }
        selectedGameDay = value;
        selectedHistoryGameDay = value;
        await refreshHottakes(value);
        await loadSubmissionForCurrentUser(value, viewMode === 'readonly');
        await drawLeaderboard(value);
        refreshLockState();
        updateHistorySelect();
        renderHottakes();
        renderGameDayAdmin();
    });

    selectLabel.appendChild(select);
    selectorWrap.appendChild(selectLabel);
    adminGameDay.appendChild(selectorWrap);

    const selectedMeta = getSelectedGameDayMeta();

    const editForm = document.createElement('form');
    editForm.className = 'admin-form admin-form--stacked';

    if (selectedMeta) {
        const descLabel = document.createElement('label');
        descLabel.className = 'admin-form-label';
        descLabel.textContent = 'Beschreibung bearbeiten';
        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.required = true;
        descInput.name = 'description';
        descInput.placeholder = 'z. B. Spieltag 5';
        descInput.value = selectedMeta.description || '';
        descLabel.appendChild(descInput);

        const lockLabel = document.createElement('label');
        lockLabel.className = 'admin-form-label';
        lockLabel.textContent = 'Lock Time (Datum & Uhrzeit)';
        const lockInput = document.createElement('input');
        lockInput.type = 'datetime-local';
        lockInput.name = 'lockTime';
        lockInput.required = true;
        lockInput.value = toLocalInputValue(selectedMeta.lockTime || null);
        lockLabel.appendChild(lockInput);

        const save = document.createElement('button');
        save.type = 'submit';
        save.textContent = 'Änderungen speichern';

        const finalize = document.createElement('button');
        finalize.type = 'button';
        finalize.textContent = 'Spieltag abschließen';
        finalize.className = 'admin-finalize';
        const isActive = selectedMeta.status === GAME_DAY_STATUS.ACTIVE;
        finalize.disabled = !isActive;

        finalize.addEventListener('click', async () => {
            finalize.disabled = true;
            try {
                await apiFetch(`/admin/game-days/${selectedMeta.id}/finalize`, { method: 'POST' });
                showAdminMessage('Spieltag wurde abgeschlossen.', 'success');
                await loadGameDays();
                await loadActiveGameDay();
                refreshLockState();
                renderGameDayAdmin();
            } catch (error) {
                showAdminMessage(error.message, 'error');
            } finally {
                finalize.disabled = false;
            }
        });

        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const description = descInput.value.trim();
            const lockTimeValue = lockInput.value ? new Date(lockInput.value).toISOString() : null;

            if (!description || !lockTimeValue) {
                showAdminMessage('Bitte Beschreibung und Lock-Zeit angeben.', 'error');
                return;
            }

            save.disabled = true;
            save.textContent = 'Wird gespeichert...';

            try {
                await apiFetch(`/admin/game-days/${selectedMeta.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ description, lockTime: lockTimeValue })
                });

                showAdminMessage('Spieltag aktualisiert.', 'success');
                await loadGameDays();
                await loadActiveGameDay();
                refreshLockState();
                renderGameDayAdmin();
            } catch (error) {
                showAdminMessage(error.message, 'error');
            } finally {
                save.disabled = false;
                save.textContent = 'Änderungen speichern';
            }
        });

        editForm.append(descLabel, lockLabel, save, finalize);
    } else {
        const note = document.createElement('p');
        note.className = 'admin-status-line';
        note.textContent = 'Kein Spieltag ausgewählt.';
        editForm.appendChild(note);
    }

    adminGameDay.appendChild(editForm);

    const createForm = document.createElement('form');
    createForm.className = 'admin-form admin-form--stacked';

    const createDescLabel = document.createElement('label');
    createDescLabel.className = 'admin-form-label';
    createDescLabel.textContent = 'Neuen Spieltag anlegen';
    const createDesc = document.createElement('input');
    createDesc.type = 'text';
    createDesc.name = 'description';
    createDesc.placeholder = 'Beschreibung';
    createDesc.required = true;
    createDescLabel.appendChild(createDesc);

    const createLockLabel = document.createElement('label');
    createLockLabel.className = 'admin-form-label';
    createLockLabel.textContent = 'Lock Time (Datum & Uhrzeit)';
    const createLock = document.createElement('input');
    createLock.type = 'datetime-local';
    createLock.name = 'lockTime';
    createLock.required = true;
    createLockLabel.appendChild(createLock);

    const createSubmit = document.createElement('button');
    createSubmit.type = 'submit';
    createSubmit.textContent = 'Spieltag speichern';

    createForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const description = createDesc.value.trim();
        const lockTimeValue = createLock.value ? new Date(createLock.value).toISOString() : null;

        if (!description || !lockTimeValue) {
            showAdminMessage('Bitte Beschreibung und Lock-Zeit angeben.', 'error');
            return;
        }

        createSubmit.disabled = true;
        createSubmit.textContent = 'Wird gespeichert...';

        try {
            const payload = { description, lockTime: lockTimeValue };
            const created = await apiFetch('/admin/game-days', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            activeGameDay = created;
            selectedGameDay = created.gameDay;
            selectedHistoryGameDay = created.gameDay;
            showAdminMessage('Spieltag gespeichert.', 'success');
            await refreshHottakes(created.gameDay);
            refreshLockState();
            await loadGameDays();
            await loadActiveGameDay();
            updateHistorySelect();
            renderHottakes();
            renderGameDayAdmin();
        } catch (error) {
            showAdminMessage(error.message, 'error');
        } finally {
            createSubmit.disabled = false;
            createSubmit.textContent = 'Spieltag speichern';
        }
    });

    createForm.append(createDescLabel, createLockLabel, createSubmit);
    adminGameDay.appendChild(createForm);
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


if (savePicksButton) {
    savePicksButton.addEventListener('click', saveSubmission);
}

if (swipeBackButton) {
    swipeBackButton.addEventListener('click', handleSwipeBack);
}

if (swipeCloseButton) {
    swipeCloseButton.addEventListener('click', exitSwipeOverlay);
}

if (swipeSkipButton) {
    swipeSkipButton.addEventListener('click', handleSwipeSkip);
}

if (swipeCard) {
    swipeCard.addEventListener('touchstart', (event) => {
        swipeTouchStartX = event.touches[0].clientX;
        swipeTouchDeltaX = 0;
    });

    swipeCard.addEventListener('touchmove', (event) => {
        if (swipeTouchStartX === null) {
            return;
        }

        swipeTouchDeltaX = event.touches[0].clientX - swipeTouchStartX;
        swipeCard.style.transform = `translateX(${swipeTouchDeltaX}px)`;

        if (swipeOverlay) {
            swipeOverlay.classList.toggle('is-swipe-left', swipeTouchDeltaX < -20);
            swipeOverlay.classList.toggle('is-swipe-right', swipeTouchDeltaX > 20);
        }
    });

    swipeCard.addEventListener('touchend', (event) => {
        if (swipeTouchStartX === null) {
            return;
        }

        const delta = swipeTouchDeltaX;
        swipeTouchStartX = null;
        swipeTouchDeltaX = 0;

        if (swipeOverlay) {
            swipeOverlay.classList.remove('is-swipe-left', 'is-swipe-right');
        }

        swipeCard.style.transform = '';

        if (Math.abs(delta) < SWIPE_THRESHOLD) {
            return;
        }

        animateSwipe(delta > 0 ? 'hit' : 'pass');
    });

    swipeCard.addEventListener('touchcancel', () => {
        swipeTouchStartX = null;
        swipeTouchDeltaX = 0;
        swipeCard.style.transform = '';
        if (swipeOverlay) {
            swipeOverlay.classList.remove('is-swipe-left', 'is-swipe-right');
        }
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && swipeOverlay && swipeOverlay.classList.contains('is-open')) {
        exitSwipeOverlay();
    }
});

document.addEventListener('mousemove', (event) => {
    if (dragState && dragState.inputType === 'mouse') {
        updateDragPosition(event.clientX, event.clientY);
        return;
    }

    if (!pendingGesture || pendingGesture.inputType !== 'mouse') {
        return;
    }

    const deltaX = event.clientX - pendingGesture.startX;
    const deltaY = event.clientY - pendingGesture.startY;
    pendingGesture.lastX = event.clientX;
    pendingGesture.lastY = event.clientY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance >= DRAG_START_THRESHOLD) {
        if (pendingGesture.holdTimer) {
            window.clearTimeout(pendingGesture.holdTimer);
        }
        beginHottakeDrag({
            element: pendingGesture.element,
            hottakeId: pendingGesture.hottakeId,
            clientX: event.clientX,
            clientY: event.clientY,
            inputType: 'mouse'
        });
        pendingGesture = null;
    }
});

document.addEventListener('mouseup', (event) => {
    if (dragState && dragState.inputType === 'mouse') {
        finishHottakeDrag(event.clientX, event.clientY);
        lastDragAt = Date.now();
        return;
    }

    if (!pendingGesture || pendingGesture.inputType !== 'mouse') {
        return;
    }

    const deltaX = event.clientX - pendingGesture.startX;
    const deltaY = event.clientY - pendingGesture.startY;
    const distance = Math.hypot(deltaX, deltaY);
    const duration = Date.now() - pendingGesture.startTime;
    if (pendingGesture.holdTimer) {
        window.clearTimeout(pendingGesture.holdTimer);
    }

    pendingGesture = null;
});

document.addEventListener('touchmove', (event) => {
    if (dragState && dragState.inputType === 'touch') {
        const touch = Array.from(event.touches).find((entry) => entry.identifier === dragState.touchId);
        if (!touch) {
            return;
        }
        event.preventDefault();
        updateDragPosition(touch.clientX, touch.clientY);
        return;
    }

    if (!pendingGesture || pendingGesture.inputType !== 'touch') {
        return;
    }

    const touch = Array.from(event.touches).find((entry) => entry.identifier === pendingGesture.touchId) || event.touches[0];
    if (!touch) {
        return;
    }

    const deltaX = touch.clientX - pendingGesture.startX;
    const deltaY = touch.clientY - pendingGesture.startY;
    pendingGesture.lastX = touch.clientX;
    pendingGesture.lastY = touch.clientY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance >= DRAG_START_THRESHOLD) {
        if (pendingGesture.holdTimer) {
            window.clearTimeout(pendingGesture.holdTimer);
        }
        beginHottakeDrag({
            element: pendingGesture.element,
            hottakeId: pendingGesture.hottakeId,
            clientX: touch.clientX,
            clientY: touch.clientY,
            inputType: 'touch',
            touchId: touch.identifier
        });
        pendingGesture = null;
    }
}, { passive: false });

document.addEventListener('touchend', (event) => {
    if (dragState && dragState.inputType === 'touch') {
        const touch = Array.from(event.changedTouches).find((entry) => entry.identifier === dragState.touchId);
        if (touch) {
            finishHottakeDrag(touch.clientX, touch.clientY);
            lastDragAt = Date.now();
        }
        return;
    }

    if (!pendingGesture || pendingGesture.inputType !== 'touch') {
        return;
    }

    const touch = Array.from(event.changedTouches).find((entry) => entry.identifier === pendingGesture.touchId) || event.changedTouches[0];
    if (!touch) {
        return;
    }

    const deltaX = touch.clientX - pendingGesture.startX;
    const deltaY = touch.clientY - pendingGesture.startY;
    const distance = Math.hypot(deltaX, deltaY);
    const duration = Date.now() - pendingGesture.startTime;
    if (pendingGesture.holdTimer) {
        window.clearTimeout(pendingGesture.holdTimer);
    }

    pendingGesture = null;
});

document.addEventListener('touchcancel', () => {
    if (dragState && dragState.inputType === 'touch') {
        cancelHottakeDrag();
    }
    if (pendingGesture?.holdTimer) {
        window.clearTimeout(pendingGesture.holdTimer);
    }
    pendingGesture = null;
});


async function checkLoginStatus() {
    try {
        const data = await apiFetch('/auth/me', {}, { allowNotFound: true });
        if (data && data.user) {

            updateUIForLogin(data.user);
        } else {

            console.log('User is guest (no session found)');
            await updateUIForGuest();
        }
    } catch (error) {

        const isAuthError = error.message.includes('Authentication required') ||
            error.message.includes('Invalid or expired token') ||
            error.message.includes('401');

        if (isAuthError) {
            console.log('User is guest (Unauthorized)');
            await updateUIForGuest();
            return;
        }

        console.warn('Auth check failed:', error);

        await updateUIForGuest();
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
        closeSwipeOverlay();
        swipeCompleted = false;
        swipeDecisions = [];

        if (gameContainer) gameContainer.style.display = 'none';
        if (savePicksButton) savePicksButton.style.display = 'none';
        if (gameDayShell) gameDayShell.style.display = 'none';

        if (adminArea) {
            adminArea.style.display = 'flex';
            enableAdminArea();
        }
    } else {
        adminEnabled = false;

        if (gameContainer) gameContainer.style.display = 'grid';
        if (gameDayShell) gameDayShell.style.display = 'block';
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


async function updateUIForGuest() {
    currentUser = null;
    updateUserChip(null);
    updateSettingsAuth(null);
    closeSettings();
    closeSwipeOverlay();
    setHeaderAuthState(false);
    viewMode = 'active';

    adminEnabled = false;
    swipeCompleted = false;
    swipeDecisions = [];


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
    if (gameDayShell) gameDayShell.style.display = 'none';
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
    createRankSlots();
    await loadGameDays();
    await loadActiveGameDay();
    if (activeGameDay) {
        selectedGameDay = activeGameDay.gameDay;
        selectedHistoryGameDay = selectedGameDay;
        updateHistorySelect();
    }
    await checkLoginStatus();
    await refreshHottakes();
    await drawLeaderboard();
}

initializeApp().catch((error) => {
    console.error(error);
    alert('Fehler beim Initialisieren der App.');
});




