// Hottakes
let hottakes = JSON.parse(localStorage.getItem('hottakes')) || [];

// Punktevergabe
function scoring(userpicks) {
    let score = 0;

    for (let i = 0; i < userpicks.length; i++) {
        if (userpicks[i] === -1) continue; // Nicht gewählte Hottakes überspringen

        const hottake = hottakes.find(ht => ht.id === userpicks[i]);
        if (hottake && hottake.correct === true) {
            score += (5 - i); // Punkte basierend auf der Platzierung vergeben
        } 
    }
    
    return score;
}

function leaderboardData() {
    const submissions = JSON.parse(localStorage.getItem('submissions')) || {};

    let results = [];

    for (const user in submissions) {
        const nickname = user;
        const userpicks = submissions[user];
        const score = scoring(userpicks);
        results.push({ user: nickname , score: score });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
}

//picks-Array: Aktuelle Picks speichern
const picks = [null, null, null, null, null];

ranksCount = 5; // Anzahl der Ränge

for( let i = 1; i <= ranksCount; i++) { // Felder für die Hottakes
    const container = document.createElement('div'); // umschließender Container
    container.className = 'rank-wrapper'; // optional zum Stylen

    const label = document.createElement('div'); 
    label.textContent = 'Platz ' + i;
    label.className = 'rank-label'; // CSS-Klasse für Styling
    container.appendChild(label);

    const rankDiv = document.createElement('div'); // Feld für den Hottake
    rankDiv.className = 'rank'; 
    rankDiv.dataset.rank = i; // für picks-Array
    container.appendChild(rankDiv); // Container um das Rank-Feld erweitern

    document.getElementById('ranks-container').appendChild(container); // Container zum Ranks-Container hinzufügen

    rankDiv.addEventListener('dragover', function(event) { // Event Listener für Dragover
        event.preventDefault(); // Standardverhalten im Browser verhindern
    });

    rankDiv.addEventListener('drop', function(event) {
        event.preventDefault();

        const hottakeId = parseInt(event.dataTransfer.getData('text/plain'), 10); // ID des gezogenen Hottakes
        const hottakeEle = document.getElementById(hottakeId); // Das gezogene Element

        if (!hottakeEle) return;

        // Prüfen, ob im Rank bereits ein Hot Take ist
        const existingHottake = Array.from(rankDiv.children).find(el => el.classList.contains('hottake'));

        if (existingHottake) {
            // Tausch: bestehender Hot Take an den Ursprungsort des gezogenen Hot Takes
            const parentOfDragged = hottakeEle.parentElement;
            parentOfDragged.appendChild(existingHottake);

            // picks-Array: alten Hottake entfernen
            const oldIndex = picks.indexOf(parseInt(existingHottake.id, 10));
            if (oldIndex !== -1) picks[oldIndex] = null;
        }

        // Gezogenen Hot Take in den Rank setzen
        rankDiv.appendChild(hottakeEle);

        // picks-Array aktualisieren
        const rankIndex = parseInt(rankDiv.dataset.rank, 10) - 1;
        picks[rankIndex] = hottakeId;

    });

    document.getElementById('ranks-container').appendChild(rankDiv); // Feld zum Container hinzufügen
}

// Scores berechnen und Leaderboard anzeigen
function drawLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboard-container');
    leaderboardContainer.innerHTML = '<h2>Leaderboard</h2>'; // Überschrift hinzufügen
    const results = leaderboardData();
    for (let i = 0; i < results.length; i++) {
        const row = document.createElement('p');
        row.textContent = `${i+1}. ${results[i].user}: ${results[i].score} Punkte`;

        leaderboardContainer.appendChild(row);
    }
}

drawLeaderboard();

//Beim Laden der Seite den Nickname aus dem Local Storage holen und anzeigen, Admin-Bereich wenn Lille und Scores berechnen
const savedNickname = localStorage.getItem('nickname'); // Gespeicherte Nickname wird geholt
if (savedNickname) {
    document.getElementById('nickname').value = savedNickname; // Nickname im Eingabefeld anzeigen
}

