# Brainrush

Study any quiz like it's a game. Live at **https://reidwcoleman.github.io/brainrush/**

Make or paste a quiz (like Blooket or Gimkit), then play it. Answering questions fills a game meter. When it's full (every 10 seconds by default), your next right answer launches a quick mini-game. You still have to keep answering to get the next one.

## Built so you actually learn it

- **Misses come right back.** Get one wrong and you see the right answer plus *why* (if the quiz has an explanation). The card comes back a couple of questions later until you get it.
- **Spaced repetition.** Every card sits in a Leitner box. Cards you know show up less and less; cards you struggle with keep showing up. New cards are fed in a few at a time.
- **Recall, not recognition.** In Mixed mode, once you know a card the choices go away and you type the answer from memory. Typed answers forgive small typos and missing accents, but point them out.
- **Lock it in.** Miss a typed answer and you retype the correct one before moving on.
- **Review at the end.** The results screen lists everything you missed, with answers and explanations.

## Mini-games

Treasure Pick, Balloon Pop, Stack Attack, Bonk-a-Blip, Lucky Reels, Coin Catch and Quick Draw. Each one lasts about 5 to 12 seconds and pays out in gold that scales with your upgrades.

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
- Download / import quizzes as `.json` files

Progress is saved in your browser (localStorage).

## Running locally

It's plain HTML/CSS/JS modules with no build step:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Add `?mg=balloons` (or `chest`, `stack`, `whack`, `slots`, `catcher`, `quickdraw`) to the URL to jump straight into one mini-game.
