# Stage pitch: AI Runs the Planet (3:00)

Version 3, for the 3-minute stage pitch with the deck. The disaster chronicle and the AI-vs-people numbers stay as they were. The ending changes: the product becomes a shared source of truth about the world, checked against reality and played forward, on every phone. About 460 words, so speak briskly. If you run long, cut the Claude line on slide 5.

Every number comes from `results/ai-vs-audience.md` or the engine run behind `scripts/film.py` (seed 2026, 5,000 futures). Slides 6 to 9 are vision, not results. Say them as "it becomes" and "it will", never "it does".

| time | slide | says |
|---|---|---|
| 0:00 | 1 Cover | In 2076, I'll still be here. Most of you in this room will be too. So what will that world look like, and who gets to decide? |
| 0:10 | 2 Problem | Right now everyone has an opinion about the future. Headlines are loud and one-sided: AI saves us or ends us, depending on who you ask. And any photo or video can now be faked. When people can't tell what's real, they get scared, or they stop caring. |
| 0:25 | 3 What we built | We built AI Runs the Planet on God's Eye View, an open-source 3D globe that already shows the real world live: flights, ships, earthquakes, fires, public cameras. We added the future. An AI gets the world's budget, 360 points across six levers. It plays 5,000 futures to 2076 and shows three: the best case, the most likely and the scariest. |
| 0:45 | 4 Chronicle | This is the AI's most likely future. 2032: we cross 1.5 degrees. 2035: a clean-energy breakthrough in Boston. 2050: the sea is 11 centimetres higher and 1.5 million people leave Shanghai's coast. 2067: a major war in Eastern Europe slows everything down. 2076: one hurricane is enough to flood Miami Beach, and in Dhaka almost 5 million people have lost their homes to the sea. |
| 1:10 | 5 Trade-off | The AI kept 92% of futures below 2 degrees. But it put 1 point into coastal protection, so 31 million people were pushed out by the sea. Claude, choosing for itself: 26% and 18 million. A people-first choice: only 8 million, but no future below 2 degrees. The AI saved the climate and forgot the coast. You only see that when you can see the odds. |
| 1:35 | 6 What it becomes | And this is where it goes next. Built further, it becomes one shared source of truth for the state of the world. A claim, a headline, a viral video: checked against what satellites, flight and ship trackers, seismometers and cameras actually recorded. Then that same reality, played forward, so you see where a choice leads before it's made. In plain words, for people who will never open a terminal. |
| 2:00 | 7 Truth | A video can be faked. Thousands of independent sensors agreeing with each other are much harder to fake. When the truth is backed by reality, fear and doubt lose their grip. |
| 2:12 | 8 Why now | The AI race is happening anyway. The question is whether everyone gets to see what's real, or only governments and labs. And AI gets cheaper and smaller every year. What needs a data centre today will run on a phone in your pocket. A phone that doesn't exist yet, but will. That's liberty: the same view of the world, for everyone. |
| 2:45 | 9 Ask | So take the sliders and try to beat the AI. Then back us through the LEXIE programme, and we'll build the truth layer. Thank you. |

## Where the numbers come from

- 2032 crosses 1.5 °C (1.54), 2050 sea +11 cm, 2076 sea +28 cm, Shanghai 1.5M in 2050, Dhaka 4.95M in 2076, Boston breakthrough 2035, Eastern Europe war 2067: the engine run in `scripts/film.py` (`engine_facts()`).
- 92% / 31M (AI), 26% / 18M (Claude), 0% / 8M (people first), 1 point on coastal: `results/ai-vs-audience.md`.
- Live layers (flights, ships, earthquakes, fires, cameras): God's Eye View, by Bilawal Sidhu and contributors (MIT). Say "open-source" so nobody thinks we built the globe.

## If a judge pushes back

- **"Can't sensors be faked too?"** One can be. Thousands of independent ones (satellites from different countries, transponders, seismometers) all agreeing are far harder. That's why it's "much harder to fake", not "impossible".
- **"Is this a prediction?"** No. These are possible futures from IPCC and UN numbers, 5,000 per choice. The point is to see the odds, not one answer.
