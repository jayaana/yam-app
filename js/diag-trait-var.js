/* DIAG-TRAIT (temporaire) : choisit la variante avant le corps de la page */
try { var v = localStorage.getItem('dtVar'); if (v) document.documentElement.classList.add('dt-v' + v); } catch (e) {}
