# Yarn Puzzle — Game Design Document

*Working title pending. Merged casual puzzle concept combining the direction-tracing of Arrow Out, the perimeter conveyor of Pixel Flow, and the spool targets of Knit N Loop.*

---

## Concept

A casual mobile puzzle in which the player untangles a knot of colored yarn ropes in the center of the screen by tapping them in the right order. Each tapped yarn travels along its directed path, exits onto a clockwise conveyor belt that rings the board, and is automatically pulled into a same-color spool sitting on that conveyor. The level is won when every spool is filled, and lost when the conveyor chokes with yarns that have nowhere to go.

The design is a three-mechanic merge:

- **Arrow Out** contributes the center: tangled directed paths, blocking logic, dead-end traps, and the visual challenge of finding which yarn can actually escape right now.
- **Pixel Flow** contributes the conveyor: a fixed perimeter belt with a strict capacity cap, creating throughput pressure and a soft fail-state.
- **Knit N Loop** contributes the destination: colored spool targets that vacuum matching yarn in with a satisfying winding animation, each with a capacity counter that ticks down as it fills.

---

## Board Layout

The board reads outside-in as three concentric zones.

The **outermost ring** is the conveyor belt, wrapping the entire play area. It moves clockwise at all times, never reverses, and has a hard capacity of 8 yarns simultaneously riding it.

Sitting along the conveyor at fixed positions are the **spool targets**. Each spool has a color and a numeric capacity displayed above it (for example, a red spool with "5" above it needs five red yarns absorbed before it is filled). Spools do not move; they are anchored to specific points on the belt.

The **center** holds the yarn tangle: multiple colored ropes weaving over, under, and around each other. Each rope is a directed path with one color and one terminal exit point on the perimeter, where it can drop onto the conveyor. Many ropes are blocked by other ropes, exactly as arrows block other arrows in Arrow Out.

---

## Core Loop

The player visually traces the tangle to identify which yarns are currently unblocked and tappable. They tap one. That yarn animates along its directed path, slides out of the tangle at its exit point, and drops onto the conveyor at that location. From there it rides clockwise on autopilot. The first same-color spool with remaining capacity that the yarn passes vacuums it in; the spool's counter decrements by one. The player taps the next yarn. When every spool counter reaches zero, the level is won.

---

## Rules

### Yarn Rules

Each yarn is a single directed path with a single color. Tapping a yarn whose path is blocked by another yarn does nothing — the visual trace must confirm the path is clear before tapping has any effect. Pulling one yarn out of the tangle can unblock others, and in some configurations can also re-block or trap others, which is the source of the routing puzzle.

Dead-end yarns exist. These are paths whose direction leads back into the tangle and never reaches the perimeter. They look tappable but produce no result, exactly like wrong-arrow traps in Arrow Out. Identifying them is part of the visual challenge.

The exit point of a yarn matters strategically: it determines where the yarn drops onto the conveyor, which in turn determines the order in which it will encounter spools as it travels clockwise.

### Conveyor Rules

The conveyor moves clockwise only, always, at uniform speed. Its maximum capacity is 8 yarns at any given moment. Yarns on the belt cannot be re-tapped, redirected, or removed by the player — once a yarn is on the belt, the player has no further control over it.

### Spool Rules

