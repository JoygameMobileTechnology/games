# 🎲 DICE DUNGEONS
### *A Roguelike Tower Defense Game Design Document*

> *"In the Shattered Reach, fate is a twenty-sided stone. Roll well, Commander — the dungeons are hungry."*

---

## 📜 TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Setting & Lore](#2-setting--lore)
3. [Core Gameplay Loop](#3-core-gameplay-loop)
4. [The d20 Dice System](#4-the-d20-dice-system)
5. [Hero Roster](#5-hero-roster)
6. [Hero Classification & Stats](#6-hero-classification--stats)
7. [Enemies & Boss Encounters](#7-enemies--boss-encounters)
8. [Combat System](#8-combat-system)
9. [Upgrade Categories](#9-upgrade-categories)
10. [Meta-Progression (Squad Builder)](#10-meta-progression-squad-builder)
11. [Game Modes](#11-game-modes)
12. [UI/UX Design](#12-uiux-design)
13. [Art & Audio Direction](#13-art--audio-direction)
14. [Technical Notes](#14-technical-notes)
15. [Development Roadmap](#15-development-roadmap)

---

## 1. EXECUTIVE SUMMARY

**Title:** Dice Dungeons
**Genre:** Roguelike Tower Defense / Squad Builder
**Platform:** Mobile (iOS / Android), PC-compatible
**Perspective:** 2D side-view battlefield with a fortress wall on the left, enemies advancing from the right
**Core Fantasy:** Lead a legion of D&D adventurers defending the crumbling Shattered Reach from waves of classic monsters, with every critical decision governed by the roll of a d20.

**Elevator Pitch:**
> *Imagine if Hellsquad Rrrush, Slay the Spire, and a D&D one-shot had a baby. You command a growing army of iconic adventurers — High Elf Wizards, Tiefling Warlocks, Dragonborn Paladins — against hordes of goblins, beholders, and ancient dragons. Between every wave, a d20 is rolled. The dice decide the tier of loot offered. Roll a natural 20 and you'll be summoning Legendary champions. Roll a 1 and the gods are laughing at you.*

**Unique Selling Points:**
- **The d20 upgrade system** — every choice is preceded by a dramatic dice roll that determines the quality of what's offered. Players don't just *feel* luck, they *see* it on the table.
- **A roster of 24+ D&D archetypes**, each with distinct mechanics drawn from actual 5e class fantasies.
- **Iconic D&D enemies** — not generic monsters, but the creatures fans actually recognize, scaled by Challenge Rating.
- **No predatory monetization** — premium/cosmetic-only monetization model.
- **Original setting inspired by the Sword Coast** — the Shattered Reach — without licensing constraints.

---

## 2. SETTING & LORE

### The Shattered Reach

The Reach was once a peninsula of nine city-states ruled by the Council of Silver Crowns. Three generations ago, an event called the **Shattering** cracked the land along the Spinebreak Fault, sinking half the kingdom into the sea and opening chasms to the Underdark. From these wounds poured forth every horror the old world had buried.

The surviving kingdoms retreated behind the **Wardstone Walls** — ancient fortifications reinforced by the Arcane Conclave. But the walls are failing. The monsters are getting smarter. The dragons have returned.

The player takes the role of the **Warden Commander**, a figure appointed by the last surviving Silver Crown, tasked with assembling a new Hellsquad — erm, *Hero Squad* — to push back the darkness, one dungeon at a time.

### Key Locations (Campaign Map)

| Region | Theme | Chapter Range |
|--------|-------|---------------|
| The Greenmarch | Goblinoid frontier forests | Chapters 1–2 |
| Stonewake Pass | Mountain paths, giants | Chapters 3–4 |
| The Miregrove | Swamp, trolls, hags | Chapters 5–6 |
| The Undercrack | Underdark, aberrations | Chapters 7–8 |
| The Ashwaste | Volcanic, dragons | Chapters 9–10 |
| The Shadowfell Breach | Undead, liches | Chapters 11–12 |
| The Abyssal Gate | Demons, final boss | Endgame |

---

## 3. CORE GAMEPLAY LOOP

### Moment-to-Moment Loop (In-Battle)

```
Wave begins → Enemies advance → Heroes auto-attack →
Wave clears → ROLL THE D20 → Tier revealed →
Choose 1 of 3 cards → Card applied → Next wave begins
```

### Session Loop (Per Run)

```
Select Chapter → Deploy Squad → Battle through waves →
Boss fight at wave 10/20/30 → Victory/Defeat →
Collect meta-currency → Return to Keep
```

### Meta Loop (Long-Term)

```
Unlock new heroes → Rank up permanent roster →
Equip runes/relics → Unlock new chapters →
Master harder difficulties → Climb Arena ladder
```

---

## 4. THE d20 DICE SYSTEM

**The beating heart of Dice Dungeons.** Every wave clear triggers a d20 roll. The result determines the *quality tier* of the 3 upgrade cards offered. The player then chooses 1 of 3 cards.

### Dice Outcome Table

| Roll | Outcome Name | Probability | Result |
|------|--------------|-------------|--------|
| **1** | *Critical Fail* 💀 | 5% | 1 card only — random **Commoner**, forced pick, adds a minor **curse** to the run |
| **2–5** | *Cursed Omen* | 20% | 3 × **Commoner** tier cards |
| **6–10** | *Mixed Fate* | 25% | 2 × Commoner + 1 × **Adventurer** |
| **11–14** | *Fortune Smiles* | 20% | 3 × **Adventurer** tier |
| **15–17** | *Heroic Vision* | 15% | 2 × Adventurer + 1 × **Hero** |
| **18** | *Champion's Call* | 5% | 3 × **Hero** tier |
| **19** | *Legendary Omen* | 5% | 2 × Hero + 1 × **Champion** |
| **20** | *Divine Inspiration* ✨ | 5% | 3 × **Legendary** tier — **free reroll** available |

### Expected Value Analysis

Breaking down the probability distribution by average tier quality (assigning Commoner = 1, Adventurer = 2, Hero = 3, Champion = 4, Legendary = 5):

| Roll Range | % Chance | Avg. Card Tier |
|------------|----------|----------------|
| 1–5 | 25% | 1.00 (Commoner) |
| 6–10 | 25% | 1.33 (Commoner+) |
| 11–14 | 20% | 2.00 (Adventurer) |
| 15–17 | 15% | 2.33 (Adventurer+) |
| 18 | 5% | 3.00 (Hero) |
| 19 | 5% | 3.33 (Hero+) |
| 20 | 5% | 5.00 (Legendary) |

**Expected tier per roll ≈ 1.91** (between Commoner and Adventurer). This is intentional — the game should feel *grindy* at low levels so that natural 19s and 20s feel genuinely exciting.

### Dice Modifiers

Players can earn modifiers that shift the odds in their favor. These are the game's core progression levers:

| Modifier Source | Effect |
|-----------------|--------|
| **+1 Luck** (rune stat) | Re-roll natural 1s |
| **+2 Luck** (legendary rune) | Add +1 to every roll (can exceed 20 for bonus effects) |
| **Lucky Charm** (item) | Once per battle: reroll a d20 |
| **Bard in squad** | +1 to the roll after any boss clear |
| **Inspiration stacks** | Spend 5 stacks for +3 to next roll |
| **Cursed state** | −2 to all rolls until cleansed |

### Extended Rolls (Nat 21+)

With enough Luck modifiers stacked, players can achieve mathematical rolls above 20:

| Effective Roll | Effect |
|----------------|--------|
| 21–24 | Legendary guaranteed + 1 bonus **Champion** card |
| 25+ | **Divine Intervention** — Legendary card **plus** a random Mythic relic |

---

## 5. HERO ROSTER

### Hero Rarity Tiers

Heroes are tiered into 5 quality grades. A hero's tier determines base stats, skill count, and upgrade ceiling.

| Tier | Color | Max Rank | Base Stat Multiplier |
|------|-------|----------|----------------------|
| **Commoner** | Grey | Rank 5 | 1.0× |
| **Adventurer** | Green | Rank 6 | 1.3× |
| **Hero** | Blue | Rank 7 | 1.7× |
| **Champion** | Purple | Rank 8 | 2.2× |
| **Legendary** | Gold | Rank 10 | 3.0× |

### The Full Roster (24 Heroes)

#### 🔴 Offense (DPS) — 8 Heroes

| # | Hero | Race / Class | Tier | Signature Skill |
|---|------|--------------|------|-----------------|
| 1 | **Vaelith Moonwhisper** | High Elf Wizard | Legendary | *Meteor Swarm* — massive delayed AoE |
| 2 | **Grimlok Ironjaw** | Half-Orc Barbarian | Hero | *Reckless Rage* — huge melee DPS, loses defense |
| 3 | **Silk** | Halfling Rogue | Adventurer | *Sneak Attack* — 3× damage if target is debuffed |
| 4 | **Kaelen Blackthorn** | Human Assassin | Champion | *Shadow Step* — teleport to weakest enemy |
| 5 | **Zylphira Venomtongue** | Drow Sorcerer | Hero | *Darkflame Barrage* — ranged shadow bolts |
| 6 | **Aurelia Dawnfire** | Dragonborn Sorcerer | Champion | *Breath of the Ancients* — line AoE fire |
| 7 | **Quickshot Pip** | Wood Elf Ranger | Commoner | *Volley* — 5-arrow ranged burst |
| 8 | **Vox the Devourer** | Tiefling Warlock | Legendary | *Eldritch Blast Storm* — homing dark orbs |

#### 🟦 Defense (Tank) — 6 Heroes

| # | Hero | Race / Class | Tier | Signature Skill |
|---|------|--------------|------|-----------------|
| 9 | **Sir Cedric Bronzeshield** | Human Fighter | Commoner | *Shield Wall* — blocks the first 3 projectiles each wave |
| 10 | **Brondar Stonefist** | Dwarf Battlemaster | Hero | *Counterattack* — reflects 30% melee damage |
| 11 | **Ryxxa Ironheart** | Dragonborn Paladin | Legendary | *Aura of Protection* — +20% defense to all nearby heroes |
| 12 | **Goreth the Unbroken** | Goliath Fighter | Champion | *Second Wind* — revives once at 50% HP |
| 13 | **KX-7 "Rustheart"** | Warforged Sentinel | Adventurer | *Regeneration Core* — heals 5% HP per wave |
| 14 | **Thornn Oakenguard** | Firbolg Druid | Hero | *Wall of Thorns* — summons a blocking barrier |

#### 🟢 Support (Healer / Buffer) — 6 Heroes

| # | Hero | Race / Class | Tier | Signature Skill |
|---|------|--------------|------|-----------------|
| 15 | **Brother Halron** | Dwarf Cleric | Commoner | *Cure Wounds* — heals lowest-HP ally |
| 16 | **Seraphiel the Radiant** | Aasimar Cleric | Legendary | *Mass Heal + Radiance* — heal + damage undead |
| 17 | **Lyrielle Songweaver** | Half-Elf Bard | Hero | *Inspiration* — grants +1 dice luck per wave |
| 18 | **Pip "Dandelion" Cobblemouse** | Halfling Bard | Adventurer | *Bardic Rally* — +20% squad speed |
| 19 | **Mistress Vael** | Tiefling Enchantress | Champion | *Charm Person* — converts one enemy to fight for you |
| 20 | **Starwhisper** | Aarakocra Druid | Hero | *Call Lightning* — chain lightning from sky |

#### 🟡 Hybrid / Specialist — 4 Heroes

| # | Hero | Race / Class | Tier | Signature Skill |
|---|------|--------------|------|-----------------|
| 21 | **Tempest Vorr** | Triton Storm Sorcerer | Legendary | *Tidal Wrath* — AoE control + damage |
| 22 | **Chitterfang** | Tabaxi Monk | Hero | *Flurry of Blows* — 4-hit stun combo |
| 23 | **Widderkin the Many-Faced** | Changeling Rogue | Champion | *Doppelganger* — splits into 2 clones |
| 24 | **Cogsworth Brassgear** | Gnome Artificer | Adventurer | *Summon Homunculus* — deploys a mini-turret |

---

## 6. HERO CLASSIFICATION & STATS

### Stat System

Every hero has 6 base stats, inherited from D&D:

| Stat | Effect |
|------|--------|
| **STR** (Strength) | Melee damage |
| **DEX** (Dexterity) | Attack speed, dodge chance |
| **CON** (Constitution) | Max HP, damage resistance |
| **INT** (Intelligence) | Spell damage |
| **WIS** (Wisdom) | Healing power, crit chance |
| **CHA** (Charisma) | Buff/debuff potency, summon strength |

### Example Stat Blocks

#### 🧙 Vaelith Moonwhisper (Legendary Wizard, Rank 1)
```
HP:    450         STR: 8    INT: 18
ATK:   55 (magic)   DEX: 12   WIS: 14
SPD:   0.8s        CON: 10   CHA: 13
RANGE: 8 tiles     Role: Ranged AoE DPS
```

#### 🛡️ Sir Cedric Bronzeshield (Commoner Fighter, Rank 1)
```
HP:    380         STR: 15   INT: 8
ATK:   18 (melee)   DEX: 10   WIS: 10
SPD:   1.2s        CON: 16   CHA: 11
RANGE: 1 tile      Role: Frontline Tank
```

### Rank-Up Scaling

Each rank increases stats multiplicatively. Here's the formula:

```
Stat(rank) = BaseStat × (1 + 0.25 × (rank - 1))
```

| Rank | HP / ATK Multiplier |
|------|---------------------|
| 1 | 1.00× |
| 2 | 1.25× |
| 3 | 1.50× |
| 4 | 1.75× |
| 5 | 2.00× |
| 6 (Adv+) | 2.25× |
| 7 (Hero+) | 2.50× |
| 8 (Champ+) | 2.75× |
| 9 (Legendary+) | 3.00× |
| 10 (Legendary max) | 3.50× + **passive ability unlock** |

### Rank-Up Costs (Duplicate Cards Required)

| From → To | Duplicates Needed |
|-----------|-------------------|
| Rank 1 → 2 | 1 |
| Rank 2 → 3 | 2 |
| Rank 3 → 4 | 4 |
| Rank 4 → 5 | 8 |
| Rank 5 → 6 | 12 |
| Rank 6 → 7 | 20 |
| Rank 7 → 8 | 30 |
| Rank 8 → 9 | 45 |
| Rank 9 → 10 | 65 |

---

## 7. ENEMIES & BOSS ENCOUNTERS

### Enemy Tiers by Challenge Rating (CR)

Enemies scale with D&D's Challenge Rating system, clamped to the player's chapter progression.

| CR Band | Enemy Examples | Chapters |
|---------|----------------|----------|
| CR ¼–1 | Goblin, Kobold, Giant Rat, Bandit, Stirge | 1–2 |
| CR 2–4 | Orc, Gnoll, Ogre, Hobgoblin, Ghoul, Harpy | 3–4 |
| CR 5–7 | Troll, Minotaur, Ettin, Wight, Hook Horror | 5–6 |
| CR 8–10 | Mind Flayer, Hill Giant, Vampire Spawn, Young Dragon | 7–8 |
| CR 11–15 | Beholder, Stone Giant, Adult Dragon (Green/White) | 9–10 |
| CR 16–20 | Adult Red Dragon, Pit Fiend, Balor | 11–12 |
| CR 21+ | Lich, Ancient Dragon, Demilich, Dracolich | Endgame |
| CR 30 | **Tarrasque**, **Tiamat** | Final |

### Enemy Archetypes

Every enemy maps to one of 5 combat roles:

| Archetype | Behavior | Examples |
|-----------|----------|----------|
| **Rusher** | Fast, low HP, melee | Goblin, Kobold |
| **Bruiser** | Slow, high HP, hard-hitting | Ogre, Troll, Minotaur |
| **Shooter** | Ranged attacks, low HP | Goblin Archer, Drow Crossbower |
| **Caster** | Ranged magic, casts debuffs | Gnoll Shaman, Mind Flayer, Lich |
| **Splitter** | On death, spawns minions | Otyugh, Gelatinous Cube, Myconid |

### Boss Gate Schedule

Each chapter ends with a themed boss fight at wave 30. Bosses have unique mechanics beyond their stat blocks.

| Ch. | Boss | CR | Special Mechanic |
|-----|------|----|--|
| 1 | **Grashnak the Goblin King** | 3 | Summons 3 goblin minions every 30s |
| 2 | **Gnashrot the Gnoll Warlord** | 5 | Enraged below 50% HP — +50% speed |
| 3 | **Krull, Ogre Chieftain** | 5 | Throws boulders that AoE the back line |
| 4 | **Sserrith the Medusa** | 6 | Petrifies a random hero for 10 seconds |
| 5 | **The Observer** (Beholder) | 13 | 10 random eye rays per wave |
| 6 | **Thoon, The Deep Whisperer** (Mind Flayer) | 7 | Mind Blast stuns a random hero for 8s |
| 7 | **Pyraxitus the Hatchling** (Young Red Dragon) | 10 | Fire breath across the entire field |
| 8 | **Vaelthuris the Liche-Queen** | 21 | Revives slain enemies as undead |
| 9 | **Krazgon the Balor** | 19 | Fire aura damages all nearby heroes |
| 10 | **Ignarox the Scaled Calamity** (Adult Red Dragon) | 17 | Flies — only ranged/magic can hit |
| 11 | **The Bone Heresiarch** (Dracolich) | 17 | Phases between dragon and lich forms |
| 12 | **The Unkillable** (Tarrasque) | 30 | Impossibly tanky — must outlast, not out-damage |
| ∞ | **Tiamat, Queen of Dragons** | 30 | 5-phase fight, one per chromatic head |

---

## 8. COMBAT SYSTEM

### Battlefield Layout

```
[WARDSTONE WALL]  [HERO ZONE: 4 rows × 8 columns]  [ENEMY SPAWN]
       ←                                                   ←
                   Enemies advance right-to-left
```

- **32 deployment tiles** arranged in 4 rows × 8 columns
- Heroes auto-deploy when summoned — the game picks the nearest valid tile for their role (melee to front, ranged to back)
- **Manual repositioning** unlocked at Chapter 3 (drag-and-drop)

### Auto-Combat Rules

As with Hellsquad Rrrush, heroes fight automatically:
- Each hero has an attack cooldown (`SPD` stat in seconds)
- Heroes target the **closest valid enemy** within their range
- Healers prioritize the **lowest-HP ally**
- Ranged units maintain distance, moving back if enemies close in

### Skill Activation

Each hero has a **signature skill** with its own cooldown. Skills activate automatically when off cooldown — no manual input required. Players who want more agency can spend **Inspiration** (earned from Bards/crits) to trigger skills early.

### Wave Structure

Every chapter is 30 waves long:

| Waves | Intensity | Notes |
|-------|-----------|-------|
| 1–9 | Warm-up | Low enemy counts, 1 enemy type |
| 10 | Mini-boss | CR tier +1 enemy |
| 11–19 | Escalation | Mixed enemy types, new archetypes introduced |
| 20 | Mid-boss | Elite version of a common enemy |
| 21–29 | Endurance | Large swarms, support enemies added |
| 30 | **BOSS** | Themed chapter boss with unique mechanics |

### Defeat Conditions

The run ends when:
- **The Wardstone Wall** reaches 0 HP (enemies breach)
- All heroes are killed simultaneously (rare — heroes respawn at wave start)

---

## 9. UPGRADE CATEGORIES

When a d20 roll grants upgrade cards, they're drawn from six categories. Each category scales with the rolled tier.

### 1. 🎭 Hero Cards *(~40% of draw pool)*

The core system. A hero card either:
- **Adds a new hero** to your active squad if you don't own them
- **Ranks up an existing hero** if you already have them (progresses toward Rank 10)

Higher dice rolls offer rarer heroes. You can never get a Legendary hero from a Cursed Omen (low roll), and you'll rarely see Commoners on a nat-20.

### 2. ✨ Spell Upgrades *(~20%)*

Enhance or replace hero spells mid-run. Example progression tree:

| Tier | Spell |
|------|-------|
| Commoner | *Fire Bolt* — 1 target, small damage |
| Adventurer | *Scorching Ray* — 3 hits, medium damage |
| Hero | *Fireball* — AoE on landing |
| Champion | *Wall of Fire* — persistent damage zone |
| Legendary | *Meteor Swarm* — 4 impact sites, massive AoE |

### 3. ⚔️ Class Features *(~15%)*

Enhancements to class mechanics:

- **Rage +1** — Barbarians gain +10% damage
- **Sneak Attack +1d6** — Rogues deal bonus damage to debuffed targets
- **Divine Smite +1d8** — Paladins deal radiant bonus damage
- **Extra Attack** — Fighters/Rangers gain one extra attack per cycle
- **Metamagic: Twin Spell** — Sorcerers cast single-target spells twice

### 4. 🧪 Magic Items *(~10%)*

Party-wide equipment effects:

| Item | Tier | Effect |
|------|------|--------|
| Bag of Holding | Commoner | +1 Inspiration per wave |
| Cloak of Displacement | Hero | 20% squad-wide dodge chance |
| Boots of Speed | Adventurer | +15% movement / attack speed |
| Staff of the Magi | Legendary | +25% spell damage |
| Deck of Many Things | Legendary | 1 free reroll per wave, but risks a curse |

### 5. 🎵 Party Buffs *(~10%)*

Temporary effects lasting the rest of the run:

- **Bless** — +1 to all hero attack rolls
- **Haste** — +30% speed for one hero
- **Aid** — +20 max HP to all allies
- **Inspiration** — Start each wave with 1 free Inspiration
- **Guidance** — +2 on next dice roll

### 6. ⚡ Divine Interventions *(~5% — nat 20 territory)*

Game-changing one-shot effects. Extremely rare.

| Intervention | Effect |
|--------------|--------|
| **Wish** | Pick any card from any rarity tier |
| **Time Stop** | Freeze all enemies for 10 seconds |
| **Miracle** | Revive all fallen heroes to full HP |
| **Divine Word** | Instantly delete all enemies below 50% HP |
| **Reincarnate** | Transform a Commoner hero into Legendary for the run |

---

## 10. META-PROGRESSION (SQUAD BUILDER)

Between runs, the player returns to **The Keep** — their home base — where permanent progression happens. *This is not Dead Cells. Your heroes persist.*

### Persistent Systems

1. **Hero Collection** — Every hero unlocked in a run is permanently added to your Keep roster.
2. **Hero Ranks** — Ranks earned during runs persist. Running the same hero again adds duplicates toward the next rank.
3. **Keep Level** — A global account level that unlocks new chapters, game modes, and cosmetic rewards.
4. **Relic Vault** — Rare items earned from boss kills. Equip 3 per run for passive bonuses.
5. **Rune Forge** — Runes drop from normal play. Socket into heroes for stat boosts.

### The Wardstone Tree (Meta Skill Tree)

A tree of permanent unlocks purchased with **Soul Shards** (earned from completing chapters). Example branches:

**Luck Branch**
- +1 to dice minimum (1s become 2s)
- 5% chance to reroll any dice result
- Unlock "lucky penny" starting relic

**Power Branch**
- +5% global hero attack
- +10% damage to bosses
- +25% gold earned per wave

**Endurance Branch**
- +10% Wardstone HP
- Heroes respawn 30% faster
- +1 starting Inspiration

### Hero Pity System

To prevent RNG frustration on rare heroes, a **soft pity** system exists:

- Every 100 rolls without seeing a Legendary hero card, the next Legendary-tier roll guarantees one.
- Every 500 rolls, a specific Legendary of the player's choice is guaranteed (the "Wish" mechanic).

---

## 11. GAME MODES

### 🗺️ Campaign (Main Mode)
- 12 chapters, each with 30 waves + boss
- Story-driven — each chapter unveils a piece of the Shattered Reach lore
- Difficulty scales with chapter number

### 🏟️ Arena (PvP Async)
- Players upload their best squad loadout
- Fight AI versions of other players' squads
- Ladder ranks reset monthly with seasonal rewards

### 💎 Artifact Reclamation (Raid)
- Daily boss-rush mode
- All players hit the same global boss HP pool
- Cooperative — rewards based on damage contribution

### 🏰 Guild Wars (Guild PvP)
- 20-player guilds compete in scheduled 24h events
- Control zones on a shared map
- Team-wide buffs based on guild upgrades

### 🎲 Dice Dungeon (Infinite Endless)
- No wave cap
- Enemies infinitely scale in difficulty
- Leaderboard-based — ranks by deepest wave reached

### 🏋️ Training Grounds
- Practice arena vs. chosen enemy types
- Test hero combos without wave pressure

---

## 12. UI/UX DESIGN

### Key Screens

**Main Menu (The Keep)**
- Center: 3D diorama of your keep, heroes milling about (idle animations)
- Left: Hero Roster, Rune Forge, Relic Vault
- Right: Game Mode selection
- Top: Currency display (Gold, Rubies, Soul Shards)

**In-Battle HUD**
- Top bar: Wave counter, Wardstone HP, Inspiration counter
- Bottom: 4 hero ability buttons (optional manual triggers)
- Right: Wave timer, next-wave preview
- Center: The battlefield

**The Dice Roll Screen** *(the signature moment)*
- Full-screen takeover when a wave ends
- Large animated d20 tumbles in the center
- **Landing on a face triggers a screen shake proportional to the roll**
- Nat 20: gold explosion, choir stinger, slow-motion reveal
- Nat 1: screen cracks, ominous bell, red vignette
- 3 cards fan out beneath the die

### Accessibility

- **Colorblind mode** — symbols added to rarity colors
- **Reduced motion toggle** — disables dice animations, shows result instantly
- **Auto-play toggle** — auto-selects the highest-tier card available (for fast farming)
- **One-handed mode** — UI elements shift for left/right thumb access

---

## 13. ART & AUDIO DIRECTION

### Visual Style

**Overall vibe:** *Charming, painterly 2D with a slight tabletop-miniature feel.* Imagine *Slay the Spire* meets *Darkest Dungeon* meets *Stardew Valley's* warmth. Hand-painted textures, readable silhouettes, a slightly oversaturated palette.

- **Heroes:** Chibi-proportioned (big heads, expressive faces) — cute but heroic
- **Enemies:** More detailed, menacing, scaled up with CR — a goblin is knee-high, a Tarrasque fills the screen
- **UI:** Aged parchment aesthetic with illuminated-manuscript flourishes
- **Dice:** Rendered in 3D with material shaders (stone, iron, gold depending on modifiers)

### Color Language

| Element | Palette |
|---------|---------|
| Heroes | Warm, saturated colors |
| Enemies | Desaturated grays, sickly greens, blood reds |
| UI | Cream, brass, deep blue |
| Critical events | Gold (nat 20), crimson (nat 1) |

### Audio Direction

- **Music:** Orchestral-folk blend. Bagpipes, lutes, and war drums for battle; harp and flute for menus. Think *Baldur's Gate 3* soundtrack meets *Darkest Dungeon's* narrator gravitas.
- **Narrator:** A booming Dungeon Master voice narrates dice rolls, boss intros, and milestones. ("A natural twenty! The gods smile upon you!")
- **SFX:** Chunky, satisfying dice-clack for every roll. Each class has unique attack sounds (metal for Fighters, arcane hum for Wizards, lute strums for Bards).

---

## 14. TECHNICAL NOTES

### Target Platforms

| Platform | Min Spec |
|----------|----------|
| Android | 7.0+, 2GB RAM, 500MB storage |
| iOS | iOS 13+, iPhone 8+ |
| PC (later) | Windows 10, 4GB RAM, DX11 |

### Engine

**Recommended:** Unity 2022 LTS (mature mobile pipeline, large asset store for 2D/VFX).
**Alternative:** Godot 4 (open-source, no royalty) — if targeting a lean team.

### Backend Requirements

- Player account system (persistent cross-device saves)
- Leaderboards for Arena, Dice Dungeon
- Guild system with 20-player sync
- Anti-cheat for PvP (server-side dice rolls — **never client-side**)

### Key Technical Risks

- **RNG integrity in PvP modes** — all dice rolls in competitive contexts must be server-authoritative to prevent exploits
- **Asset bloat** — 24+ heroes × multiple skins × skill VFX can balloon app size quickly; aggressive compression + delta updates required
- **Synchronous guild events** — require scalable real-time infrastructure

---

## 15. DEVELOPMENT ROADMAP

### Phase 1 — Prototype (2–3 months)
- Core battle loop with 1 chapter + 6 heroes
- Dice roll system with placeholder art
- 3 enemy archetypes + 1 boss
- **Goal:** Prove the dice-hybrid upgrade system is fun

### Phase 2 — Vertical Slice (3 months)
- 12 heroes, 3 chapters, full meta-progression loop
- All 5 game modes stubbed out
- Final art direction locked
- **Goal:** A polished 2-hour demo suitable for playtesting / soft-launch

### Phase 3 — Soft Launch (2 months)
- Launch in 2–3 test regions
- 6 chapters, 18 heroes, Arena + Campaign only
- **Goal:** Gather telemetry, iterate on balance, fix pain points

### Phase 4 — Global Launch (1 month)
- All 12 chapters, 24 heroes, all modes live
- Launch event with exclusive hero
- **Goal:** Full release with marketing push

### Phase 5 — Live Ops (Ongoing)
- Monthly hero additions
- Seasonal events (Winterfell, Harvest Moon, Dragon Festival)
- Chapter expansions (The Feywild, The Astral Sea, The Nine Hells)

---

## 📎 APPENDIX A: DESIGN PRINCIPLES

1. **Every dice roll should feel like a story.** Nat 20s get cinematic treatment. Nat 1s should be memorable, not just punishing.
2. **Player agency inside RNG.** The dice decides the *pool*, but the player always chooses. Never remove the choice step.
3. **D&D fans should smile.** Every hero, spell, monster, and item should reference the tabletop experience authentically.
4. **Progression should feel fair.** Pity systems, meta-progression, and Soul Shards exist so no run feels wasted.
5. **No predatory monetization.** If we monetize later, it's cosmetic-only — skins, dice themes, Keep decorations.

---

## 📎 APPENDIX B: GLOSSARY

- **Wardstone Wall** — The fortress the player defends. HP = 0 = game over.
- **Inspiration** — Meta-currency earned mid-battle, used to trigger skills manually.
- **Soul Shards** — Meta-currency for the Wardstone Tree skill tree.
- **Rune** — Socketable stat item for heroes.
- **Relic** — Passive run-wide bonus item, 3 equipped per run.
- **The Shattering** — The cataclysmic event that sundered the Reach.
- **Nat 20 / Nat 1** — Natural (unmodified) rolls of 20 or 1 on a d20.

---

*End of Game Design Document v1.0*
*Document maintained by the Warden Commander's War Council.*
*Roll well. 🎲*
