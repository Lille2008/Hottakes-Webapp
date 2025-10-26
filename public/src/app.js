const API_BASE = window.APP_API_BASE || '/api';
const RANK_COUNT = 5;

let hottakes = [];
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

    const existing = rankDiv.querySelector('.hottake');
    if (existing) {
        const existingId = Number(existing.dataset.hottakeId);
        if (!Number.isNaN(existingId)) {
            const existingIndex = picks.indexOf(existingId);
            if (existingIndex !== -1) {
                picks[existingIndex] = null;
            }
        }
        hottakesList.appendChild(existing);
    }

    const previousParent = element.parentElement;
    if (previousParent && previousParent.classList.contains('rank')) {
        const previousIndex = Number(previousParent.dataset.rank) - 1;
        if (previousIndex >= 0 && previousIndex < picks.length) {
            picks[previousIndex] = null;
        }
    }

    rankDiv.appendChild(element);
    const rankIndex = Number(rankDiv.dataset.rank) - 1;
    if (rankIndex >= 0 && rankIndex < picks.length) {
        picks[rankIndex] = hottakeId;
    }
}

async function apiFetch(path, options = {}, { allowNotFound = false } = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);
    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch (_error) {
            data = text;
        }
    }

    if (!response.ok) {
        if (allowNotFound && response.status === 404) {
            return null;
        }
        const message = data && data.message ? data.message : typeof data === 'string' && data.length ? data : `Request failed (${response.status})`;
        throw new Error(message);
    }

    return data;
}

function sanitizePicks() {
    const validIds = new Set(hottakes.map((hot) => hot.id));
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

    hottakes.forEach((hottake) => {
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
        hottakes = Array.isArray(data) ? data : [];
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
    adminList.innerHTML = '<h3>Hottakes-Check</h3>';
    if (!hottakes.length) {
        const info = document.createElement('p');
        info.textContent = 'Keine Hottakes vorhanden.';
        adminList.appendChild(info);
        return;
    }

    hottakes.forEach((hot, index) => {
        const row = document.createElement('p');
        const status = hot.correct ? '✅' : '❌';
        const active = hot.isActive ? '' : ' (inaktiv)';
        row.textContent = `${index + 1}. ${hot.text} ${status}${active}`;
        adminList.appendChild(row);
    });
}

function renderAdminForm() {
    adminAdd.innerHTML = '<h3>Neue Hottakes</h3>';

    const form = document.createElement('form');
    const textInput = document.createElement('textarea');
    textInput.name = 'text';
    textInput.placeholder = 'Hottake-Text';
    textInput.required = true;
    textInput.rows = 2;

    const correctLabel = document.createElement('label');
    const correctInput = document.createElement('input');
    correctInput.type = 'checkbox';
    correctInput.name = 'correct';
    correctLabel.appendChild(correctInput);
    correctLabel.appendChild(document.createTextNode(' Treffer ist korrekt?'));

    const activeLabel = document.createElement('label');
    const activeInput = document.createElement('input');
    activeInput.type = 'checkbox';
    activeInput.name = 'isActive';
    activeInput.checked = true;
    activeLabel.appendChild(activeInput);
    activeLabel.appendChild(document.createTextNode(' Aktiv'));

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Hottake speichern';

    form.appendChild(textInput);
    form.appendChild(correctLabel);
    form.appendChild(activeLabel);
    form.appendChild(submitButton);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!adminPasswordToken) {
            alert('Kein Admin-Passwort gesetzt.');
            return;
        }

        const text = textInput.value.trim();
        if (text.length < 3) {
            alert('Der Text muss mindestens 3 Zeichen lang sein.');
            return;
        }

        const payload = {
            text,
            correct: correctInput.checked,
            isActive: activeInput.checked
        };

        try {
            await apiFetch('/hottakes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': adminPasswordToken
                },
                body: JSON.stringify(payload)
            });

            textInput.value = '';
            correctInput.checked = false;
            activeInput.checked = true;

            await refreshHottakes();
            await drawLeaderboard();
            alert('Hottake gespeichert.');
        } catch (error) {
            alert(error.message);
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
}

function disableAdminArea() {
    adminPasswordToken = null;
    adminEnabled = false;
    adminArea.style.display = 'none';
}

setNicknameButton.addEventListener('click', async () => {
    const nickname = nicknameInput.value.trim();

    if (!nickname) {
        alert('Bitte gib einen Nickname ein.');
        return;
    }

    currentNickname = nickname;
    await loadSubmissionForNickname(nickname);
    alert(`Nickname gesetzt: ${nickname}`);

    if (nickname.toLowerCase() === 'lille') {
        if (!adminEnabled) {
            const password = prompt('Admin-Passwort eingeben:');
            if (!password) {
                return;
            }
            enableAdminArea(password);
        }
    } else if (adminEnabled) {
        disableAdminArea();
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




