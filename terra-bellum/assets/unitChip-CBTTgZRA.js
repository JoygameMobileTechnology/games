import{e as t,_ as v,s as g,a2 as C,k as M,f as m}from"./index-DY3nRUHA.js";const _={exo:`<svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M20 12.5a4 4 0 0 1 8 0V16h-8z"/>
      <path d="M17.5 17h13l-1.5 11.5h-10z"/>
      <path d="M17.5 18l-4.2 2.6 1.6 7.4"/>
      <path d="M30.5 18l4.2 2.6-1 5.4"/>
      <path d="M33 22.5h9.5v3H36"/>
      <path d="M20.2 28.5L18.6 36l1 6h3.2l.4-7.5"/>
      <path d="M27.8 28.5L29.4 36l-1 6h-3.2l-.4-7.5"/>
      <path d="M22 20.5h4" opacity=".55"/>
    </svg>`,walker:`<svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M14 11h19l3.5 6-3.5 6H14l-3.5-6z"/>
      <path d="M18 16.5h11" opacity=".55"/>
      <path d="M33.5 11.5l8.5-3.2v5.4l-8.5 2.1"/>
      <path d="M24 23v5.5"/>
      <path d="M17.5 23l-6.5 8.5 4.5 7.5-6.5 3.5"/>
      <path d="M30.5 23l6.5 8.5-4.5 7.5 6.5 3.5"/>
    </svg>`,pallet:`<svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8.5 30.5h31a3.8 3.8 0 0 1 0 7.6h-31a3.8 3.8 0 0 1 0-7.6z"/>
      <path d="M13 34.3h22" opacity=".45"/>
      <path d="M12 21.5h24l3.5 9H8.5z"/>
      <path d="M18.5 13h11.5v8.5H18.5z"/>
      <path d="M30 16h13.5v3.4H30"/>
      <path d="M13 25.5h22" opacity=".4"/>
    </svg>`,flyer:`<svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 5.5l4 12.5v9.5L24 34l-4-6.5V18z"/>
      <path d="M27.6 18.5l16 8-16 3.2z"/>
      <path d="M20.4 18.5l-16 8 16 3.2z"/>
      <path d="M30.6 28.6l2.6 8.4M17.4 28.6l-2.6 8.4"/>
      <path d="M24 10v6.5" opacity=".55"/>
    </svg>`,heavy_pallet:`<svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M6 31h36a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8z"/>
      <path d="M10.5 35h27" opacity=".4"/>
      <path d="M9 21h30l4 10H5z"/>
      <path d="M16.5 10.5h15L34 21H14z"/>
      <path d="M33 12.5h12v3.2H33M33 17.4h12v3.2H33"/>
      <path d="M11 25.5h26" opacity=".38"/>
      <path d="M20 14.5h8" opacity=".5"/>
    </svg>`,elite_flyer:`<svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 3.5l3.2 10.5v16.5L24 38l-3.2-7.5V14z"/>
      <path d="M27.2 16l16.8 14.5-16.8-4.2z"/>
      <path d="M20.8 16L4 30.5l16.8-4.2z"/>
      <path d="M26.6 10.5l8.4-3-8.4 6.2z"/>
      <path d="M21.4 10.5L13 7.5l8.4 6.2z"/>
      <path d="M22.4 38.5L24 44.5l1.6-6" opacity=".65"/>
    </svg>`,drone:`<svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="6.2"/>
      <circle cx="24" cy="24" r="2" opacity=".6"/>
      <path d="M19.6 19.6l-7 -7M28.4 19.6l7-7M19.6 28.4l-7 7M28.4 28.4l7 7"/>
      <circle cx="10.4" cy="10.4" r="3.4"/>
      <circle cx="37.6" cy="10.4" r="3.4"/>
      <circle cx="10.4" cy="37.6" r="3.4"/>
      <circle cx="37.6" cy="37.6" r="3.4"/>
    </svg>`};function b(s){return _[s]}const f={cover_bonus:"+1 DEF IN COVER",no_rough_end:"NO REST ON ROUGH",ignores_obstacles:"IGNORES OBSTACLES",map_only:"MAP ONLY"},n={exo:"var(--cyan)",walker:"var(--teal)",pallet:"var(--amber)",flyer:"var(--violet)",heavy_pallet:"var(--gold)",elite_flyer:"var(--magenta)",drone:"var(--lime)"};function z(s){return n[s]}function x(s){const{cost:a}=v[s],i=t("span",{class:"uchip__cost"},t("span",{class:"m",text:`${M(a.m)}M`}));return a.g>0&&i.appendChild(t("span",{class:"g",text:`${M(a.g)}G`})),i}function o(s,a){return t("span",{class:"uchip__stat"},`${s} `,t("b",{text:String(a)}))}function H(s,a={}){const i=v[s],e=["uchip"];a.small&&e.push("uchip--small"),a.selected&&e.push("uchip--sel"),a.dead&&e.push("uchip--dead"),a.onClick&&e.push("uchip--btn"),a.class&&e.push(a.class);const d=a.onClick?t("button",{class:e.join(" "),style:`--accent:${n[s]}`,attrs:{type:"button"},aria:{label:i.name,pressed:a.selected===!0}}):t("div",{class:e.join(" "),style:`--accent:${n[s]}`}),h=t("div",{class:"uchip__art"});h.appendChild(g(_[s])),d.appendChild(h);const l=t("div",{class:"uchip__main"});l.appendChild(t("div",{class:"uchip__name",text:i.name})),l.appendChild(t("div",{class:"uchip__code",text:i.codename}));const c=t("div",{class:"uchip__stats"});i.combat?(c.appendChild(o("HP",i.hp)),c.appendChild(o("ATK",i.atk)),c.appendChild(o("RNG",i.rng)),c.appendChild(o("MOV",i.mov))):c.appendChild(t("span",{class:"uchip__stat",text:"RECON — NON-COMBAT"})),c.appendChild(x(s)),l.appendChild(c),d.appendChild(l);const p=t("div",{class:"uchip__right"});if(a.count!==void 0&&p.appendChild(t("div",{class:"uchip__count",text:String(a.count)})),a.hp!==void 0&&a.maxHp!==void 0&&a.maxHp>0){const r=C(a.hp,a.maxHp,{height:5,autoTint:!0});r.el.classList.add("uchip__hp"),p.appendChild(r.el)}if(p.childElementCount>0&&d.appendChild(p),a.onClick){const r=a.onClick;d.addEventListener("click",()=>r())}return d}function u(s,a){return t("div",{class:"ustat__cell"},t("span",{class:"ustat__k",text:s}),t("span",{class:"ustat__v",text:a}))}function L(s){const a=v[s],i=t("div",{class:"ustat__art",style:`--accent:${n[s]}`}),e=g(_[s]);e.setAttribute("style",`stroke:${n[s]}`),i.appendChild(e);const d=t("div",{class:"ustat__head"},i,t("div",{class:"grow"},t("div",{class:"ustat__name",text:a.name}),t("div",{class:"ustat__code",text:a.codename}),x(s))),h=t("div",{class:"ustat__grid"},u("HP",String(a.hp)),u("ATK",String(a.atk)),u("RNG",String(a.rng)),u("MOV",String(a.mov))),l=t("div",{class:"ustat__traits"});l.appendChild(t("span",{class:"trait",text:`BUILD ${m(a.buildTimeMs)}`})),a.combat||l.appendChild(t("span",{class:"trait",text:"NON-COMBAT"}));for(const c of a.traits)l.appendChild(t("span",{class:"trait",text:f[c]}));return t("div",{class:"ustat",style:`--accent:${n[s]}`},d,h,l,t("p",{class:"ustat__blurb selectable",text:a.blurb}))}export{b as a,H as b,L as c,z as u};
//# sourceMappingURL=unitChip-CBTTgZRA.js.map
