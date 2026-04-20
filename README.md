# 🍠 YAM — You And Me

App couple privée. Architecture modulaire v15 — Supabase Auth natif + Edge Functions + PWA.

---

## 📁 Structure des fichiers

```
yam-app/
├── index.html                   (6 493 lignes) — HTML pur, zéro JS inline, CSP stricte
├── css/
│   ├── main.css                 (~5 700 lignes) — Tout le CSS — thème warm/dark — animations — composants
│   └── design-system.css        (  617 lignes) — Design system Apple/iOS — chargé APRÈS main.css
├── js/
│   ├── app-ios-touch.js         (  582 lignes) — Tactile iOS : pull-to-refresh, clavier, drag, backdrop — PREMIER ABSOLU
│   ├── app-core.js              (1 185 lignes) — Supabase config · Auth v3 JWT · Présence · Push · Realtime · v2ApplyDynamicNames
│   ├── app-realtime-init.js     (    4 lignes) — Lance window._yamInitRealtime() — requis par CSP
│   ├── app-account.js           (3 817 lignes) — Compte · Login/Register · 2FA TOTP · Couple · Avatars · Humeurs + message d'humeur
│   ├── app-nous.js              (5 672 lignes) — Section Nous ♥ · Photos Elle/Lui · Petits mots · Mémo · Souvenirs · Activités
│   │                                             · Notre Histoire · Livres · Suggestions semaine · Flamme · Bulle vidéo
│   │                                             · Le Nid (onboarding progressif) · Suggestions semaine IA
│   ├── app-music.js             (1 243 lignes) — Top 49 titres · Player audio · Now Listening · Suggestions · Favoris
│   ├── app-games.js             (1 371 lignes) — Pendu · Puzzle · Snake · Quiz (jeux solo)
│   ├── app-memory.js            (4 861 lignes) — Memory v2 : 6 modes (Classique+, Echo, Architecte, ALL, Hanabi, The Mind)
│   ├── app-multiplayer.js       (  796 lignes) — Moteur multijoueur générique (présence, lobby, poll, saveState)
│   ├── app-books.js             (1 890 lignes) — Lire ensemble : Gutenberg API · lecture asynchrone + synchronisée
│   │                                             · catalogue ~50 classiques FR · annotations · sessions co-lecture
│   ├── app-cowatch.js           (1 912 lignes) — Regarder ensemble v4.0 · co-contrôle bidirectionnel · playlist · live pill
│   ├── app-skyjo.js             (1 590 lignes) — Skyjo multijoueur temps réel
│   ├── app-ocho.js              (1 804 lignes) — Ocho multijoueur (type UNO) — 96 cartes SVG, 6 manches
│   ├── app-pranks.js            (1 437 lignes) — 13 bêtises interactives · Realtime + fallback poll 15s
│   ├── app-messages.js          (2 736 lignes) — InstaLove DM · texte/audio/photo · Réactions JSON · Realtime · badge
│   ├── app-events.js            (  981 lignes) — Événements couple · 4 types · récurrence mensuelle/hebdo/annuelle
│   │                                             · push rappels · badge J-n · migration auto mensiversaire
│   ├── app-nav.js               (1 917 lignes) — Navigation · Tabs · Accueil · Sticky header · Polls adaptatifs
│   ├── app-jeux-dashboard.js    (  699 lignes) — Dashboard jeux — scores VS, leaderboard, lobby présence
│   ├── app-home.js              (  606 lignes) — Mascotte IA · Rappels du jour IA (Groq) · Sync humeurs · Spam cœurs
│   ├── app-diary.js             (3 102 lignes) — My Diary : journal intime · texte riche · images · Canva · partage couple
│   │                                             · commentaires · co-écriture · Realtime
│   └── app-inline.js            (  713 lignes) — Blocs transversaux CSP (BLOCS 1-5, 6b, 10, 11) + event listeners
├── assets/
│   ├── icons/                   — Icônes PWA (152, 167, 180, 192, 512)
│   ├── images/                  — Fallbacks locaux + images réactions + home-screen.jpg
│   ├── music/                   — Fichiers audio locaux (Top 49)
│   └── sounds/                  — Effets sonores
├── supabase/
│   └── functions/
│       ├── auth-v3/index.ts     — Auth : 14 actions · 2FA TOTP · rate limiting
│       ├── gemini-suggest/index.ts — IA Groq llama-3.3-70b-versatile
│       ├── yam-init/index.ts    — Batch 14 fetches chargement onglet Nous
│       ├── push-notify/index.ts — Web Push VAPID
│       ├── piped-search/index.ts — Recherche YouTube (Invidious)
│       ├── canva-proxy/index.ts — Proxy CORS Canva oEmbed
│       └── yam-cleanup/index.ts — Cron : purge audio >30j + errors_log >30j
├── service-worker.js            — Cache-First + Network-First index.html — CACHE_NAME: yam-v87
├── manifest.json                — PWA — short_name: "YAM"
└── README.md
```

