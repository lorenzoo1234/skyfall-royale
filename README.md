# Skyfall Royale – Multiplayer Battle Royale

Eigenständiges Low-Poly-3D-Battle-Royale-Projekt für den Browser.

## Enthalten
- große frei begehbare Insel mit Wald, Felsen und 8 begehbaren Gebäudehüllen
- Startphase mit fliegendem Transporter-Status und Absprung per SPACE; Spieler fallen und landen auf der Insel
- bis zu 2 menschliche Spieler pro Raum
- 24 zusätzliche Bots
- serverautoritatives Spiel für Bewegung, Treffer, Loot, Zone und Bauen
- Loot: Munition und Heilung
- Schießen, Munition und Nachladen
- schrumpfende Zone mit Schaden außerhalb
- Bausystem: Wände und Treppen mit serverseitiger Platzierungsprüfung
- Bots suchen Gegner, bewegen sich zur Deckung/Zielposition und bauen in gefährlichen Nahkampfsituationen
- eindeutige Sieg-/Niederlagebedingung

## Installation
Voraussetzung: Node.js 18+ (getestet mit Node.js 22).

Im Projektordner:

    npm install
    npm start

Danach im Browser:

    http://localhost:3000

## Mit einem Freund spielen
1. Host startet den Server.
2. Host öffnet `http://localhost:3000` und lässt das Raumcode-Feld leer. Dadurch wird ein neuer Raumcode erzeugt.
3. Freund öffnet dieselbe Server-Adresse und trägt denselben Raumcode ein.
4. Beide können anschließend spielen.

### LAN
Auf dem Host-PC die lokale IP-Adresse verwenden, z.B.:

    http://192.168.178.25:3000

Der Freund muss im selben WLAN/LAN sein. Windows-Firewall muss eingehende TCP-Verbindungen auf Port 3000 zulassen.

### Internet
Für Internet-Multiplayer muss der Rechner/Server öffentlich erreichbar sein. Möglich sind z.B. ein kleiner VPS oder eine korrekt eingerichtete Router-Portweiterleitung. Für einen privaten PC müssen Firewall/NAT entsprechend konfiguriert werden. Das Projekt enthält keinen externen Matchmaking- oder Relay-Dienst.

## Steuerung
- WASD: Bewegung
- Maus: Blickrichtung
- Linksklick: Schießen
- R: Nachladen
- SPACE: aus dem Transporter springen
- E: nächstes Loot in Reichweite aufnehmen
- B: Wand bauen
- N: Treppe bauen
- ESC: Maus freigeben

## Technik
- Node.js + WebSocket (`ws`) für den autoritativen Spielserver
- Three.js im Browser für 3D-Rendering
- eigene prozedurale Low-Poly-Umgebung, keine Fortnite/PUBG-Assets

## Bekannte Einschränkungen
- Das Transportmittel ist als Start-/Absprungphase umgesetzt; es gibt noch keine frei steuerbare Flugzeug-Physik.
- Das Bausystem ist bewusst kompakt: Wände und Treppen, keine vollständige Materialwirtschaft oder Edit-Modi.
- Bots verwenden einfache serverseitige KI und einfache Deckungs-/Bauentscheidungen.
- Die HTML-Datei lädt Three.js von jsDelivr; für den ersten Browserstart wird daher Internetzugang benötigt. Der Multiplayer-Server selbst benötigt keine externe API.
- Es wurde kein echtes Internet-Match mit zwei separaten Rechnern aus dieser Umgebung heraus durchgeführt; die WebSocket-Serverlogik und der lokale Serverstart wurden syntaktisch/lokal geprüft.
