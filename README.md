# 🍠 YAM — You And Me

App couple privée. Architecture modulaire v2 — Supabase + Edge Functions + PWA.

---

## 📁 Structure des fichiers

```
yam-app/
├── index.html                 (3 029 lignes) — HTML pur, zéro CSS inline, zéro JS inline
├── css/
│   └── main.css               (5 106 lignes) — Tout le CSS de l'app
├── js/
│   ├── app-core.js            (  661 lignes) — iOS fixes · Supabase config · Auth · Thème · Présence
│   ├── app-account.js         (1 633 lignes) — Compte · Login/Register · Couple · Avatars · Humeurs
│   ├── app-nous.js            (1 320 lignes) — Section Nous ♥ · Photos Elle/Lui · Petits mots · Mémo · Souvenirs · Activités
│   ├── app-music.js           (1 270 lignes) — Top 50 · Player · Suggestions · Favoris · Now Listening · Glow
│   ├── app-games.js           (1 099 lignes) — Memory · Pendu · Puzzle · Snake · Quiz · Leaderboard
│   ├── app-multiplayer.js     (  694 lignes) — Moteur multijoueur générique (présence, lobby, poll, saveState)
│   ├── app-skyjo.js           (1 444 lignes) — Skyjo multijoueur temps réel (logique cartes + rendu)
│   ├── app-pranks.js          (1 316 lignes) — 13 bêtises interactives · File d'attente · Déclenchement victime
│   ├── app-messages.js        (1 354 lignes) — InstaLove (DM) · Messages texte/audio · Réactions · Notif pilule
│   ├── app-events.js          (  121 lignes) — Anniversaire mensuel (le 29) · Confettis · Bannière
│   └── app-nav.js             (1 767 lignes) — Tabs · Navigation · Accueil · Deck raisons · UX · showToast · haptic
├── assets/
│   ├── icons/                 — Icônes PWA (152, 167, 180, 192, 512)
│   ├── images/                — Fallbacks locaux + images réactions
│   ├── music/                 — Fichiers audio locaux (Top 50)
│   └── sounds/                — Effets sonores
├── supabase/
│   └── functions/
│       └── auth-v2/
│           └── index.ts       — Edge Function Deno (auth custom)
├── service-worker.js          — Cache-First + stale-while-revalidate
├── manifest.json              — PWA config
└── README.md
```

> ⚠️ **`app-love.js` est définitivement supprimé.** Tout son contenu est dans `app-nous.js`. Ne plus jamais le référencer.

---

## ✏️ Quel fichier modifier selon la tâche ?

| Tâche | Fichier |
|---|---|
| Config Supabase (URL, clé, Edge URL, secret) | `js/app-core.js` lignes 86–89 |
| Auth, login, register, couple, avatars, humeurs | `js/app-account.js` |
| Section Nous ♥ — photos, petits mots, mémo, souvenirs | `js/app-nous.js` |
| **Ajouter une chanson au Top 50** | `js/app-music.js` → tableau `songsLove` |
| Player, favoris, suggestions, now listening | `js/app-music.js` |
| Modifier un jeu (Memory, Pendu, Puzzle, Snake, Quiz) | `js/app-games.js` |
| Skyjo multijoueur | `js/app-skyjo.js` + `js/app-multiplayer.js` |
| Ajouter / modifier une bêtise | `js/app-pranks.js` |
| Messages / InstaLove | `js/app-messages.js` |
| Anniversaire mensuel, événements saisonniers | `js/app-events.js` |
| Navigation, tabs, animations, UX | `js/app-nav.js` |
| CSS, thème, couleurs, composants | `css/main.css` |
| Structure HTML (IDs, sections, modales) | `index.html` |
| Edge Function auth (register/login/join/...) | `supabase/functions/auth-v2/index.ts` |

---

## 🔗 Ordre de chargement (impératif)

