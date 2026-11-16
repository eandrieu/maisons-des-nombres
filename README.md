# Les maisons des nombres

Application web d'entraînement aux « maisons des nombres » (décompositions additives du 3, 4, 5, 6, 7 et 10), pensée pour un enfant de 7 ans sur iPad.

**Jouer :** https://eandrieu.github.io/maisons-des-nombres/

## Principe

- La rue compte six maisons. Chaque étage d'une maison est une façon d'obtenir son nombre (pour 7 : 0 + 7, 1 + 6, … 7 + 0).
- L'enfant touche une maison pour s'entraîner sur ses étages, ou choisit « Toute la rue » pour mélanger les maisons. Dans ce mode, certaines questions demandent aussi de retrouver la maison (3 + 4 = ?).
- Une fenêtre s'allume quand l'étage est réussi 3 fois de suite, chaque fois sous le seuil « rapide » (3 s par défaut). Une erreur l'éteint. Objectif à long terme : allumer toute la rue.
- Le « Défi éclair » enchaîne les questions avec un temps qui raccourcit, et 3 cœurs.

## Vitesse et justesse

- Bonne réponse : 10 points, plus un bonus de rapidité de 0 à 10 (maximal sous 1,5 s, nul au-delà de 6 s).
- Série de bonnes réponses : points ×2 dès 5, ×3 dès 10. Une erreur remet la série à zéro, ce qui rend la justesse plus payante que la vitesse.
- Une erreur n'enlève jamais de points : la bonne réponse s'affiche (avec un cadre à points en aide visuelle) et la question revient plus loin dans la partie.
- Étoiles : 3 sans erreur et temps moyen sous le seuil + 1 s, 2 avec au plus une erreur, 1 sinon.

## Espace parents

Accessible par le bouton « Parents » (question de multiplication pour entrer). On y règle le prénom, le son, la longueur des parties, le seuil de rapidité, l'aide visuelle et les maisons utilisées, et on y suit la réussite et le temps médian de chaque décomposition.

## Installation sur iPad

Ouvrir le lien dans Safari, bouton Partager, puis « Sur l'écran d'accueil ». L'application s'ouvre en plein écran et fonctionne hors connexion après la première visite.

La progression est stockée uniquement sur l'appareil (localStorage). Safari et l'icône de l'écran d'accueil ont chacun leur propre stockage : utiliser toujours la même entrée.

## Technique

HTML, CSS et JavaScript sans dépendance ni étape de compilation. Sons synthétisés avec Web Audio. Police Fredoka (licence SIL OFL, fichier dans `fonts/`).
