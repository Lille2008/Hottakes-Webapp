// Frontend-Logik der Hottakes-App (Vanilla JS)
// - Lädt Hottakes/Leaderboard von der API
// - Ermöglicht Drag&Drop von Hottakes in Ränge
// - Enthält einen optionalen Admin-Modus (Status setzen, neue Hottakes)
const API_BASE = window.APP_API_BASE || '/api';
const RANK_COUNT = 5; // Anzahl der zu platzierenden Picks
const MIN_OPEN_HOTTAKES = 10; // Mindestanzahl offener Hottakes, bevor Admin Submissions erlaubt

// UI-Beschriftungen je Status
const STATUS_LABELS = {
    OFFEN: 'Offen',
    WAHR: 'Wahr',
    FALSCH: 'Falsch'
};

// CSS-Badge-Klassen je Status
const STATUS_BADGE_CLASS = {
    OFFEN: 'is-open',
    WAHR: 'is-true',
    FALSCH: 'is-false'
};

const STATUS_VALUES = ['OFFEN', 'WAHR', 'FALSCH'];

// Anwendungszustand (State)
let allHottakes = [];
let openHottakes = [];
let picks = Array(RANK_COUNT).fill(null);
let currentUser = null;
let adminPasswordToken = null;
let adminEnabled = false;

const hottakesContainer = document.getElementById('hottakes-container');
const ranksContainer = document.getElementById('ranks-container');
const leaderboardContainer = document.getElementById('leaderboard-container');
const savePicksButton = document.getElementById('save-picks');
const adminArea = document.getElementById('admin-area');
const adminList = document.getElementById('hottake-list');
const adminAdd = document.getElementById('add-hottakes');

// Sicherstellen, dass alle benötigten DOM-Elemente vorhanden sind
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

adminList.classList.add('admin-card');
adminAdd.classList.add('admin-card');

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

const hottakesNotice = document.createElement('p');
hottakesNotice.id = 'hottakes-notice';
hottakesNotice.className = 'hottakes-notice';
hottakesContainer.appendChild(hottakesNotice);

// Liste verfügbarer Hottakes (drag-source)
const hottakesList = document.createElement('div');
hottakesList.id = 'hottakes-list';
hottakesContainer.appendChild(hottakesList);

// Drop-Ziele für die priorisierten Plätze
const rankSlots = [];

hottakesList.addEventListener('dragover', (event) => {
    event.preventDefault();
});