```html
<script src="js/app-core.js"></script>        <!-- 1. Base — requis par tous -->
<script src="js/app-account.js"></script>     <!-- 2. Auth/Compte -->
<script src="js/app-nous.js"></script>        <!-- 3. Section Nous ♥ -->
<script src="js/app-music.js"></script>       <!-- 4. Musique -->
<script src="js/app-games.js"></script>       <!-- 5. Jeux solo -->
<script src="js/app-multiplayer.js"></script> <!-- 6. Moteur multijoueur -->
<script src="js/app-skyjo.js"></script>       <!-- 7. Skyjo (dépend de app-multiplayer) -->
<script src="js/app-pranks.js"></script>      <!-- 8. Bêtises -->
<script src="js/app-messages.js"></script>    <!-- 9. Messages -->
<script src="js/app-events.js"></script>      <!-- 10. Événements -->
<script src="js/app-nav.js"></script>         <!-- 11. Navigation — EN DERNIER -->
```

---

## 🗄️ Architecture backend

| Composant | Tech | Détail |
|---|---|---|
| Base de données | Supabase (PostgreSQL) | 23 tables préfixées `v2_` — RLS activée sur toutes |
| Authentification | Edge Function Deno | auth-v2 — pseudo + SHA-256+salt — sessions 7j en base |
| Stockage fichiers | Supabase Storage | Bucket `images` — avatars + photos couple + souvenirs |
| Clé publique | `SB2_KEY` (anon) | Dans app-core.js — lecture/écriture via RLS |
| Clé secrète | `SB2_APP_SECRET` | Partagée client/Edge — ne pas utiliser pour données sensibles |

---

## 📊 Dépendances entre modules

```
index.html ──► css/main.css

           ──► js/app-core.js              (aucune dépendance)
                    │
                    ├──► js/app-account.js   (expose setProfile, sbGet, sbPost…)
                    │         │
                    │         ├──► js/app-nous.js       (patch setProfile + hook session)
                    │         ├──► js/app-music.js
                    │         ├──► js/app-games.js
                    │         ├──► js/app-messages.js
                    │         └──► js/app-pranks.js
                    │
                    ├──► js/app-multiplayer.js
                    │         └──► js/app-skyjo.js
                    │
                    └──► js/app-events.js   (IIFE autonome — aucune dépendance)

                    └──► js/app-nav.js      (EN DERNIER — patche les autres)
```

---

## ⚠️ Points critiques à retenir

### RLS Supabase — règle d'or
Si des données disparaissent ou retournent `[]` silencieusement, **vérifier en premier** :
```sql
-- Pour chaque table concernée :
ALTER TABLE ma_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_anon" ON ma_table FOR ALL USING (true) WITH CHECK (true);
```

### Timing session (section Nous)
`nousLoad()` est appelé avant que `setProfile()` établisse la session. Le fix est dans le **hook setProfile** de `app-nous.js` section 15 — ne pas le supprimer.

### v2_memo_notes
La colonne texte s'appelle **`text`** (pas `content`). Le code envoie `{text, title, updated_at}`.

---

## 🚀 Workflow Git

```bash
# Feature par feature
git checkout -b feat/nom-de-la-feature
# Modifier UNIQUEMENT le(s) fichier(s) concerné(s)
git add js/app-nous.js
git commit -m "feat(nous): description précise"
git push origin feat/nom-de-la-feature

# Conventions de commit
# feat(module):  nouvelle fonctionnalité
# fix(module):   correction de bug
# refactor:      refactoring sans changement fonctionnel
# style:         CSS uniquement
# docs:          mise à jour guide/README
```

---

## 🔧 Déploiement Edge Function

```bash
supabase functions deploy auth-v2

# Variables d'environnement à configurer dans Supabase Dashboard :
# SUPABASE_URL             = https://jstiwtbgkbedtldqjdhp.supabase.co
# SUPABASE_SERVICE_ROLE_KEY = eyJ...
# APP_SECRET               = Kx9mPvR3wLjN7qTnYc4Zd
```

---

## 📱 PWA

- **Service Worker** : Cache-First + stale-while-revalidate — cache name `yam-v2`
- **Installable** : iOS (Safari → Partager → Sur l'écran d'accueil) + Android (Chrome → Installer)
- **Après mise à jour JS/CSS** : incrémenter `CACHE_NAME` dans `service-worker.js` pour forcer le rechargement

---

*Guide complet détaillé : voir `YAM_Guide_v6.pdf`*
