# 🎾 Guida & Istruzioni — Gestione Tornei Padel

Benvenuto nel manuale operativo di **Gestione Tornei Padel**.  
Questa guida spiega in modo semplice come avviare il software, come usarlo su chiavetta USB, come funzionano le modalità di torneo e come personalizzarlo per offrirlo a qualsiasi circolo sportivo.

---

## 📌 Indice dei Contenuti
1. [Caratteristiche Principali](#1-caratteristiche-principali)
2. [Come Avviare il Software (in 1 Clic)](#2-come-avviare-il-software-in-1-clic)
3. [Credenziali di Accesso Predefinite](#3-credenziali-di-accesso-predefinite)
4. [Le 3 Modalità di Torneo](#4-le-3-modalità-di-torneo)
   - [A. Solo Gironi (All'italiana - Sola Andata)](#a-solo-gironi-allitaliana---sola-andata)
   - [B. Eliminazione Diretta (con Teste di Serie e BYE)](#b-eliminazione-diretta-con-teste-di-serie-e-bye)
   - [C. Gironi + Eliminazione Diretta (Gold & Silver)](#c-gironi--eliminazione-diretta-gold--silver)
5. [Schermo TV & Vista Pubblica Spettatori (Sola Lettura)](#5-schermo-tv--vista-pubblica-spettatori-sola-lettura)
6. [Come Personalizzare il Nome del Circolo](#6-come-personalizzare-il-nome-del-circolo)
7. [Come Preparare la Chiavetta USB da Offrire a un Club](#7-come-preparare-la-chiavetta-usb-da-offrire-a-un-club)
8. [Uso su Tablet o Smartphone (nello stesso Club)](#8-uso-su-tablet-o-smartphone-nello-stesso-club)
9. [Risoluzione dei Problemi Più Comuni (FAQ)](#9-risoluzione-dei-problemi-più-comuni-faq)

---

## 1. Caratteristiche Principali

- **100% Locale & Offline:** Non necessita di connessione internet per funzionare. Tutti i dati restano nel computer o nella pen drive.
- **Nessun Database da Installare:** I dati vengono memorizzati in file leggeri e sicuri nella cartella `backend/data/` (tecnologia NeDB integrata).
- **Zero Costi Mensili:** Nessun server cloud da pagare.
- **Portatile:** Puoi copiare l'intera cartella su una chiavetta USB e usarla ovunque.

---

## 2. Come Avviare il Software (in 1 Clic)

### 💻 Su Computer Windows
1. Apri la cartella del progetto (o la chiavetta USB).
2. Fai doppio clic su:
   ```text
   start-local.bat
   ```
3. **Cosa fa automaticamente lo script:**
   - Controlla se sul PC è presente Node.js. Se non c'è, **lo scarica e lo installa in automatico in silenzio**.
   - Avvia il server locale.
   - Apre in automatico il browser all'indirizzo: **`http://localhost:4000`**.

### 🍎 Su Computer Mac o Linux
1. Apri la cartella del progetto.
2. Apri il Terminale e lancia:
   ```bash
   ./start-local.sh
   ```
   *(oppure fai doppio clic sul file `start-local.sh` se hai abilitato l'esecuzione dei file `.sh`)*.
3. Il browser si aprirà automaticamente su **`http://localhost:4000`**.

---

## 3. Credenziali di Accesso Predefinite e Primo Accesso

All'avvio, l'applicazione dispone di un account amministratore predefinito:
- **Email:** `admin@padel.local`
- **Password iniziale:** `admin123`

*(Nella schermata di login è presente anche il comodo pulsante **"⚡ Compila credenziali predefinite"** per inserirle con un solo tocco).*

### 🔐 Configurazione Iniziale e Cambio Password al Primo Accesso
Per garantire la massima sicurezza e personalizzazione fin dal primo utilizzo:
1. Al **primo login** con la password iniziale `admin123`, l'applicazione rileva automaticamente il primo accesso e mostra la schermata dedicata: **"Primo Accesso Rilevato"**.
2. Ti verrà chiesto di compilare:
   - **Nome del Tuo Circolo / Club Padel:** (es. *"Padel Club Roma"* o *"Sporting Club"*). Questo valore viene salvato automaticamente nella variabile `CLUB_NAME` del file `.env` e personalizza subito l'intestazione, il menu e tutti i tabelloni.
   - **Nuova Password Personale** e **Conferma Nuova Password** (minimo 6 caratteri).
3. Cliccando su **"Salva Nuova Password ed Entra 🚀"**, la configurazione viene salvata all'istante, la password di default `admin123` viene sostituita per sempre e l'amministratore accede al pannello con il nome del proprio circolo già visibile nel menu.
4. In qualsiasi momento successivo, l'amministratore può modificare sia il nome del circolo che la password cliccando sul pulsante **"⚙️ Impostazioni"** nella barra di navigazione in alto.

---

## 4. Le 3 Modalità di Torneo

Al momento della creazione o modifica di un torneo, puoi scegliere tra **3 formule sportive**:

### A. Solo Gironi (All'italiana - Sola Andata)
- **Minimo partecipanti:** 3 coppie.
- **Formula:** **Solo Andata (round-robin singolo)**. Ogni coppia affronta ciascuna delle altre coppie del proprio girone **una sola volta** (nessun match di ritorno).
  - *Esempio con 5 coppie nel girone:* ogni coppia gioca 4 partite (contro le altre 4). Vengono generate esattamente $\frac{5 \times 4}{2} = 10$ partite complessive nel girone.
- **Classifica in Tempo Reale:** Calcola automaticamente le vittorie ($V$), le sconfitte ($S$) e la posizione in classifica all'inserimento di ogni risultato.

---

### B. Eliminazione Diretta (con Teste di Serie e BYE)
- **Minimo partecipanti:** 2 coppie.
- **Gestione Teste di Serie (⭐):** Le coppie contrassegnate come teste di serie vengono collocate automaticamente ai vertici opposti del tabellone (la #1 in cima e la #2 in fondo) per far sì che possano affrontarsi solo in Finale.
- **Gestione Automatica dei BYE (Passaggi del Turno):**  
  Quando il numero di coppie non è una potenza di 2 (es. 10 coppie in un tabellone da 16):
  - Il tabellone **non crea buchi o partite vuote**.
  - Assegna i passaggi automatici del turno (**`BYE 🚀`**) prioritariamente alle Teste di Serie.
  - *Esempio 10 coppie:* 6 coppie ricevono il BYE e vengono proiettate **già qualificate ai Quarti di finale**. Le restanti 4 coppie si affrontano negli Ottavi (2 partite giocate). I 2 vincitori raggiungono le 6 già qualificate, completando perfettamente gli 8 posti dei Quarti!

---

### C. Gironi + Eliminazione Diretta (Gold & Silver)
- **Minimo partecipanti:** 4 coppie.
- **Fase 1 (Gironi):** Le coppie disputano la fase a gironi di sola andata con classifica aggiornata.
- **Generazione Fase Finale:** Cliccando sul pulsante **"🥇 Genera Gold & Silver"**, il sistema genera istantaneamente due tabelloni a eliminazione diretta:
  - **Tabellone Gold 🥇:** Vi accedono le prime 2 classificate di ogni girone, con **incrocio federale automatico** (1° Girone A vs 2° Girone B, 1° Girone B vs 2° Girone A) per evitare che squadre dello stesso girone si riaffrontino subito.
  - **Tabellone Silver 🥈:** Vi accedono le terze classificate e successive, garantendo a tutti i partecipanti di continuare a giocare e divertirsi.
- **Flessibilità nei Test:** Puoi cliccare "Genera Gold & Silver" anche se non hai ancora inserito tutti i risultati: il tabellone verrà calcolato in base alla classifica maturata fino a quel momento. Una volta generato, il pulsante diventa **"🔄 Rigenera Gold & Silver"** per consentirti di ricalcolare i tabelloni in caso di modifiche ai punteggi dei gironi.

---

## 5. Schermo TV & Vista Pubblica Spettatori (Sola Lettura)

Per permettere a giocatori e pubblico di seguire l'andamento del torneo **in totale sicurezza** senza rischio che qualcuno modifichi punteggi o coppie:

- **100% Sola Lettura (Anti-Manomissione):** Non richiede login e non contiene alcun pulsante di modifica, eliminazione o inserimento risultati.
- **Aggiornamento Automatico in Tempo Reale (Live Polling):** La pagina controlla automaticamente ogni 15 secondi se ci sono nuovi punteggi inseriti dall'amministratore e aggiorna lo schermo all'istante senza bisogno di ricaricare il browser.
- **Modalità Schermo Intero (⛶):** Cliccando sull'apposita icona in alto a destra, la pagina entra in modalità fullscreen, ideale per proiettare i tabelloni sul monitor o sulla TV della club house del circolo.
- **Come aprirla o condividerla:**
  1. Dalla barra di navigazione in alto clicca su **`📺 Vista Live`**.
  2. Dalla scheda di qualsiasi torneo nel pannello amministratore puoi cliccare **"📺 Vista Live"** oppure **"📋 Copia Link Live"** per incollare il link diretto al torneo (es. `http://localhost:4000/live?id=...`).
  3. Se l'app gira su un PC connesso al Wi-Fi del club, chiunque può aprire il link dal proprio smartphone (es. `http://192.168.1.150:4000/live`).

---

## 6. Come Personalizzare il Nome del Circolo

Puoi personalizzare il nome del circolo in due modi semplicissimi:

### Metodo 1: Direttamente dall'interfaccia (Consigliato)
- Al primo login, l'applicazione ti chiede subito di inserire il nome del club.
- In qualunque momento successivo, puoi cliccare sul pulsante **"⚙️ Impostazioni"** nella barra di navigazione in alto e modificare il campo **"Nome del Circolo / Club"**. Il sistema aggiornerà automaticamente il file `.env` e i menu in tempo reale!

### Metodo 2: Modificando manualmente il file .env
1. Apri con il Blocco Note (o qualsiasi editor) il file:
   ```text
   backend/.env
   ```
2. Modifica la riga:
   ```env
   CLUB_NAME=Padel Club Roma
   ```
3. Salva il file. Al prossimo avvio l'applicazione caricherà il nuovo nome.

---

## 7. Come Preparare la Chiavetta USB da Offrire a un Club

Se desideri consegnare l'applicazione pronta all'uso su una pen drive a un club:

1. **Copia l'intera cartella** del progetto sulla chiavetta USB.
2. **Assicurati che siano presenti le cartelle:**
   - `backend/node_modules/` (le dipendenze già installate)
   - `frontend/dist/` (l'interfaccia già compilata)  
   *In questo modo il computer del club non avrà nemmeno bisogno di internet per iniziare.*
3. **Pulisci i dati di prova:**
   Se hai fatto test e vuoi consegnare il gestionale "pulito":
   - Apri la cartella `backend/data/`.
   - Svuota il file `tournaments.db` (aprilo con un editor di testo, cancella tutto il testo e salva).
   - Fai lo stesso con `players.db`. Al primo avvio, il software ricreerà automaticamente l'utente `admin@padel.local`.
4. **Istruzioni per il gestore del club:**
   Digli semplicemente:
   > *"Inserisci la chiavetta nel computer e fai doppio clic su `start-local.bat` (se Windows) o `./start-local.sh` (se Mac). Si aprirà da sola la pagina web con il gestionale tornei!"*

---

## 8. Uso su Tablet o Smartphone (nello stesso Club)

Il server è accessibile anche dagli smartphone o dai tablet collegati alla **stessa rete Wi-Fi del club**:

1. Sul computer dove gira l'app, scopri l'indirizzo IP locale (es. `192.168.1.150`).
2. Da qualsiasi tablet o telefono connesso al Wi-Fi del circolo, apri il browser e digita:
   ```text
   http://192.168.1.150:4000
   ```
3. Potrai aggiornare i risultati dei match comodamente da bordo campo con il tablet o lo smartphone!

---

## 9. Risoluzione dei Problemi Più Comuni (FAQ)

### ❓ Ricevo l'errore "404 Not Found" quando clicco un pulsante
- **Causa:** Il server Node.js in esecuzione nel terminale è ancora una versione precedente avviata prima delle ultime modifiche al codice.
- **Soluzione:** Vai nel terminale dove hai avviato il server, premi **`Ctrl + C`** per arrestarlo e rilancia `./start-local.sh` o `start-local.bat`. Poi ricarica la pagina con **F5 / Cmd+R**.

### ❓ La porta 4000 risulta occupata ("EADDRINUSE")
- **Causa:** C'è già un'altra istanza del server aperta in background.
- **Soluzione:** Chiudi le finestre nere del terminale aperte in precedenza, oppure riavvia il computer prima di rilanciare lo script.

### ❓ Il computer Windows non ha connessione internet e manca Node.js
- **Soluzione:** Puoi scaricare preventivamente l'installer offline di Node.js LTS dal sito [nodejs.org](https://nodejs.org) e salvarlo sulla chiavetta USB nella cartella `installer/`, in modo da poterlo installare con un clic anche in assenza totale di rete.