Each spool has a color and a numeric capacity. When a same-color yarn passes a spool with remaining capacity, the spool automatically pulls the yarn in (Knit N Loop's winding animation) and the displayed capacity number decreases by one.

A spool whose capacity has reached zero becomes inert. Same-color yarns will travel past it to the next same-color spool clockwise. If two same-color spools both have remaining capacity when a yarn passes, the first one encountered on the clockwise path takes the yarn.

The total yarn count in a level always equals the sum of all spool capacities. Every yarn has a destination; the puzzle is only about sequencing and routing, never about excess or shortage.

---

## Win and Fail Conditions

The level is **won** when every spool's capacity counter has reached zero.

The level is **failed** when both of the following are true at the same moment: the conveyor is holding the full 8 yarns, and none of those 8 yarns has any remaining same-color spool capacity available anywhere on the conveyor. This is a strict deadlock check. As long as at least one yarn on the belt is heading toward a spool that can still absorb it, gameplay continues — even if the belt is full. The soft trigger means players feel the squeeze building (six yarns on the belt, seven, eight, only two of them with viable destinations) without snapping into game-over on a single suboptimal tap. The pre-fail tension is where powerup sales and recovery interventions naturally fit.

---

## Strategic Depth

The game stacks three decision layers, each inherited from a different parent.

**Layer 1 — Reading the tangle (Arrow Out DNA).** Which yarns can the player even tap right now? Trace the directional flow, ignore traps, identify unblocked candidates. Pure visual logic.

**Layer 2 — Routing (emergent from the merge).** Among the tappable yarns, which exit points put each yarn on the most useful clockwise trajectory? This matters most when multiple same-color spools exist with different capacities, or when same-color spools sit at very different positions around the loop. A red yarn that exits on the north edge will hit a different red spool than one exiting on the south edge.

**Layer 3 — Throughput (Pixel Flow DNA).** Pace the taps. Don't flood the belt before absorptions clear slots. The player must always keep at least one yarn on the belt heading toward an open spool, or risk drifting into the deadlock fail state.

The interaction between layers is where mastery lives. Pulling yarn A might unblock B and C in the tangle but also clog the belt; pulling B first might be safer for throughput but leave C trapped forever. Same-color decisions ("which red yarn do I send first when there are two red spools with different capacities at different positions?") create real planning moments.

---

## Feedback and Satisfaction

The Knit N Loop heritage drives the satisfaction beat. Yarn absorption into a spool is the core feel-good moment: the yarn winds into the spool with a smooth animation, the counter ticks down, and a small color flourish punctuates the absorption. When a spool reaches zero remaining capacity, a larger celebration fires — color burst, spool "completed" state, audio sting.

The Arrow Out heritage drives the cognitive payoff. When a player taps the one yarn that unlocks a cascade of others, the visual reveal of the previously-tangled mess unwinding is its own reward.

The Pixel Flow heritage drives the tension. Visual indicators on the conveyor capacity (perhaps a slot count, color shift as the belt approaches full, audio cue at 7/8) keep the player aware of throughput.

---

## Reference Game Mapping

| Element | Source | Implementation |
|---|---|---|
| Center tangle of directed paths | Arrow Out | Yarn ropes replace arrows; same blocking and trap logic |
| Visual trace gameplay | Arrow Out | Identify which yarn is unblocked before tapping |
| Dead-end / trap paths | Arrow Out | Some yarns lead nowhere; learn to ignore |
| Perimeter conveyor | Pixel Flow | Clockwise belt around the entire board |
| Capacity cap | Pixel Flow | Hard 8-yarn limit creates throughput pressure |
| Soft fail trigger | Pixel Flow | Deadlock only fires at full belt + no matches |
| Spool targets | Knit N Loop | Colored spools with capacity numbers |
| Auto color-match | Knit N Loop | Same-color yarn auto-absorbed when passing |
| Winding animation | Knit N Loop | Satisfaction beat of every absorption |

---

## Open Items

The following are deferred for the next design pass:

- Working title
- Level 1–20 progression curve and difficulty ramp
- Translation of Arrow Out's bulb / eraser / wand / ruler powerups into yarn-themed equivalents
- Special yarn types for later levels (multi-color, locked, timed, etc.)
- Special spool variants (multi-color spools, sequenced spools, bonus spools)
- Meta-progression layout (level map, currencies, lives, daily rewards)
- Monetization integration points (where powerups, continues, and offers naturally fit into the loop)
- Tutorial flow for the first 3–5 levels