> ⚠️ **`app-love.js` est définitivement supprimé.** Tout son contenu est dans `app-nous.js`.

---

## ✏️ Quel fichier modifier selon la tâche ?

| Tâche | Fichier |
|---|---|
| Config Supabase (URL, clé anon, Edge URL) | `js/app-core.js` lignes 8–14 |
| Auth, login, register, couple, 2FA, avatars, humeurs | `js/app-account.js` |
| Message d'humeur personnalisé | `js/app-account.js` → `window._myMoodMessage` |
| Section Nous ♥ — photos, petits mots, mémo, souvenirs, activités | `js/app-nous.js` |
| Notre Histoire (timeline) | `js/app-nous.js` section 15 |
| Flamme de couple, streak, trophées | `js/app-nous.js` section Flamme |
| Suggestions semaine IA | `js/app-nous.js` → `semaineGenerate()` |
| Le Nid (onboarding progressif sections Nous) | `js/app-nous.js` section _nid* |
| Bulle vidéo événement | `js/app-nous.js` section Bulle vidéo |
| **Ajouter une chanson au Top 49** | `js/app-music.js` → tableau `songsLove` |
| Player, favoris, suggestions, now listening | `js/app-music.js` |
| Modifier un jeu solo (Pendu, Puzzle, Snake, Quiz) | `js/app-games.js` |
| Memory v2 (6 modes) | `js/app-memory.js` |
| Skyjo multijoueur | `js/app-skyjo.js` + `js/app-multiplayer.js` |
| Ocho multijoueur | `js/app-ocho.js` + `js/app-multiplayer.js` |
| Dashboard jeux (scores VS, leaderboard, lobby) | `js/app-jeux-dashboard.js` |
| Ajouter / modifier une bêtise | `js/app-pranks.js` |
| Messages / InstaLove / photos DM | `js/app-messages.js` |
| Événements couple (anniversaires, voyages…) | `js/app-events.js` |
| Regarder ensemble (YouTube co-watch) | `js/app-cowatch.js` |
| Lire ensemble (Gutenberg) | `js/app-books.js` |
| Mon Diary (journal intime) | `js/app-diary.js` |
| Mascotte IA, rappels du jour, spam cœurs | `js/app-home.js` |
| Navigation, tabs, animations, UX | `js/app-nav.js` |
| CSS, thème, couleurs, composants | `css/main.css` |
| Design system iOS | `css/design-system.css` |
| Structure HTML (IDs, sections, modales) | `index.html` |
| Edge Function auth | `supabase/functions/auth-v3/index.ts` |
| Edge Function IA (mots doux, rappels, activités) | `supabase/functions/gemini-suggest/index.ts` |
| Edge Function proxy Canva | `supabase/functions/canva-proxy/index.ts` |

---

## 🔗 Ordre de chargement (impératif)

