# spalum-ai ⏰

Script **Node.js + TypeScript** che legge i dati di presenza dal portale
aziendale e invia una notifica push sullo smartphone **esattamente al momento
giusto** — niente polling ogni N minuti, un singolo `setTimeout` preciso.

**Stack**: Node.js 20 · TypeScript · Playwright · ntfy · Alpine Linux · Podman

---

## Come funziona

```
avvio container
      │
      ▼
scrape pagina (Chromium headless + cookie)
      │
      ├─ entrata non trovata? ──► sleep 5 min ──► retry
      │
      ▼
parse #ext-element-96  → debito orario  (es. "8:00")
parse #ext-element-120 → timbrature     (es. "E07.33@01 U--.--")
      │
      ▼
uscita_teorica = entrata + debito
notifica_at    = uscita_teorica − NOTIFY_MINUTES_BEFORE
      │
      ▼
sleep(notifica_at − now)   ← processo dorme esattamente fino a quell'istante
      │
      ▼
POST ntfy → notifica push su smartphone
      │
      ▼
processo termina
```

Il container rimane vivo (in sleep) per tutta la giornata lavorativa.
Un solo scraping al mattino è sufficiente.

---

## Struttura progetto

```
spalum-ai/
├── src/
│   ├── index.ts        ← entry point, orchestrazione
│   ├── config.ts       ← carica variabili d'ambiente
│   ├── cookies.ts      ← carica e normalizza cookies.json per Playwright
│   ├── parser.ts       ← parsifica i div del portale
│   └── notifier.ts     ← invia notifica via ntfy (fetch nativo)
├── Containerfile       ← multi-stage build: builder (tsc) + runner (Alpine)
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
```

---

## 1. Esporta i cookie da Chrome

1. Installa l'estensione **"Get cookies.txt LOCALLY"** (Chrome Web Store)
2. Naviga sulla pagina presenze dove sei già autenticato
3. Clicca sull'icona → seleziona formato **JSON**
4. Salva come `cookies.json` nella cartella `spalum-ai/`

> ⚠️ `cookies.json` contiene le tue credenziali di sessione.
> È già in `.gitignore` — non rimuoverlo mai da lì.

---

## 2. Configura le variabili d'ambiente

```bash
cp .env.example .env
nano .env
```

Genera un topic ntfy segreto:

```bash
openssl rand -hex 12
# es: a3f9b2c1d4e5f6a7b8c9d0e1
```

| Variabile               | Obbligatoria | Default             | Descrizione                      |
| ----------------------- | ------------ | ------------------- | -------------------------------- |
| `TARGET_URL`            | ✅           | —                   | URL esatto della pagina presenze |
| `NTFY_TOPIC`            | ✅           | —                   | Topic ntfy segreto               |
| `NTFY_SERVER`           |              | `https://ntfy.sh`   | Server ntfy                      |
| `COOKIES_FILE`          |              | `/app/cookies.json` | Percorso cookie nel container    |
| `NOTIFY_MINUTES_BEFORE` |              | `5`                 | Minuti di preavviso              |

---

## 3. Installa ntfy sullo smartphone

| Piattaforma          | Link                                                         |
| -------------------- | ------------------------------------------------------------ |
| Android (F-Droid)    | https://f-droid.org/packages/io.heckel.ntfy/                 |
| Android (Play Store) | https://play.google.com/store/apps/details?id=io.heckel.ntfy |
| iOS                  | https://apps.apple.com/app/ntfy/id1625396347                 |

Apri l'app → **Subscribe to topic** → inserisci il tuo topic segreto.

---

## 4. Sviluppo con Podman

### Build immagine

```bash
podman build -t spalum-ai .
```

### Test esecuzione singola

```bash
podman run --mount type=bind,source=$(pwd)/cookies.json,target=/cookies.json,readonly spalum-ai
```

### Visualizza log in tempo reale

```bash
podman logs -f spalum-ai
```

### Debug interattivo (shell nel container)

```bash
podman run --rm -it \
  --env-file .env \
  -v $(pwd)/cookies.json:/app/cookies.json:ro,z \
  --entrypoint sh \
  spalum-ai
```

---

## 5. Produzione (avvio automatico ogni mattina)


### Installazione


---

## 6. Deploy su VM/server headless

```bash
# Copia i cookie dal PC locale (una volta l'anno circa):
scp cookies.json utente@server:/home/utente/spalum-ai/cookies.json

# Sul server: clone/copia cartella, poi build e systemd come sopra
podman build -t spalum-ai .

podman run --mount type=bind,source=$(pwd)/cookies.json,target=/cookies.json,readonly spalum-ai
```

---

## 7. Troubleshooting

| Sintomo                       | Causa                       | Soluzione                                                |
| ----------------------------- | --------------------------- | -------------------------------------------------------- |
| `#ext-element-96 timeout`     | ID div cambiato             | Verifica con DevTools (F12) gli ID attuali               |
| Redirect al login             | Cookie scaduti              | Riesporta da Chrome, sostituisci `cookies.json`          |
| `chromium-browser: not found` | Percorso diverso in Alpine  | `podman run --rm --entrypoint which spalum-ai chromium` |
| Notifica non arriva           | Topic errato                | Controlla `.env` e la subscription sull'app              |
| Container si chiude subito    | Errore parse / var mancante | `podman logs spalum-ai`                                 |
