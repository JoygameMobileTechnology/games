# Skill Sistemi — Tasarım (İMPLEMENTE EDİLDİ)

> Durum (2026-07-31): Bu spec `index.html`'e birebir implemente edildi. Statlar
> hero `st`'den (spd/rng dahil), yetenekler `SKILLS` haritasından geliyor;
> `?test=sim&sc=basic|heal|summon|chain|golge|taunt` senaryoları geçiyor.
> `UNITS[value]` yalnız görsel boyut (size/px) için kaldı.
> Kaynak dosya: `index.html` — savaş sim bölümü `/* ---------- Arena battle simulation ---------- */`.

## 1) `CHARS[].st` genişletmesi (spd/rng eklenecek)

Mevcut `st: { hp, dmg, per }` → `spd` (px/sn) ve `rng` (menzil; yoksa melee 16) eklenir:

| id | spd | rng | not |
|---|---|---|---|
| caylak 45 · sopali 38 · asker 45 · hancerci 55 · sovalye 30 · balyozcu 28 · duellocu 40 · berserker 68 · golge 75 · dev 22 | | — | melee |
| mizrakci | 45 | 30 | melee-erişim (mermisiz) |
| sapanci | 42 | 55 | menzilli |
| okcu | 45 | 75 | · tabancaci 50/65 · bombaci 40/60 |
| ates/buz | 30 | 75 | · sifaci 32/70 · kemiklordu 26/70 · yildirim 28/75 |
| nisanci | 24 | 999 | tüm lane |

`ranged = !!(st.rng && FX[hero.id].proj)` → mizrakci melee-reach, digerleri mermili.
`UNITS[value]` sadece `size`/`px` (görsel boyut) için kalır.

## 2) SKILLS haritası (FX'in yanına)

```js
const SKILLS = {
  caylak: {},
  sopali: { stunChance: .15, stunDur: .5 },
  sapanci: { knockback: 6 },
  asker: {},
  mizrakci: { firstHitMul: 2 },
  hancerci: { dodge: .2 },
  okcu: { pierce: 3 },                      // her 3. atak: hedefe en yakın 2. düşmana da tam hasar
  tabancaci: { kite: 34 },                  // düşman 34px'ten yakınsa ateş ederken geri çekil
  bombaci: { splash: 18, deathBlast: { dmg: 4, r: 30 } },
  sovalye: { taunt: 60 },                   // 60px içindeki düşmanlar hedef seçiminde ona çekilir (d *= .3)
  balyozcu: { stunChance: .3, stunDur: 1, knockback: 4 },
  duellocu: { ramp: { step: .25, max: 3 } },// aynı hedefe ardışık vuruş +%25 (max 3 yığın)
  atesbuyucusu: { splash: 26, burn: { dps: 1, dur: 2 } },
  buzbuyucusu: { slow: { factor: .6, dur: 2 } }, // hız ve saldırı hızı ×.6
  sifaci: { healer: { amount: 4 } },        // saldırmaz; menzildeki en yaralı dosta per başına +4
  berserker: { rage: { at: .5, perMul: .625, spdMul: 1.3 } },
  golge: { infiltrate: true, firstHitMul: 3, stealth: 3 }, // en UZAK düşmanı kilitle; ~0.7s sonra arkasına blink; ilk 3s görünmez (hasar verir, hedeflenemez — alan hasarı yine çarpar)
  nisanci: { sniper: true },                // hedef = en yüksek HP'li düşman
  dev: { splash: 20, spawnShock: { r: 60, push: 26 } },
  kemiklordu: { onKillSummon: 'caylak' },   // öldürdüğü düşman yerinde iskelet (caylak statlı) doğar
  yildirim: { chain: [1, .65, .35] },       // hedefe en yakın 2 ek düşmana azalan hasar + spark görseli
};
```

## 3) Sim entegrasyon noktaları

- **Global sim saati:** `let tSim = 0;` — `simulate(dt)` başında `tSim += dt`. Tüm
  zamanlı debuff'lar (`stunUntil/slowUntil/burnUntil`) buna göre.