hottakesList.addEventListener('drop', (event) => {
    event.preventDefault();
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

// Erstellt/Reset die fünf Rang-Slots und hängt Drop-Handler an
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

// Verarbeitet das Ablegen eines Hottakes in einen Rang-Slot inkl. Tausch/Zurücklegen
function handleRankDrop(event) {
    event.preventDefault();
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

// Kleinere Fetch-Hilfsfunktion: JSON-Defaults, Fehlertexte und optional 404 erlauben
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

// Räumt ungültige Picks (nicht mehr vorhanden/geschlossen) aus dem State auf
function sanitizePicks() {
    const validIds = new Set(openHottakes.map((hot) => hot.id));
    picks = picks.map((id) => (typeof id === 'number' && validIds.has(id) ? id : null));
}

// Erstellt ein dragbares Element für einen einzelnen Hottake
function createHottakeElement(hottake) {
    const element = document.createElement('p');
    element.textContent = hottake.text;
    element.textContent = hottake.text;
    // Basis-Klasse plus Status-Klasse (z.B. is-true, is-false)
    const statusClass = STATUS_BADGE_CLASS[hottake.status] || 'is-open';
    element.className = `hottake ${statusClass}`;
    element.draggable = true;
    element.dataset.hottakeId = String(hottake.id);
    element.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', String(hottake.id));
        event.dataTransfer.effectAllowed = 'move';
    });
    return element;
}

// Rendert die verfügbaren Hottakes und verteilt bereits gewählte in ihre Ränge
function renderHottakes() {
    sanitizePicks();
    hottakesList.innerHTML = '';
    rankSlots.forEach((slot) => {
        slot.innerHTML = '';
    });

    const availableHottakes = openHottakes;
    const hasMinimumOpen = availableHottakes.length >= MIN_OPEN_HOTTAKES;

    if (adminEnabled) {
        if (hasMinimumOpen) {
            hottakesNotice.textContent = '';
            hottakesNotice.classList.remove('is-visible');
        } else {
            hottakesNotice.textContent = `Es müssen mindestens ${MIN_OPEN_HOTTAKES} Hottakes offen sein. Aktuell verfügbar: ${availableHottakes.length}.`;
            hottakesNotice.classList.add('is-visible');
        }

        savePicksButton.disabled = !hasMinimumOpen;
    } else {
        hottakesNotice.textContent = '';
        hottakesNotice.classList.remove('is-visible');
        savePicksButton.disabled = false;
    }

    availableHottakes.forEach((hottake) => {
        const element = createHottakeElement(hottake);
        const rankIndex = picks.indexOf(hottake.id);
        if (rankIndex !== -1) {
            rankSlots[rankIndex].appendChild(element);
        } else {
            hottakesList.appendChild(element);
        }
    });

    if (adminEnabled) {
        renderAdminOverview();
    }
}

// Lädt Hottakes von der API und aktualisiert die Anzeige
async function refreshHottakes() {
    try {
        const data = await apiFetch('/hottakes');
        allHottakes = Array.isArray(data) ? data : [];
        allHottakes = Array.isArray(data) ? data : [];
        // SHOW ALL HOTTAKES (requested by user), do not filter by OFFEN only
        openHottakes = allHottakes;
        renderHottakes();
    } catch (error) {
        console.error(error);
        hottakesList.innerHTML = '<p>Fehler beim Laden der Hottakes.</p>';
    }
}

// Lädt das Leaderboard und zeichnet die Rangliste im UI
async function drawLeaderboard() {
    leaderboardContainer.innerHTML = '<h2>Leaderboard</h2>';
    try {
        const response = await apiFetch('/leaderboard');
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

// Lädt die existierende Submission des eingeloggten Users und setzt die Picks im UI
async function loadSubmissionForCurrentUser() {
    if (!currentUser) {
        return;
    }

    try {
        const submission = await apiFetch(`/submissions/${encodeURIComponent(currentUser.nickname)}`, {}, { allowNotFound: true });
        const nextPicks = Array(RANK_COUNT).fill(null);

        if (submission && Array.isArray(submission.picks)) {
            submission.picks.slice(0, RANK_COUNT).forEach((id, index) => {
                if (typeof id === 'number') {
                    nextPicks[index] = id;
                }
            });
        }

        picks = nextPicks;
        renderHottakes();
    } catch (error) {
        alert(error.message);
    }
}

// Persistiert die aktuelle Auswahl (Picks) für den eingeloggten User
async function saveSubmission() {
    if (picks.some((entry) => entry === null)) {
        alert('Bitte wähle alle 5 Hottakes aus, bevor du speicherst.');
        return;
    }

    if (!currentUser) {
        alert('Bitte melde dich zuerst an.');
        return;
    }

    try {
        await apiFetch('/submissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ picks })
        });

        alert('Deine Picks wurden gespeichert.');
        await drawLeaderboard();
    } catch (error) {
        alert(error.message);
    }
}

// Admin: Übersicht aller Hottakes mit Status-Badges und -Select
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

            if (!adminPasswordToken) {
                statusSelect.value = hot.status;
                showAdminMessage('Kein Admin-Passwort gesetzt.', 'error');
                return;
            }

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
                    headers: {
                        'x-admin-password': adminPasswordToken
                    },
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

// Admin: Formular zum Anlegen eines neuen Hottakes
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

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Hottake speichern';

    form.append(textLabel, statusHint, submitButton);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!adminPasswordToken) {
            showAdminMessage('Kein Admin-Passwort gesetzt.', 'error');
            return;
        }

        const text = textInput.value.trim();
        if (text.length < 3) {
            showAdminMessage('Der Text muss mindestens 3 Zeichen lang sein.', 'error');
            textInput.focus();
            return;
        }

        const payload = { text };

        submitButton.disabled = true;
        submitButton.textContent = 'Speichern...';

        try {
            await apiFetch('/hottakes', {
                method: 'POST',
                headers: {
                    'x-admin-password': adminPasswordToken
                },
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

// Aktiviert den Admin-Modus (per Passwort), zeigt Admin-UI und lädt Daten neu
function enableAdminArea(password) {
    adminPasswordToken = password;
    adminEnabled = true;
    adminArea.style.display = 'flex';
    renderAdminOverview();
    renderAdminForm();
    renderHottakes();
    showAdminMessage('Admin-Modus aktiv. Du kannst neue Hottakes speichern.', 'info');
    setTimeout(() => {
        adminArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
}

// Deaktiviert den Admin-Modus und blendet die Admin-UI aus
function disableAdminArea() {
    adminPasswordToken = null;
    adminEnabled = false;
    adminArea.style.display = 'none';
    showAdminMessage('', 'info');
    renderHottakes();
}

// Speichern-Button für Picks
savePicksButton.addEventListener('click', saveSubmission);

// Initialisierung: Auth-Status prüfen
async function checkLoginStatus() {
    try {
        const data = await apiFetch('/auth/me', {}, { allowNotFound: true });
        if (data && data.user) {
            // User ist eingeloggt
            updateUIForLogin(data.user);
        } else {
            // Gast (z.B. 404 oder null return)
            console.log('User is guest (no session found)');
            updateUIForGuest();
        }
    } catch (error) {
        // Expected errors when not logged in (401 sent by requireAuth)
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

// UI-Update-Logik für eingeloggte User
function updateUIForLogin(user) {
    // 1. Header anpassen
    const authHeader = document.getElementById('auth-header');
    if (authHeader) {
        authHeader.innerHTML = `
            <span style="margin-right: 10px; font-weight: bold;">${user.nickname}</span>
            <button id="btn-logout" class="btn">Logout</button>
        `;
        document.getElementById('btn-logout').addEventListener('click', async () => {
            await apiFetch('/auth/logout', { method: 'POST' });
            window.location.reload();
        });
    }

    // 2. User-Info anzeigen
    const userInfo = document.getElementById('user-info');
    const userDisplay = document.getElementById('user-nickname-display');
    if (userInfo && userDisplay) {
        userDisplay.textContent = user.nickname;
        userInfo.style.display = 'block';
    }

    // 3. Guest Area (Login-Link) IMMER verstecken
    const guestArea = document.getElementById('guest-nickname-area');
    if (guestArea) guestArea.style.display = 'none';

    // 4. Distinction: Admin vs Normal User
    const gameContainer = document.getElementById('game');
    const adminArea = document.getElementById('admin-area');

    currentUser = user;

    if (user.nickname === 'lille08') {
        // Admin darf Hottakes verwalten, aber nicht selbst tippen
        if (gameContainer) gameContainer.style.display = 'none';
        if (savePicksButton) savePicksButton.style.display = 'none';

        if (adminArea) {
            adminArea.style.display = 'flex';

            if (!adminPasswordToken) {
                const password = prompt('Admin-Passwort eingeben:');
                if (!password) {
                    showAdminMessage('Admin-Passwort erforderlich, um Hottakes zu verwalten.', 'error');
                } else {
                    adminPasswordToken = password;
                    enableAdminArea(password);
                }
            } else {
                enableAdminArea(adminPasswordToken);
            }
        }
    } else {
        adminEnabled = false;
        adminPasswordToken = null;

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

// UI-Update-Logik für Gäste (NICHT eingeloggt)
function updateUIForGuest() {
    currentUser = null;
    // Ensure admin mode is disabled for guests
    adminEnabled = false;
    adminPasswordToken = null;

    // 1. Header anpassen (Default ist Login/Register Buttons)
    const authHeader = document.getElementById('auth-header');
    // ...bleibt so wie im HTML hardcoded

    // 2. Guest Area (Login-Prompt) ANZEIGEN
    const guestArea = document.getElementById('guest-nickname-area');
    if (guestArea) {
        guestArea.innerHTML = '<p>Bitte <a href="login.html">einloggen</a> um mitzuspielen.</p>';
        guestArea.style.display = 'block';
    }

    // 3. User-Info verstecken
    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.style.display = 'none';

    // 4. Game & Admin verstecken
    // Damit Gäste NICHT spielen können (wie gewünscht)
    const gameContainer = document.getElementById('game');
    const adminArea = document.getElementById('admin-area');

    if (gameContainer) gameContainer.style.display = 'none'; // HIDE GAME FOR GUESTS
    if (adminArea) adminArea.style.display = 'none';

    if (savePicksButton) {
        savePicksButton.disabled = true;
        savePicksButton.textContent = 'Einloggen zum Speichern';
    }
}

// Bootstrap der App: Slots erstellen, Daten laden, Leaderboard zeichnen
async function initializeApp() {
    createRankSlots();
    await checkLoginStatus(); // Auth Check vor Datenladen
    await refreshHottakes();
    await drawLeaderboard();
}

initializeApp().catch((error) => {
    console.error(error);
    alert('Fehler beim Initialisieren der App.');
});




