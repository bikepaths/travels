# Bikepaths Travels Archive

Static database and web portal containing the public travel logs, archives, and posts of `@bikepaths`.

## Directory Map

```text
/
├── README.md                      # Build and maintenance documentation
├── index.html                     # Core web interface (Single-Page App)
├── assets/                        # Design styles and runtime scripts
│   ├── css/style.css              # Premium glassmorphic design sheets
│   └── js/app.js                  # Async JSON dataset loader and search engine
├── data/                          # Sanitized chronological dialogue logs
│   ├── channels/
│   │   └── travels_w_chas/        # Travels w/Chas monthly archives
│   └── groups/
│       ├── bikepaths_2018_archive/# Bikepaths 2018 monthly archives
│       └── bikepaths_posts/       # Posts monthly archives
├── media/                         # Downloaded image and document attachments
└── scripts/                       # Archival synchronization utilities
    └── extract_logs.py            # Telethon data extractor and media downloader
```

## Running the Data Extractor

To fetch new messages and download associated media, run:

```bash
python3 scripts/extract_logs.py
```

## Local Development

To run the static interface locally:

```bash
# Start a simple server from the root of this repository
python3 -m http.server 8000
```

Open `http://localhost:8000` in the browser.

## Deployment to GitHub Pages

1. Create a public repository named `travels` on GitHub under the `@bikepaths` account.
2. Link the local repository:
   ```bash
   git remote add origin https://github.com/bikepaths/travels.git
   ```
3. Commit and push the files:
   ```bash
   git add .
   git commit -m "Initialize travels web archive and data logs"
   git push -u origin main
   ```
4. Enable **GitHub Pages** under repository **Settings > Pages** selecting the `main` branch root directory `/` as source.