- **spawnUnit(side, value, x, y, heroOverride):** `heroOverride` iskelet için;
  statlar hero.st'den: `hp/maxHp, dmg, per, speed, range, ranged`; `u.hitSet = new WeakSet()`
  (firstHit takibi), `u.shots = 0` (pierce sayacı). `spawnShock`: fight'ta doğarken
  r içindeki düşmanları `push` px it + büyük impact halkası.
- **hurtUnit(u, dmg, src):** hp bar `u.maxHp`'ye bölünür (spec.hp DEĞİL); ölümde `killUnit(u, src)`.
- **killUnit(u, src):** mevcut + (a) `SKILLS[u.hero.id].deathBlast` → çevre düşmanlara
  alan hasarı + impact; (b) `src && SKILLS[src.hero.id].onKillSummon && !src.dead` →
  `spawnUnit(src.side, 2, u.x, u.y, CHARS.find(c => c.id === 'caylak'))`.
- **attack(u, t) → dealDmg(u, t, dmg):**
  - dmg hesabı: `firstHitMul` (hitSet'te yoksa çarp+ekle), `ramp` (u.lastT === t ? stack++ : 0).
  - `splash` SKILLS'ten (UNITS'ten değil): hedef çevresi r içindeki her düşmana dealDmg.
  - `chain`: hedefe en yakın 2 diğer düşmana `dmg*.65 / *.35` + t→v spark projektili.
  - `pierce`: `++u.shots % 3 === 0` → hedefe en yakın 2. düşmana tam dmg + uzayan ok görseli.
  - dealDmg içinde sırayla: hedefin `dodge`'u (miss float'ı, çık) → saldırganın
    `burn/slow/stunChance/knockback` rider'ları hedefe yaz → `hurtUnit(t, dmg, u)`.
- **simulate(dt) birim döngüsü:**
  1. `stunUntil > tSim` → hiçbir şey yapma (float '✦' bir kez).
  2. Efektif hız/per: slow (`×.6`), rage (`hp<=maxHp*.5` → per×.625, spd×1.3,
     `el.classList.toggle('rage', on)`).
  3. `burnUntil > tSim` → `burnAcc += dps*dt`; `>=1` olunca `hurtUnit(u,1,null)`.
  4. Hedef seçimi: `healer` → en yaralı dost (yoksa en yakın dosta yanaş, saldırma);
     `sniper` → max-HP düşman; `infiltrate` → spawn'da en uzak düşmanı kilitle;
     normal → en yakın; adaylarda `taunt` yarıçapındaki tank için `d *= .3`.
  5. Menzil içi → attack (healer: heal + '+4' float + holy proj dosta);
     menzil dışı → yürü; `kite` ve düşman < 34px → geri çekilerek ateş.
- **Iterasyon güvenliği:** `for (const u of units)` sırasında `units.push` (summon) güvenli.

## 4) Görsel geri bildirim

- `floatText(x, y, txt, color)` + CSS `.ftxt` (yükselen minik yazı): miss, +4, ✦ stun.
- `.unit.rage .g svg { filter: drop-shadow(0 0 5px #F0605C) saturate(1.3); }`
- `.unit.stunned { filter: grayscale(.4); }` (+ hafif sallanma keyframe'i opsiyonel)
- Zincir/pierce için mevcut `shootProj`/`impactFx` yeniden kullanılır.

## 5) Test planı

- `?test=sim` genişletmesi: senaryo başına spawn + N adım + title dump:
  `sim=heal` (şifacı dostu tam doldurmalı), `sim=summon` (kemik kill → units.length +1),
  `sim=chain` (3 düşman hasar almalı), `sim=stun/slow/burn` (hp/pozisyon asserts),
  `sim=taunt` (hedef tank olmalı), `sim=golge` (kilit = en uzak).
- Balans smoke: `test=start&fill=1` tam maç — çökme yok, finish çalışıyor.

## 6) Bilinçli sadeleştirmeler

- Şifacı savaşta mekanik olarak "0 hasar + heal"; UNITS bağı kalktığı için artık gerçekten saldırmayacak.
- İskelet görsel olarak Çaylak (ayrı iskelet sprite'ı sonra).
- Berserker rage'i histerezissiz (eşik altı anında açık, üstüne çıkarsa kapanır — heal ile mümkün).
