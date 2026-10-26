# Brainrush

Study any quiz like it's a game. Live at **https://reidwcoleman.github.io/brainrush/**

Make or paste a quiz (like Blooket or Gimkit), then play it. Every 10 right answers unlocks **game time**: pick one of three games and play it for big gold. Then it's back to the questions to earn the next one.

## Built so you actually learn it

- **Misses come right back.** Get one wrong and you see the right answer plus *why* (if the quiz has an explanation). The card comes back a couple of questions later until you get it.
- **Spaced repetition.** Every card sits in a Leitner box. Cards you know show up less and less; cards you struggle with keep showing up. New cards are fed in a few at a time.
- **Recall, not recognition.** In Mixed mode, once you know a card the choices go away and you type the answer from memory. Typed answers forgive small typos and missing accents, but point them out.
- **Lock it in.** Miss a typed answer and you retype the correct one before moving on.
- **Review at the end.** The results screen lists everything you missed, with answers and explanations.

## Games

Each game runs 40 to 50 seconds and pays out gold that scales with your upgrades. Personal bests are saved per game.

- **Slice Frenzy**: swipe fruit, chain combos, avoid bombs; golden, freeze and frenzy fruit
- **Quick Draw**: a reaction-time gauntlet with green lights, pop-up targets, triple targets and blue fake-outs; fast streaks multiply your points
- **Snake Arena**: eat orbs, boost, and make rival snakes crash into you

## Progression

- In-session upgrades (answer value, streak bonus, multiplier) that you buy with gold
- Tokens and XP that carry over between sessions, plus levels and a daily streak
- Mystery boxes in the Blip Shop with 31 collectible creatures across 4 rarities

## Making quizzes

- Type questions in the editor, with optional wrong answers and an explanation for each
- Or paste a list, one per line:
  - `term - definition`, `term: definition`, or tab-separated (Quizlet/Sheets export)
  - `question | answer | wrong 1 | wrong 2 | wrong 3 | explanation`
- Share a quiz as a link. The whole quiz is compressed into the URL, so there's no server and no account
- Import quiz files (`.json`, `.csv`, `.txt`) or paste JSON. Besides Brainrush's own files it reads the common formats: arrays of `question`/`options`/`answer` (answer as text, letter or index), `term`/`definition` lists, Kahoot-style choices with a `correct` flag, and `{ "France": "Paris" }` dictionaries
- Download any quiz as a `.json` file

Progress is saved in your browser (localStorage).

## Running locally

It's plain HTML/CSS/JS modules with no build step:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Add `?game=slice` (or `quickdraw`, `snake`) to the URL to jump straight into one game, or `?game=pick` for the picker.
