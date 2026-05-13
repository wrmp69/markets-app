# GymLog K&J — refonte

Version refondue en modules. Ouvre `index.html` ou déploie le dossier sur GitHub Pages.

## Ce qui change
- Une seule source de vérité : `gl_app_v3`
- Migration depuis les anciennes clés `gl_history`, `gl_session`, `gl_cardio`, `gl_templates`, `gl_timer_dur`, `gl_exo_timers`, `gl_max_weights`
- Export/import JSON versionné
- Timer sécurisé
- Navigation mobile propre
- Templates avec séries, reps et poids
- Stats par semaine, mois, groupe et exercice


## Carte du corps cliquable
La carte anatomique détaillée est intégrée dans l'onglet **Stats**.
Chaque zone SVG clique vers un focus musculaire, puis propose les exercices disponibles liés au groupe musculaire.
Le fichier source visuel est dans `assets/body-map-base.png` et les overlays réutilisables sont dans `assets/body-map-fitness-overlay-only.svg`.


## Patch UX séance compacte
- La page Séance est maintenant en mode salle : exercice actif, saisie rapide, dernières séries et sauvegarde.
- Les blocs lourds (coach IA, analyse, timeline complète, filtres et 1RM optionnel) sont rangés dans des panneaux ouvrables.
- Le body map intégré reste disponible côté Stats.
