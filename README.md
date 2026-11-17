#  LegallyDistinctTD🎈

<p align="center">
  <img src="legacy/greenfoot/readme Images/LegallyDistinctTD.png" width="1216" alt="Legally Distinct TD"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-in%20development-yellow" alt="Status"/>
  <img src="https://img.shields.io/badge/type-school%20project-blue" alt="Type"/>
  <img src="https://img.shields.io/badge/inspired%20by-Bloons%20TD6-red" alt="Inspired by"/>
  <img src="https://img.shields.io/badge/originality-0%25-orange" alt="Originality"/>
</p>

---

## 🐒 What is this?

This is a tower Defence game made from scratch. This project will be open source and free forever at least that's what is planned now.

This project was created by a group of students as a **school assignment**. We were tasked with making a game, we will continue this after the deadline and add more features but probally as a fork of this project.

We are a group of 8 students who are trying to fix all the things that are wrong with simple tower defense games such as the whole pay-to-win features the games got over the last few years.

---

## 👥 The Team

> A group of (more or less) highly motivated individuals:<br>
> @Vanquish1905 : Group Leader/Programming<br>
> @MelsMatii : Group Leader/Programming<br>
> @Solo-67 : Art/Programming<br>
> @TeaNtea939 : Art/Programming<br>
> @jul3110 : Programming/Sounds<br>
> @Feuerfisch10 : Programming<br>
> @jbeecom : Programming<br>
> @Fredbot36 : Dokumentation/Programming<br>



---

## 🎮 About the Game

**LegallyDistinctTD** is a tower defense game where:

- 🪱 **Parasites** travel along a path and you must stop them
- 🤖 **Machine towers** are placed strategically to pop the balloons
- 💰 **Currency** is earned by popping balloons and used to buy/upgrade towers
- 😰 **You lose lives** when parasites reach the end of the path

Basically, it's just like any other TD game just without any Pay-to-win Mechanics.

---

## 🛠️ Tech Stack

> We moved engines. The old Greenfoot version still lives in `legacy/greenfoot/` if you miss it.

- **Language:** TypeScript (strict)
- **Engine/Framework:** Phaser 3 + Vite, runs in any browser
- **Simulation:** deterministic fixed-step game logic in `src/sim/` (no Phaser inside, fully unit tested)
- **Assets:** all towers, parasites, bosses, icons and maps are generated as vector art by `tools/art/` (`npm run art`). Sounds and music are still ours.

### Running it

```bash
npm install
npm run dev      # play locally
npm test         # unit tests
npm run build    # production build into dist/
npm run e2e      # build + headless smoke test
```

### What is in the new version so far

- 18 towers, 14 parasites and 5 bosses designed (towers' upgrade logic still in progress)
- 9 maps (tutorial + 8), including multi-path maps, with generated backgrounds
- Deterministic simulation core: pathing, armor and resistances, slows, damage over time, splash, pierce, homing and lobbed shots, stealth and flying, saves between waves
- Still to come: the playable game screen, HUD with scrollable tower selector, menus and popups, wave manager

---

## 📅 Project Status

- [x] Came up with the idea
- [x] Made a cool banner image
- [x] Wrote the README
- [X] Actually made the game 
- [ ] Passed the class (looking good)

---
## 👾 Bugs
Report bugs by opening an issue, but it's not guaranteed that they will be fixed.
(We mean like real code-bugs. Not the parasites. The Machines are taking care of those.)

---

## ⚠️ Disclaimer

This project is made purely for **educational purposes** as part of a school assignment.

---

## 📜 License

**Please don't steal our ripoff of a game.** That would be a ripoff of a (for now) low quality game, and that's just too many layers. And even if you do good luck fixing our mess (But please don't you will get traumatized).

---

<p align="center">Made with a lot of bugs</p>