```html
<!-- 0. CDN Supabase — AVANT app-core.js -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

<script src="js/app-ios-touch.js"></script>      <!-- 1. Tactile iOS — PREMIER ABSOLU -->
<script src="js/app-core.js"></script>            <!-- 2. Base — requis par tous -->
<script src="js/app-realtime-init.js"></script>   <!-- 3. Lance _yamInitRealtime() -->
<script src="js/app-account.js"></script>         <!-- 4. Auth/Compte/2FA -->
<script src="js/app-nous.js"></script>            <!-- 5. Section Nous ♥ -->
<script src="js/app-music.js"></script>           <!-- 6. Musique -->
<script src="js/app-memory.js"></script>          <!-- 7. Memory v2 — dépend de app-multiplayer -->
<script src="js/app-games.js"></script>           <!-- 8. Jeux solo -->
<script src="js/app-multiplayer.js"></script>     <!-- 9. Moteur multijoueur -->
<script src="js/app-books.js"></script>           <!-- 10. Lire ensemble -->
<script src="js/app-cowatch.js"></script>         <!-- 11. Regarder ensemble -->
<script src="js/app-skyjo.js"></script>           <!-- 12. Skyjo -->
<script src="js/app-ocho.js"></script>            <!-- 13. Ocho -->
<script src="js/app-pranks.js"></script>          <!-- 14. Bêtises -->
<script src="js/app-messages.js"></script>        <!-- 15. Messages -->
<script src="js/app-events.js"></script>          <!-- 16. Événements -->
<script src="js/app-nav.js"></script>             <!-- 17. Navigation -->
<script src="js/app-jeux-dashboard.js"></script>  <!-- 18. Dashboard jeux -->
<script src="js/app-home.js"></script>            <!-- 19. Accueil IA -->
<script src="js/app-diary.js"></script>           <!-- 20. My Diary -->
<script src="js/app-inline.js"></script>          <!-- 21. Blocs CSP — EN DERNIER ABSOLU -->
```

---

## 🗄️ Architecture backend

| Composant | Tech | Détail |
|---|---|---|
| Base de données | Supabase PostgreSQL | ~57 tables — RLS via `auth.uid()` + `yam_couple_id()` SECURITY DEFINER |
| Authentification | Edge Function `auth-v3` (Deno) | JWT ES256 · sessions localStorage `yam_session_v3` · refresh auto |
| 2FA | Supabase MFA TOTP | Google Authenticator · enrollment QR code · vérification au login |
| Stockage fichiers | Supabase Storage | Bucket `images` — avatars · photos couple · souvenirs · diary |
| IA | Groq `llama-3.3-70b-versatile` | Edge Function `gemini-suggest` — mots doux · rappels · activités · livres · semaine |
| Realtime | Supabase Realtime WebSocket | ~13 channels actifs — fallback poll automatique sur CHANNEL_ERROR |
| Push | VAPID Web Push | Edge Function `push-notify` · table `push_subscriptions` |
| PWA | Service Worker `yam-v87` | Network-First `index.html` · Cache-First assets |

---

## 📊 Dépendances entre modules

```
index.html ──► css/main.css ──► css/design-system.css

           ──► js/app-ios-touch.js      (aucune dépendance — PREMIER)
           ──► js/app-core.js           (aucune dépendance)
                    │
                    ├──► js/app-account.js    (expose setProfile, yamGetUser, sb2Headers…)
                    │         │
                    │         ├──► js/app-nous.js       (hook setProfile + Le Nid + Flamme)
                    │         ├──► js/app-music.js
                    │         ├──► js/app-games.js
                    │         ├──► js/app-messages.js
                    │         ├──► js/app-diary.js
                    │         └──► js/app-pranks.js
                    │
                    ├──► js/app-multiplayer.js
                    │         ├──► js/app-skyjo.js
                    │         ├──► js/app-ocho.js
                    │         └──► js/app-memory.js
                    │
                    ├──► js/app-books.js      (IIFE autonome — Gutenberg API)
                    ├──► js/app-cowatch.js    (écoute yam:tab_switched)
                    ├──► js/app-events.js     (IIFE autonome — couple_events)
                    └──► js/app-nav.js        (EN DERNIER avant inline — yam:tab_switched)
                              │
                              ├──► js/app-jeux-dashboard.js  (après app-nav.js)
                              ├──► js/app-home.js            (après app-jeux-dashboard.js)
                              ├──► js/app-diary.js           (après app-home.js)
                              └──► js/app-inline.js          (EN DERNIER ABSOLU)
```

---

## ⚠️ Points critiques à retenir

### RLS Supabase — règle d'or
Si des données disparaissent ou retournent `[]` silencieusement :
```sql
ALTER TABLE ma_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_isolation" ON ma_table
  FOR ALL USING (couple_id = yam_couple_id())
  WITH CHECK (couple_id = yam_couple_id());
```

