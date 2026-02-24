# 🍠 YAM — You And Me

App couple privée. Structure modulaire V3.

---

## 📁 Structure

```
yam-app/
├── index.html              (1 817 lignes) — HTML pur, zéro CSS, zéro JS inline
├── css/
│   └── main.css            (4 676 lignes) — Tout le CSS de l'app
├── js/
│   ├── app-core.js         (  263 lignes) — iOS fix · Supabase · Auth · Thème
│   ├── app-love.js         (  994 lignes) — Photos Elle/Lui · Raisons · Post-its · Mémo couple
│   ├── app-music.js        (1 764 lignes) — Top 50 · Player · Suggestions · Favoris · Glow
│   ├── app-games.js        (3 212 lignes) — Memory · Pendu · Puzzle · Snake · Skyjo · Quiz
│   ├── app-pranks.js       (1 297 lignes) — 13 bêtises interactives
│   ├── app-messages.js     (1 353 lignes) — InstaLove · DM · Notif pilule
│   ├── app-events.js       (  119 lignes) — Anniversaire mensuel (+ futurs événements)
│   └── app-nav.js          (1 822 lignes) — Tabs · Navigation · Accueil · UX · Perf
├── assets/
│   ├── images/             — Fallbacks locaux (image-1.jpg … image-9.jpg)
│   ├── videos/             — video-1.mp4
│   ├── music/              — Fichiers audio locaux
│   └── sounds/             — Effets sonores
├── .gitignore
└── README.md
```

---

## ✏️ Quel fichier selon la tâche ?

| Tâche | Fichier |
|---|---|
| Config Supabase, auth, thème | `js/app-core.js` |
| Photos Elle/Lui, raisons, post-its, mémo | `js/app-love.js` |
| **Ajouter une chanson au Top 50** | `js/app-music.js` → `songsLove` |
| Player, mini player, suggestions chansons | `js/app-music.js` |
| Modifier un jeu / ajouter un jeu | `js/app-games.js` |
| Ajouter / modifier une bêtise | `js/app-pranks.js` |
| Messages / InstaLove | `js/app-messages.js` |
| Anniversaire / événements saisonniers | `js/app-events.js` |
| Navigation, tabs, animations, UX | `js/app-nav.js` |
| CSS, thème, couleurs | `css/main.css` |
| Structure HTML | `index.html` |

---

## 🔗 Ordre de chargement

```html
<script src="js/app-core.js"></script>      <!-- 1. Base — requis par tous -->
<script src="js/app-love.js"></script>       <!-- 2. Page Nous -->
<script src="js/app-music.js"></script>      <!-- 3. Page Musique -->
<script src="js/app-games.js"></script>      <!-- 4. Page Jeux -->
<script src="js/app-pranks.js"></script>     <!-- 5. Bêtises -->
<script src="js/app-messages.js"></script>   <!-- 6. Messages -->
<script src="js/app-events.js"></script>     <!-- 7. Événements -->
<script src="js/app-nav.js"></script>        <!-- 8. Navigation (en dernier) -->
```

---

## 🚀 Mise en place GitHub

```bash
git init
git remote add origin https://github.com/TON_USER/yam-app.git
git add .
git commit -m "feat: YAM V3 — structure modulaire"
git push -u origin main
```

### Workflow feature par feature

```bash
# Ajouter une chanson
git checkout -b feat/top50-ajout
# → Modifier UNIQUEMENT js/app-music.js
git add js/app-music.js
git commit -m "feat(music): ajouter Perfect de Ed Sheeran"
git push origin feat/top50-ajout
```

---

## 📊 Dépendances

```
index.html ──► css/main.css

           ──► js/app-core.js        (aucune dépendance)
                    │
                    ├──► js/app-love.js
                    ├──► js/app-music.js
                    ├──► js/app-games.js
                    ├──► js/app-pranks.js
                    ├──► js/app-messages.js
                    ├──► js/app-events.js
                    └──► js/app-nav.js      (en dernier — patche les autres)
```

`app-core.js` expose `getProfile()`, `sbGet()`, `sbPost()`, `SB_URL`, etc. — utilisés partout.  
`app-nav.js` est chargé **en dernier** car il patche des fonctions définies dans les autres fichiers.
