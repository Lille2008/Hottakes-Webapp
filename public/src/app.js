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
let picks = Array(RANK_COUNT).fill(null);
let currentNickname = '';
let adminPasswordToken = null;
let adminEnabled = false;

const hottakesContainer = document.getElementById('hottakes-container');
const ranksContainer = document.getElementById('ranks-container');
const leaderboardContainer = document.getElementById('leaderboard-container');
const nicknameInput = document.getElementById('nickname');
const setNicknameButton = document.getElementById('set-nickname');
const savePicksButton = document.getElementById('save-picks');
const adminArea = document.getElementById('admin-area');
const adminList = document.getElementById('hottake-list');
const adminAdd = document.getElementById('add-hottakes');

if (
    !hottakesContainer ||
    !ranksContainer ||
    !leaderboardContainer ||
    !nicknameInput ||
    !setNicknameButton ||
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

const hottakesList = document.createElement('div');
hottakesList.id = 'hottakes-list';
hottakesContainer.appendChild(hottakesList);

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

async function apiFetch(path, options = {}, { allowNotFound = false } = {}) {
    const url = `${API_BASE}${path}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }

    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers });
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

function sanitizePicks() {
    const validIds = new Set(openHottakes.map((hot) => hot.id));
    picks = picks.map((id) => (typeof id === 'number' && validIds.has(id) ? id : null));
}

function createHottakeElement(hottake) {
    const element = document.createElement('p');
    element.textContent = hottake.text;
    element.className = 'hottake';
    element.draggable = true;
    element.dataset.hottakeId = String(hottake.id);
    element.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', String(hottake.id));
        event.dataTransfer.effectAllowed = 'move';
    });
    return element;
}

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

async function refreshHottakes() {
    try {
        const data = await apiFetch('/hottakes');
        allHottakes = Array.isArray(data) ? data : [];
        openHottakes = allHottakes.filter((hot) => hot.status === 'OFFEN');
        renderHottakes();
    } catch (error) {
        console.error(error);
        hottakesList.innerHTML = '<p>Fehler beim Laden der Hottakes.</p>';
    }
}

async function drawLeaderboard() {
    leaderboardContainer.innerHTML = '<h2>Leaderboard</h2>';
    try {
        const response = await apiFetch('/leaderboard');
        const entries = Array.isArray(response) ? response : [];

        if (entries.length === 0) {
            const emptyRow = document.createElement('p');
            emptyRow.textContent = 'Noch keine Einsendungen.';
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

async function loadSubmissionForNickname(nickname) {
    try {
        const submission = await apiFetch(`/submissions/${encodeURIComponent(nickname)}`, {}, { allowNotFound: true });
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

async function saveSubmission() {
    if (picks.some((entry) => entry === null)) {
        alert('Bitte wähle alle 5 Hottakes aus, bevor du speicherst.');
        return;
    }

    if (!currentNickname) {
        alert('Bitte gib zuerst einen Nickname ein.');
        return;
    }

    try {
        await apiFetch('/submissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nickname: currentNickname, picks })
        });

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

function disableAdminArea() {
    adminPasswordToken = null;
    adminEnabled = false;
    adminArea.style.display = 'none';
    showAdminMessage('', 'info');
    renderHottakes();
}

setNicknameButton.addEventListener('click', async () => {
    const nickname = nicknameInput.value.trim();

    if (!nickname) {
        alert('Bitte gib einen Nickname ein.');
        return;
    }

    const isAdminNickname = nickname.toLowerCase() === 'lille08';
    currentNickname = nickname;
    await loadSubmissionForNickname(nickname);
    if (isAdminNickname) {
        if (!adminEnabled) {
            const password = prompt('Admin-Passwort eingeben:');
            if (!password) {
                return;
            }
            enableAdminArea(password);
        } else {
            showAdminMessage('Admin-Modus aktiv.', 'info');
        }
    } else if (adminEnabled) {
        disableAdminArea();
        alert(`Nickname gesetzt: ${nickname}`);
    } else {
        alert(`Nickname gesetzt: ${nickname}`);
    }
});

savePicksButton.addEventListener('click', saveSubmission);

async function initializeApp() {
    createRankSlots();
    await refreshHottakes();
    await drawLeaderboard();
}

initializeApp().catch((error) => {
    console.error(error);
    alert('Fehler beim Initialisieren der App.');
});