### Timing session (section Nous)
`nousLoad()` peut être appelé avant que `setProfile()` établisse la session. Le fix est dans le **hook setProfile** de `app-nous.js` section 15 — ne pas le supprimer.

### Nouvelles tables — RLS obligatoire
`diary_pages`, `diary_comments`, `couple_events`, `book_library`, `book_reads`, `book_sessions`, `book_presence`, `book_annotations` nécessitent toutes la policy `couple_isolation`.

### CACHE_NAME
Toujours incrémenter `CACHE_NAME` (`yam-v87` → `yam-v88`) après toute mise à jour JS/CSS. Sur iOS, fermer complètement Safari puis rouvrir.

### Tout nouveau fichier JS
L'ajouter dans `STATIC_ASSETS` du `service-worker.js` ET dans `index.html` au bon endroit dans l'ordre de chargement.

### CSP — app-inline.js EN DERNIER
Tout script inline résiduel dans `index.html` cassera la CSP. Tous les handlers sont dans `app-inline.js` via `addEventListener`.

### compressImage() — HEIC non supporté
Afficher un toast d'erreur explicite pour les fichiers `.heic`/`.heif` — ne jamais tenter la compression canvas sur ce format.

---

## 🚀 Workflow Git

```bash
git checkout -b feat/nom-de-la-feature
# Modifier UNIQUEMENT le(s) fichier(s) concerné(s)
git add js/app-diary.js
git commit -m "feat(diary): description précise"
git push origin feat/nom-de-la-feature

# Conventions de commit
# feat(module):   nouvelle fonctionnalité
# fix(module):    correction de bug
# refactor:       refactoring sans changement fonctionnel
# style:          CSS uniquement
# docs:           mise à jour guide/README
```

---

## 🔧 Déploiement Edge Functions

```bash
supabase functions deploy auth-v3
supabase functions deploy gemini-suggest
supabase functions deploy yam-init
supabase functions deploy push-notify
supabase functions deploy canva-proxy          # --no-verify-jwt obligatoire
supabase functions deploy yam-cleanup

# Variables d'environnement (Supabase Dashboard → Settings → Edge Functions) :
# SUPABASE_URL              = https://jstiwtbgkbedtldqjdhp.supabase.co
# SUPABASE_SERVICE_ROLE_KEY = eyJ...   (auto-injecté)
# SUPABASE_ANON_KEY         = eyJ...   (auto-injecté)
# GROQ_API_KEY              = gsk_...  (NE JAMAIS exposer côté client)
# VAPID_PUBLIC_KEY          = BNZes... (doit correspondre à _VAPID_PUBLIC_KEY dans app-core.js)
# VAPID_PRIVATE_KEY         = ...      (NE JAMAIS exposer côté client)
# VAPID_SUBJECT             = jacoob.jr22@gmail.com
```

---

## 📱 PWA

- **Service Worker** : `CACHE_NAME: yam-v87` — Network-First `index.html` · Cache-First assets
- **Installable** : iOS (Safari → Partager → Sur l'écran d'accueil) + Android (Chrome → Installer)
- **Après mise à jour JS/CSS** : incrémenter `CACHE_NAME` dans `service-worker.js`

---

## 🗺️ Onglets de l'app

| Onglet | ID panel | Nav ID | Chargé par |
|---|---|---|---|
| Accueil | `yamHomeTab` | `navHome` | `app-home.js` + `app-nav.js` |
| Messages | `yamMessagesTab` | `navMessages` | `app-messages.js` |
| Jeux | `yamJeuxTab` | `navJeux` | `app-jeux-dashboard.js` |
| Musique | `yamMusiqueTab` | `navMusique` | `app-music.js` |
| Nous ♥ | `yamNousTab` | `navNous` | `app-nous.js` |

**Vues hors-onglets** (slides depuis yamJeuxTab) : `gamesView`, `memoryView`, `skyjoView`, `ochoView`, `bookView`, `diaryView`, `cowatchView`

---

*Guide technique complet : voir `YAM_Guide_v15.pdf` et `YAM_Guide_v15.md`*