if (savedNickname === 'Lille') {
    const password = "Mbangula7"
    let enteredPassword = prompt('Willkommen zurück, Lille! Bitte gib dein Passwort ein:');
    if (enteredPassword === password) {
        document.getElementById('admin-area').style.display = 'flex'; // Admin-Bereich anzeigen

        const list = document.getElementById('hottake-list');
        list.innerHTML = '<h3>Hottakes-Check</h3>'; // Überschrift hinzufügen

        const addArea = document.getElementById('add-hottakes');
        addArea.innerHTML = '<h3>Neue Hottakes</h3>'; // Inhalt löschen und Überschrift hinzufügen

        for (let i = 0; i < hottakes.length; i++) {
            const container = document.createElement('div'); // umschließender Container
            const text = document.createTextNode((i + 1) + '. ' + hottakes[i].text); // Text für die Hottake
            const toggle = document.createElement('input'); // Checkbox erstellen
            toggle.type = 'checkbox';
            toggle.id = 'toggle_' + i; // eindeutige ID für die Checkbox

            if (hottakes[i].correct === true) toggle.checked = true; // Checkbox aktivieren, wenn Hottake als korrekt markiert ist

            toggle.addEventListener('change', function() { // Event Listener für die Checkbox
                if (toggle.checked) {
                    hottakes[i].correct = toggle.checked; // Hottake-Status aktualisieren
                    localStorage.setItem('hottakes', JSON.stringify(hottakes)); // Änderungen im Local Storage speichern
                } else {
                    hottakes[i].correct = false; // Hottake-Status aktualisieren
                    localStorage.setItem('hottakes', JSON.stringify(hottakes)); // Änderungen im Local Storage speichern
                }
                drawLeaderboard(); // Leaderboard neu zeichnen
            });

            container.appendChild(text); // Text zum Container hinzufügen
            container.appendChild(toggle); // Checkbox zum Container hinzufügen
            list.appendChild(container); // Container zur Liste hinzufügen
            

            const newhottake = document.createElement('input'); // Eingabefeld für neuen Hottake
            newhottake.type = 'text';
            newhottake.id = 'new_hottake_' + i;
            addArea.appendChild(newhottake); // Eingabefeld zum Add-Hottakes-Bereich hinzufügen
            
            
        }
        const addButton = document.createElement('button'); // Button zum Hinzufügen
        addButton.textContent = 'Neue Hottakes speichern';
            addButton.addEventListener('click', function() {
                const inputs = document.querySelectorAll('[id^="new_hottake_"]');
                const newArray = [];

                for (let i=0; i<inputs.length; i++) {
                    const val = inputs[i].value.trim();
                    if (!val) {
                    alert('Bitte alle 10 Hottakes ausfüllen');
                    return;
                    }
                    newArray.push({ id: i, text: val, correct: null });
                }

                localStorage.setItem('hottakes', JSON.stringify(newArray));
                // entweder neu rendern oder reload:
                location.reload(); // Seite neu laden, um die neuen Hottakes anzuzeigen
            });
        addArea.appendChild(addButton); // Button zum Add-Hottakes-Bereich hinzufügen
    } else {
        alert('Falsches Passwort. Zugriff verweigert.');
    }
}  
// Picks aus LocalStorage laden
let savedPicks = [];
if (savedNickname) {
    const submissions = JSON.parse(localStorage.getItem('submissions')) || {};
    if (savedNickname && submissions[savedNickname]) {
        savedPicks = submissions[savedNickname];
    }
}

for (let i = 0; i < hottakes.length; i++) {
    const hottake = hottakes[i]; // Hottake holen
    const hottakeElement = document.createElement('p');
    hottakeElement.textContent = hottakes[i].text; // Hottake Text setzen
    hottakeElement.className = 'hottake'; // Klasse für Styling
    hottakeElement.setAttribute('draggable', 'true'); // Drag & Drop aktivieren
    hottakeElement.id = hottakes[i].id; // ID für Drag & Drop

    hottakeElement.addEventListener('dragstart', function(event) { // Event Listener für Drag & Drop
        if (event.target.classList.contains('hottake')) {
            event.dataTransfer.setData('text/plain', hottake.id); // ID des Hottakes speichern
            event.dataTransfer.effectAllowed = 'move'; // Effekt setzen
        }
        
    }); // End of dragstart event listener

    // Prüfen, ob dieser Hottake schon in savedPicks ist
    const rankIndex = savedPicks.indexOf(hottake.id);
    if (rankIndex !== -1) {
        // Direkt in den richtigen Rank verschieben
        const rankDiv = document.querySelector(`.rank[data-rank="${rankIndex + 1}"]`);
        if (rankDiv) rankDiv.appendChild(hottakeElement);
        picks[rankIndex] = hottake.id; // picks-Array setzen
    } else {
        // Noch nicht gewählt → in hottakes-container
        document.getElementById('hottakes-container').appendChild(hottakeElement);
    }
}


// Picks speichern, wenn der Button geklickt wird
document.getElementById('save-picks').addEventListener('click', function() {
    if (picks.includes(null)) {
        alert('Bitte wähle alle 5 Hottakes aus, bevor du speicherst!');
        return;
    }

    // Alle Picks gesetzt → speichern
    const nickname = document.getElementById('nickname').value;
    if (!nickname) {
        alert('Bitte gib einen Nickname ein, bevor du speicherst!');
        return;
    }
    // Altes submissions-Objekt holen oder neues anlegen
    let submissions = JSON.parse(localStorage.getItem('submissions')) || {};

    // Aktuelle Picks für diesen Nickname speichern/überschreiben
    submissions[nickname] = picks;

    // Aktualisiertes Objekt zurück in localStorage speichern
    localStorage.setItem('submissions', JSON.stringify(submissions));

    alert('Deine Picks wurden gespeichert!');
});


// Nickname speichern, wenn der Button geklickt wird
document.getElementById('set-nickname').addEventListener('click', function() {
    const nickname = document.getElementById('nickname').value;
    localStorage.setItem('nickname', nickname);
    alert('Nickname gespeichert: ' + nickname);
    console.log(localStorage.getItem('submissions'));
});




