"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/systems/cards/CardText.ts
var CardText_exports = {};
__export(CardText_exports, {
  formatCardDescription: () => formatCardDescription,
  formatEffect: () => formatEffect
});
module.exports = __toCommonJS(CardText_exports);
var ACTIVE_LOCALE = "en";
function loc(en, pt) {
  return ACTIVE_LOCALE === "pt-br" ? pt : en;
}
var STACK_TOKEN = {
  burn: "[burn]",
  bleed: "[bleed]",
  poison: "[poison]",
  slow: "[slow]",
  stun: "[stun]",
  rage: "[rage]"
};
var STAT_TOKEN = {
  str: "[str]",
  vit: "[vit]",
  dex: "[dex]",
  int: "[int]",
  spi: "[spi]"
};
function stackTok(s) {
  if (!s) return "";
  return STACK_TOKEN[s] ?? `[${s}]`;
}
function statTok(s) {
  if (!s) return "";
  return STAT_TOKEN[s] ?? `[${s}]`;
}
var dynamicBuild = false;
var spendingArmor = false;
var baseEffectKeys = /* @__PURE__ */ new Set();
var pyreBurnKeyword = false;
var consumeValueFuel = /* @__PURE__ */ new Set();
var consumedValueStacks = /* @__PURE__ */ new Set();
var detonatorFold = /* @__PURE__ */ new Map();
var multiDetonator = null;
var brineFold = false;
var SENT_OPEN = String.fromCharCode(1);
var SENT_CLOSE = String.fromCharCode(2);
function sentinel(base, inc, per, stat) {
  return `${SENT_OPEN}${base}:${inc}:${per}:${stat}${SENT_CLOSE}`;
}
function scalerSuffix(fx) {
  if (!fx.scale) return "";
  const src = fx.scale.source;
  if (src === "armor" || src === "consumed_stack" || src === "self_stack" || src === "enemy_pre_consume_stack" || src === "missing_hp_pct" || src === "rage") {
    return "";
  }
  if (!fx.scale.stat) return "";
  if (dynamicBuild) {
    if (fx.scale.per <= 0 || fx.scale.value === 0) return "";
    return sentinel(fx.value, fx.scale.value, fx.scale.per, fx.scale.stat);
  }
  return `(${statTok(fx.scale.stat)})`;
}
function statScaleInline(fx, base) {
  if (!fx.scale?.stat) return "";
  if (dynamicBuild) {
    if (fx.scale.per <= 0 || fx.scale.value === 0) return "";
    return sentinel(base, fx.scale.value, fx.scale.per, fx.scale.stat);
  }
  return `(${statTok(fx.scale.stat)})`;
}
function aoeSuffix(fx) {
  if (fx.target === "aoe") return loc(" to all enemies", " a todos os inimigos");
  if (fx.target === "enemy_nearest") return loc(" to the nearest enemy", " ao inimigo mais pr\xF3ximo");
  return "";
}
function condFromEffect(fx) {
  const c = fx.condition;
  if (!c) return null;
  if (c.took_damage_within_ms !== void 0) {
    return { prefix: loc("Vengeance", "Vingan\xE7a"), key: "vengeance", relative: true };
  }
  if (c.hero_hp_pct_below !== void 0) {
    return {
      prefix: loc(`If you have less than ${c.hero_hp_pct_below}%[HP]`, `Se voc\xEA tiver menos de ${c.hero_hp_pct_below}%[HP]`),
      key: `hp_below:${c.hero_hp_pct_below}`,
      relative: true
    };
  }
  if (c.hero_hp_pct_atleast !== void 0) {
    return {
      prefix: loc(`If you have more than ${c.hero_hp_pct_atleast}%[HP]`, `Se voc\xEA tiver mais de ${c.hero_hp_pct_atleast}%[HP]`),
      key: `hp_atleast:${c.hero_hp_pct_atleast}`,
      relative: true
    };
  }
  if (c.self_armor_atleast !== void 0) {
    return {
      prefix: loc(`If [armor] is at least ${c.self_armor_atleast}`, `Se [armor] for ao menos ${c.self_armor_atleast}`),
      key: `armor:${c.self_armor_atleast}`,
      relative: true
    };
  }
  if (c.enemy_stunned === true) {
    return { prefix: loc("If enemy is [stun]", "Se o inimigo estiver [stun]"), key: "enemy_stunned", relative: true };
  }
  if (c.enemy_stack_atleast) {
    const v = c.enemy_stack_atleast.value;
    const s = c.enemy_stack_atleast.stack;
    return {
      prefix: loc(`If enemy has ${v} or more ${stackTok(s)}`, `Se o inimigo tiver ${v} ou mais ${stackTok(s)}`),
      key: `enemy_stack_at:${s}:${v}`,
      relative: true
    };
  }
  if (c.self_stack_atleast) {
    const v = c.self_stack_atleast.value;
    const s = c.self_stack_atleast.stack;
    return {
      prefix: loc(`If you have ${v} or more ${stackTok(s)}`, `Se voc\xEA tiver ${v} ou mais ${stackTok(s)}`),
      key: `self_stack_at:${s}:${v}`,
      relative: true
    };
  }
  if (c.per_stack) return null;
  if (c.enemy_has_stack) {
    return {
      prefix: loc(`If enemy has ${stackTok(c.enemy_has_stack)}`, `Se o inimigo tiver ${stackTok(c.enemy_has_stack)}`),
      key: `enemy_has:${c.enemy_has_stack}`,
      // Without scale/pierce, a flat damage bonus reads as "+N damage"; the
      // damage formatter checks `relative` to decide between "+N" and "more".
      relative: false
    };
  }
  if (c.self_has_stack) {
    return {
      prefix: loc(`If you have ${stackTok(c.self_has_stack)}`, `Se voc\xEA tiver ${stackTok(c.self_has_stack)}`),
      key: `self_has:${c.self_has_stack}`,
      relative: false
    };
  }
  if (c.devour_succeeded === true) {
    return {
      prefix: loc("Permanently remove 1 common card from your deck this combat", "Remova permanentemente 1 carta comum do seu baralho neste combate"),
      key: "devour",
      relative: false
    };
  }
  return null;
}
function effectBaseKey(fx) {
  switch (fx.type) {
    case "damage":
      return fx.pierce_armor ? "damage:pierce" : "damage";
    case "dot":
      return fx.stack ? `dot:${fx.stack}` : "dot";
    case "heal":
      return "heal";
    case "armor":
      return "armor";
    case "stack":
      return fx.consume_stack || fx.spread ? null : fx.stack ? `stack:${fx.stack}` : "stack";
    case "stat_gain":
      return fx.stat ? `stat_gain:${fx.stat}` : "stat_gain";
    default:
      return null;
  }
}
function collectBaseEffectKeys(effects) {
  const keys = /* @__PURE__ */ new Set();
  for (const fx of effects ?? []) {
    if (fx.condition) continue;
    const k = effectBaseKey(fx);
    if (k) keys.add(k);
  }
  return keys;
}
function useRelativePhrasing(fx, gate) {
  if (!gate) return false;
  const key = effectBaseKey(fx);
  const hasBase = !!key && baseEffectKeys.has(key);
  if (gate.relative) return hasBase;
  const hasScale = !!fx.scale && fx.scale.source !== "armor";
  if (fx.type === "damage" && (hasScale || fx.pierce_armor)) return hasBase;
  if (fx.type === "dot") return hasBase;
  return false;
}
function multiHitTimes(fx) {
  const extra = fx.multi_hit ?? 0;
  return 1 + extra;
}
function timesWord(n, scaler) {
  if (n <= 1) return "";
  if (n === 2) return `${loc(" twice", " duas vezes")}${scaler ? "" : ""}`;
  if (n === 3) return loc(" three times", " tr\xEAs vezes");
  if (n === 4) return loc(" four times", " quatro vezes");
  if (n === 5) return loc(" five times", " cinco vezes");
  return loc(` ${n} times`, ` ${n} vezes`);
}
function damageBody(fx, gate) {
  const v = fx.value;
  const pierce = !!fx.pierce_armor;
  const word = pierce ? "Pierce" : "";
  const relative = useRelativePhrasing(fx, gate);
  const scaler = scalerSuffix(fx);
  const aoe = aoeSuffix(fx);
  if (fx.target === "self") {
    const pcs = pierce ? loc(", ignoring your [armor]", ", ignorando sua [armor]") : "";
    return `${loc("Lose", "Perca")} ${v}[HP]${scaler}${pcs}`;
  }
  const c = fx.condition ?? {};
  if (c.per_stack && (c.enemy_has_stack || c.self_has_stack)) {
    const stk = c.enemy_has_stack ?? c.self_has_stack;
    const side = c.enemy_has_stack ? loc("on enemy", "no inimigo") : loc("on yourself", "em voc\xEA");
    const lead = v === 0 ? fx.scale?.value ?? 1 : v;
    const statS = statScaleInline(fx, fx.value);
    if (c.enemy_has_stack === "burn" && c.per_stack) {
      if (pierce) {
        return loc(
          `Consume all [burn] and deal ${lead}${statS} Pierce per [burn] consumed${aoe}`,
          `Consuma todo [burn] e cause ${lead}${statS} com Perfura\xE7\xE3o por [burn] consumido${aoe}`
        );
      }
      return loc(
        `Consume all [burn] and deal ${lead}${statS} damage per [burn] consumed${aoe}`,
        `Consuma todo [burn] e cause ${lead}${statS} de dano por [burn] consumido${aoe}`
      );
    }
    if (pierce) {
      return loc(
        `Deal ${lead}${statS} Pierce per ${stackTok(stk)} ${side}${aoe}`,
        `Cause ${lead}${statS} com Perfura\xE7\xE3o por ${stackTok(stk)} ${side}${aoe}`
      );
    }
    return loc(
      `Deal ${lead}${statS} damage per ${stackTok(stk)} ${side}${aoe}`,
      `Cause ${lead}${statS} de dano por ${stackTok(stk)} ${side}${aoe}`
    );
  }
  if (fx.consume_stack_value) {
    const stk = fx.consume_stack_value;
    const target = fx.target === "aoe" ? loc(" to all enemies", " a todos os inimigos") : "";
    const lead = v === 0 ? fx.scale?.value ?? 1 : v;
    const statS = statScaleInline(fx, fx.value);
    const phrase = consumeValuePhrase(stk);
    const tail = pierce ? loc(` Pierce per ${stackTok(stk)} ${phrase}`, ` com Perfura\xE7\xE3o por ${stackTok(stk)} ${phrase}`) : loc(` per ${stackTok(stk)} ${phrase}`, ` por ${stackTok(stk)} ${phrase}`);
    const foldAmt = detonatorFold.get(stk);
    if (foldAmt !== void 0) {
      return loc(
        `Consume ${localizeAmount(foldAmt)} ${stackTok(stk)} and deal ${lead}${statS}${tail}${target}`,
        `Consuma ${localizeAmount(foldAmt)} ${stackTok(stk)} e cause ${lead}${statS}${tail}${target}`
      );
    }
    return loc(`Deal ${lead}${statS}${tail}${target}`, `Cause ${lead}${statS}${tail}${target}`);
  }
  if (fx.scale?.source === "armor") {
    const per = fx.scale.per ?? 1;
    const inc = fx.scale.value ?? 1;
    const statS = "";
    const armorRef = spendingArmor ? loc("consumed", "consumido") : loc("you have", "que voc\xEA tem");
    const perWord = loc("per", "por");
    const perArmor = per === 1 ? `${perWord} [armor] ${armorRef}` : `${perWord} ${per}[armor] ${armorRef}`;
    if (v === 0) {
      if (per === 1 && inc === 1 && !spendingArmor) {
        return loc(`Deal damage equal to your [armor]`, `Cause dano igual \xE0 sua [armor]`);
      }
      if (pierce) {
        return loc(`Deal ${inc}${statS} Pierce ${perArmor}${aoe}`, `Cause ${inc}${statS} com Perfura\xE7\xE3o ${perArmor}${aoe}`);
      }
      return loc(`Deal ${inc}${statS} damage ${perArmor}${aoe}`, `Cause ${inc}${statS} de dano ${perArmor}${aoe}`);
    }
    const w = pierce ? loc(" Pierce", " com Perfura\xE7\xE3o") : "";
    const t2 = timesWord(multiHitTimes(fx), "");
    return loc(
      `Deal ${v}${w}${t2}, +${inc}${statS} damage ${perArmor}${aoe}`,
      `Cause ${v}${w}${t2}, +${inc}${statS} de dano ${perArmor}${aoe}`
    );
  }
  if (relative) {
    const pcs = pierce ? loc(" Pierce", " com Perfura\xE7\xE3o") : "";
    if (fx.per_hit) return loc(`each hit deals ${v}${scaler} more${pcs}${aoe}`, `cada acerto causa ${v}${scaler} a mais${pcs}${aoe}`);
    const times2 = multiHitTimes(fx);
    const t2 = timesWord(times2, scaler);
    if (times2 >= 2) return loc(`deal ${v}${scaler}${pcs}${t2} more${aoe}`, `cause ${v}${scaler}${pcs}${t2} a mais${aoe}`);
    return loc(`deal ${v}${scaler} more${pcs}${aoe}`, `cause ${v}${scaler} a mais${pcs}${aoe}`);
  }
  if (gate && !relative) {
    if (fx.per_hit) {
      const pcs = pierce ? loc(" Pierce", " com Perfura\xE7\xE3o") : "";
      return loc(`each hit also deals ${v}${scaler}${pcs}${aoe}`, `cada acerto tamb\xE9m causa ${v}${scaler}${pcs}${aoe}`);
    }
    if (!baseEffectKeys.has(pierce ? "damage:pierce" : "damage")) {
      const pcs = pierce ? loc(" Pierce", " com Perfura\xE7\xE3o") : "";
      const t2 = timesWord(multiHitTimes(fx), scaler);
      return loc(`Deal ${v}${scaler}${pcs}${t2}${aoe}`, `Cause ${v}${scaler}${pcs}${t2}${aoe}`);
    }
    if (!fx.scale && !pierce) return loc(`+${v} damage`, `+${v} de dano`);
    if (!fx.scale && pierce) return loc(`+${v} Pierce`, `+${v} de Perfura\xE7\xE3o`);
    return loc(`deal ${v}${scaler}${pierce ? " Pierce" : ""}${aoe}`, `cause ${v}${scaler}${pierce ? " com Perfura\xE7\xE3o" : ""}${aoe}`);
  }
  const times = multiHitTimes(fx);
  const t = timesWord(times, scaler);
  if (pierce) {
    return loc(`Deal ${v}${scaler} Pierce${t}${aoe}`, `Cause ${v}${scaler} com Perfura\xE7\xE3o${t}${aoe}`);
  }
  return loc(`Deal ${v}${scaler}${t}${aoe}`, `Cause ${v}${scaler}${t}${aoe}`);
}
function dotBody(fx, gate) {
  const v = fx.value;
  const stk = stackTok(fx.stack);
  const scaler = scalerSuffix(fx);
  const aoe = aoeSuffix(fx);
  const relative = useRelativePhrasing(fx, gate);
  const perHit = !!fx.per_hit;
  if (fx.target === "self_dot") {
    if (relative) return loc(`apply ${v}${stk}${scaler} more to yourself`, `aplique ${v}${stk}${scaler} a mais em voc\xEA`);
    return loc(`Apply ${v}${stk}${scaler} to yourself`, `Aplique ${v}${stk}${scaler} em voc\xEA`);
  }
  if (perHit) {
    if (relative) return loc(`each hit applies ${v} more ${stk}${scaler}`, `cada acerto aplica ${v} a mais ${stk}${scaler}`);
    return loc(`each hit applies ${v}${stk}${scaler}`, `cada acerto aplica ${v}${stk}${scaler}`);
  }
  const c = fx.condition ?? {};
  if (c.per_stack && (c.enemy_has_stack || c.self_has_stack)) {
    const src = c.enemy_has_stack ?? c.self_has_stack;
    const side = c.enemy_has_stack ? loc("on enemy", "no inimigo") : loc("on yourself", "em voc\xEA");
    return loc(`Apply ${v}${stk}${scaler} per ${stackTok(src)} ${side}`, `Aplique ${v}${stk}${scaler} por ${stackTok(src)} ${side}`);
  }
  if (fx.consume_stack_value) {
    return loc(
      `Apply ${v}${stk}${scaler} per ${stackTok(fx.consume_stack_value)} ${consumeValuePhrase(fx.consume_stack_value)}`,
      `Aplique ${v}${stk}${scaler} por ${stackTok(fx.consume_stack_value)} ${consumeValuePhrase(fx.consume_stack_value)}`
    );
  }
  if (relative) return loc(`apply ${v} more ${stk}${scaler}`, `aplique ${v} a mais ${stk}${scaler}`);
  return loc(`Apply ${v}${stk}${scaler}${aoe}`, `Aplique ${v}${stk}${scaler}${aoe}`);
}
function healBody(fx, gate) {
  const v = fx.value;
  const scaler = scalerSuffix(fx);
  const relative = useRelativePhrasing(fx, gate);
  if (fx.consume_stack_value) {
    return loc(
      `Heal ${v}${scaler} per ${stackTok(fx.consume_stack_value)} ${consumeValuePhrase(fx.consume_stack_value)}`,
      `Cure ${v}${scaler} por ${stackTok(fx.consume_stack_value)} ${consumeValuePhrase(fx.consume_stack_value)}`
    );
  }
  if (relative) return loc(`heal ${v}${scaler} more`, `cure ${v}${scaler} a mais`);
  return loc(`Heal ${v}${scaler}`, `Cure ${v}${scaler}`);
}
function armorBody(fx, gate) {
  const v = fx.value;
  const scaler = scalerSuffix(fx);
  const relative = useRelativePhrasing(fx, gate);
  if (relative) return loc(`gain ${v} more [armor]${scaler}`, `ganhe ${v} a mais [armor]${scaler}`);
  return loc(`Gain ${v}[armor]${scaler}`, `Ganhe ${v}[armor]${scaler}`);
}
function stackBody(fx, gate) {
  const v = fx.value;
  const stk = stackTok(fx.stack);
  const scaler = scalerSuffix(fx);
  const relative = useRelativePhrasing(fx, gate);
  if (fx.spread) {
    const pct = Math.round(fx.spread.ratio * 100);
    const max = fx.spread.max_targets ? loc(` to up to ${fx.spread.max_targets} other enemies`, ` para at\xE9 ${fx.spread.max_targets} outros inimigos`) : "";
    return loc(`${pct}% of enemy's ${stk} spreads${max}`, `${pct}% do ${stk} do inimigo se espalha${max}`);
  }
  if (fx.consume_stack) return loc(`consume ${consumeAmountFx(fx)} ${stk}`, `consuma ${localizeAmount(consumeAmountFx(fx))} ${stk}`);
  if (v === 0 && fx.scale?.source === "self_stack" && fx.scale.stack) {
    return loc(
      `Apply 1${stk}${scaler} per ${stackTok(fx.scale.stack)} on yourself`,
      `Aplique 1${stk}${scaler} por ${stackTok(fx.scale.stack)} em voc\xEA`
    );
  }
  if (fx.target === "self" && fx.stack === "rage") {
    if (relative) return loc(`gain ${v}${scaler} more ${stk}`, `ganhe ${v}${scaler} a mais ${stk}`);
    if (v >= 0) return loc(`Gain ${v}${scaler}${stk}`, `Ganhe ${v}${scaler}${stk}`);
    return loc(`Lose ${Math.abs(v)}${scaler}${stk}`, `Perca ${Math.abs(v)}${scaler}${stk}`);
  }
  const cps = fx.condition ?? {};
  if (cps.per_stack && (cps.enemy_has_stack || cps.self_has_stack)) {
    const src = cps.enemy_has_stack ?? cps.self_has_stack;
    const side = cps.enemy_has_stack ? loc("on enemy", "no inimigo") : loc("on yourself", "em voc\xEA");
    return loc(`Apply ${v}${stk}${scaler} per ${stackTok(src)} ${side}`, `Aplique ${v}${stk}${scaler} por ${stackTok(src)} ${side}`);
  }
  const aoe = aoeSuffix(fx);
  if (relative) return loc(`apply ${v} more ${stk}${scaler}${aoe}`, `aplique ${v} a mais ${stk}${scaler}${aoe}`);
  return loc(`Apply ${v}${stk}${scaler}${aoe}`, `Aplique ${v}${stk}${scaler}${aoe}`);
}
function resourceBody(fx) {
  const tok = fx.type === "stamina" ? "[stam]" : "[mana]";
  if (fx.value === 0) return "";
  const scaler = scalerSuffix(fx);
  if (fx.value < 0) return loc(`Lose ${Math.abs(fx.value)}${tok}${scaler}`, `Perca ${Math.abs(fx.value)}${tok}${scaler}`);
  return loc(`Gain ${fx.value}${tok}${scaler}`, `Ganhe ${fx.value}${tok}${scaler}`);
}
function convertBody(fx, gate) {
  const from = stackTok(fx.from);
  const toStr = String(fx.to ?? "");
  const isArmor = toStr === "armor";
  const to = isArmor ? "[armor]" : stackTok(fx.to);
  const amount = consumeAmount(fx.value ?? 0);
  if (fx.target === "self" && !["rage", "burn", "bleed", "armor"].includes(toStr)) {
    return loc(
      `Consume ${amount} ${from} (no ${to} is produced)`,
      `Consuma ${localizeAmount(amount)} ${from} (nenhum ${to} \xE9 produzido)`
    );
  }
  const factor = fx.factor && fx.factor !== 1 ? fx.factor : 1;
  const cap = fx.cap !== void 0 ? loc(` (max ${fx.cap})`, ` (m\xE1x. ${fx.cap})`) : "";
  let out;
  if (amount === "all") {
    if (isArmor) {
      out = loc(
        `Gain 1${to}${statScaleInline(fx, 1)} per ${from} consumed${cap}`,
        `Ganhe 1${to}${statScaleInline(fx, 1)} por ${from} consumido${cap}`
      );
    } else if (brineFold) {
      out = loc(
        `Consume all ${from} and apply ${factor}${to}${statScaleInline(fx, factor)} per ${from} consumed${cap}`,
        `Consuma todo ${from} e aplique ${factor}${to}${statScaleInline(fx, factor)} por ${from} consumido${cap}`
      );
    } else {
      out = loc(
        `Apply ${factor}${to}${statScaleInline(fx, factor)} per ${from} consumed${cap}`,
        `Aplique ${factor}${to}${statScaleInline(fx, factor)} por ${from} consumido${cap}`
      );
    }
  } else {
    const N = Number(amount);
    out = isArmor ? loc(`Gain ${N}${to}${statScaleInline(fx, N)}${cap}`, `Ganhe ${N}${to}${statScaleInline(fx, N)}${cap}`) : loc(`Apply ${N * factor}${to}${statScaleInline(fx, N * factor)}`, `Aplique ${N * factor}${to}${statScaleInline(fx, N * factor)}`);
  }
  if (gate) return loc(`Consume ${amount} ${from} and ${lcFirst(out)}`, `Consuma ${localizeAmount(amount)} ${from} e ${lcFirst(out)}`);
  return out;
}
function multiplyBody(fx) {
  const stk = stackTok(fx.stack);
  const factor = fx.factor ?? 2;
  const onWho = fx.target === "self" ? loc("on yourself", "em voc\xEA") : loc("on enemy", "no inimigo");
  if (factor === 2) return loc(`double the ${stk} ${onWho}`, `dobre o ${stk} ${onWho}`);
  return loc(`multiply ${stk} ${onWho} by ${factor}`, `multiplique o ${stk} ${onWho} por ${factor}`);
}
function stackBoostBody(fx) {
  const stk = stackTok(fx.stack);
  const onWho = fx.target === "self" ? loc("on yourself", "em voc\xEA") : loc("on enemy", "no inimigo");
  const factor = (fx.value ?? 0) + 1;
  if (factor === 2) return loc(`double the ${stk} ${onWho}`, `dobre o ${stk} ${onWho}`);
  if (factor === 3) return loc(`triple the ${stk} ${onWho}`, `triplique o ${stk} ${onWho}`);
  return loc(`multiply the ${stk} ${onWho} by ${factor}`, `multiplique o ${stk} ${onWho} por ${factor}`);
}
function cdDebtBody(fx) {
  return loc(`This card delays ${fx.value} more seconds next time`, `Esta carta atrasa ${fx.value} segundos a mais na pr\xF3xima vez`);
}
function buffBody(fx) {
  const stat = fx.scale?.stat ? statTok(fx.scale.stat) : "";
  const sign = fx.value >= 0 ? "+" : "";
  return `${sign}${fx.value} ${stat}`;
}
function debuffStatBody(fx) {
  const stat = fx.scale?.stat ? statTok(fx.scale.stat) : loc("a stat", "um atributo");
  return loc(`enemy has \u2212${fx.value} ${stat}`, `o inimigo tem \u2212${fx.value} de ${stat}`);
}
function statGainBody(fx, gate) {
  const st = statTok(fx.stat);
  const cap = fx.max_per_combat !== void 0 && Math.abs(fx.value) < fx.max_per_combat ? loc(` (max ${fx.max_per_combat} per combat)`, ` (m\xE1x. ${fx.max_per_combat} por combate)`) : "";
  const lead = `${fx.value}${st}`;
  if (useRelativePhrasing(fx, gate)) return loc(`gain ${lead} this combat${cap}`, `ganhe ${lead} neste combate${cap}`);
  return loc(`Gain ${lead} this combat${cap}`, `Ganhe ${lead} neste combate${cap}`);
}
function debuffBody(fx) {
  return loc(`enemy has \u2212${fx.value} Defense`, `o inimigo tem \u2212${fx.value} de Defesa`);
}
function lcFirst(s) {
  if (!s) return s;
  return s[0].toLowerCase() + s.slice(1);
}
function effectListBody(then) {
  if (!then) return "";
  const arr = Array.isArray(then) ? then : [then];
  return arr.map((e) => {
    const f = fragmentForEffect(e);
    if (!f.body) return f.gatePrefix ?? "";
    return f.gatePrefix ? `${f.gatePrefix}: ${f.body}` : f.body;
  }).filter(Boolean).join(loc(" and ", " e "));
}
function eventCounterPhrase(ec) {
  const stack = ec.filter?.stack;
  const minAmt = ec.filter?.min_amount;
  const n = ec.threshold ?? 1;
  const each = !!ec.repeat || n <= 1;
  switch (ec.event) {
    case "armor_gained":
      return minAmt ? loc(`if you gain at least ${minAmt}[armor]`, `se voc\xEA ganhar ao menos ${minAmt}[armor]`) : loc("if you gain [armor]", "se voc\xEA ganhar [armor]");
    case "card_played":
      return loc(`if you play ${n} or more cards`, `se voc\xEA jogar ${n} ou mais cartas`);
    case "stack_applied":
      return loc(`if you apply ${stackTok(stack)} ${n}+ times`, `se voc\xEA aplicar ${stackTok(stack)} ${n}+ vezes`);
    case "stack_consumed":
      return loc(`if you consume ${minAmt ?? n}+ ${stackTok(stack)}`, `se voc\xEA consumir ${minAmt ?? n}+ ${stackTok(stack)}`);
    case "hp_lost":
      return each ? loc("each time you lose [HP]", "cada vez que voc\xEA perde [HP]") : loc(`if you lose [HP] ${n}+ times`, `se voc\xEA perder [HP] ${n}+ vezes`);
    case "heal_received":
      return each ? loc("each time you heal", "cada vez que voc\xEA se cura") : loc(`if you heal ${n}+ times`, `se voc\xEA se curar ${n}+ vezes`);
    default:
      return "";
  }
}
function auraTriggerPhrase(fx) {
  switch (fx.trigger) {
    case "on_hit_dealt":
      return loc("every time you hit an enemy", "toda vez que voc\xEA acerta um inimigo");
    case "on_hit_taken":
      return loc("every time you take damage", "toda vez que voc\xEA recebe dano");
    case "on_self_damage":
      return loc("every time you lose [HP]", "toda vez que voc\xEA perde [HP]");
    case "on_self_dot_tick":
      return loc("every time a self DoT ticks", "toda vez que um efeito cont\xEDnuo em voc\xEA atua");
    case "on_slow_applied":
      return loc("every time you apply [slow]", "toda vez que voc\xEA aplica [slow]");
    case "on_armor_gained": {
      const n = fx.min_amount ?? 1;
      return loc(`every time you gain at least ${n}[armor]`, `toda vez que voc\xEA ganha ao menos ${n}[armor]`);
    }
    case "on_kill_with_stack": {
      const s = stackTok(fx.threshold_stack);
      return loc(`every time you kill an enemy with ${s}`, `toda vez que voc\xEA mata um inimigo com ${s}`);
    }
    case "on_stack_threshold": {
      const s = stackTok(fx.threshold_stack);
      const t = fx.threshold ?? 0;
      return loc(`if you have ${t} or more ${s}`, `se voc\xEA tiver ${t} ou mais ${s}`);
    }
    case "on_enemy_stack_threshold": {
      const s = stackTok(fx.threshold_stack);
      const t = fx.threshold ?? 0;
      return loc(`if enemy has ${t} or more ${s}`, `se o inimigo tiver ${t} ou mais ${s}`);
    }
    case "on_hp_pct_below": {
      const th = fx.threshold ?? 50;
      return loc(`the first time you drop below ${th}%[HP]`, `na primeira vez que voc\xEA fica abaixo de ${th}%[HP]`);
    }
    default:
      return "";
  }
}
function formatModifierAura(fx, dur, secs) {
  const k = fx.modifier.kind;
  const v = fx.modifier.value;
  if (k === "cd_reduction") {
    const pct = Math.round(v * 100);
    return secs > 0 ? loc(`Haste ${pct}% for ${secs} seconds`, `Acelera\xE7\xE3o ${pct}% por ${secs} segundos`) : loc(`Haste ${pct}%`, `Acelera\xE7\xE3o ${pct}%`);
  }
  if (k === "def") {
    if (fx.target === "enemy") return loc(`${dur}, enemy has \u2212${Math.abs(v)} Defense`, `${dur}, o inimigo tem \u2212${Math.abs(v)} de Defesa`);
    const sign2 = v >= 0 ? "+" : "";
    return loc(`${dur}, ${sign2}${v} Defense`, `${dur}, ${sign2}${v} de Defesa`);
  }
  if (k === "damage_taken_pct") {
    const pct = Math.round(Math.abs(v) * 100);
    const phrase = v < 0 ? loc(`take ${pct}% less damage`, `recebe ${pct}% menos dano`) : loc(`take ${pct}% more damage`, `recebe ${pct}% mais dano`);
    return secs > 0 ? `${dur}, ${phrase}` : phrase;
  }
  if (k === "damage_dealt_pct") {
    const pct = Math.round(Math.abs(v) * 100);
    const phrase = v >= 0 ? loc(`deal ${pct}% more damage`, `causa ${pct}% mais dano`) : loc(`deal ${pct}% less damage`, `causa ${pct}% menos dano`);
    return `${dur}, ${phrase}`;
  }
  if (k === "burn_taken") return loc(`${dur}, enemy takes +${v} from [burn]`, `${dur}, o inimigo recebe +${v} de [burn]`);
  if (k === "armor_bonus_pct") return loc(`${dur}, every [armor] you gain is +${Math.round(v * 100)}%`, `${dur}, cada [armor] que voc\xEA ganha \xE9 +${Math.round(v * 100)}%`);
  if (k === "armor_bonus_flat") return loc(`${dur}, every [armor] you gain is +${v}`, `${dur}, cada [armor] que voc\xEA ganha \xE9 +${v}`);
  if (k === "hero_hit_bonus") {
    const stk = fx.modifier.stack;
    return stk ? loc(`${dur}, every attack deals ${v} more damage per ${stackTok(stk)}`, `${dur}, cada ataque causa ${v} a mais de dano por ${stackTok(stk)}`) : loc(`${dur}, every attack deals ${v} more damage`, `${dur}, cada ataque causa ${v} a mais de dano`);
  }
  if (k === "ignore_immunity") {
    const s = fx.modifier.stack ? stackTok(fx.modifier.stack) : "";
    return loc(`${dur}, ignore enemy ${s} immunity`, `${dur}, ignore a imunidade a ${s} do inimigo`);
  }
  if (k === "fire_damage_taken_pct") {
    return loc(`${dur}, enemy takes +${Math.round(Math.abs(v) * 100)}% [fire] damage`, `${dur}, o inimigo recebe +${Math.round(Math.abs(v) * 100)}% de dano de [fire]`);
  }
  if (k === "stack_gain_mult") {
    const s = fx.modifier.stack ? stackTok(fx.modifier.stack) : "";
    const pct = Math.round(v * 100);
    return v === 1 ? loc(`${dur}, double all ${s} gained`, `${dur}, dobre todo ${s} ganho`) : loc(`${dur}, ${s} gains +${pct}%`, `${dur}, ${s} ganho aumenta +${pct}%`);
  }
  const sign = v >= 0 ? "+" : "";
  return `${dur}, ${sign}${v}${statTok(k)}`;
}
function formatEventCounterAura(fx, dur) {
  const phrase = eventCounterPhrase(fx.event_counter);
  const body = lcFirst(effectListBody(fx.then));
  const clause = phrase ? `${phrase}, ${body}` : body;
  return dur ? `${dur}, ${clause}` : clause;
}
function formatTickAura(fx, dur) {
  const interval = fx.tick_ms / 1e3;
  const intervalStr = interval === Math.floor(interval) ? `${interval}` : interval.toFixed(1);
  const unit = interval === 1 ? loc("second", "segundo") : loc("seconds", "segundos");
  return loc(
    `${dur}, every ${intervalStr} ${unit}, ${lcFirst(effectListBody(fx.then))}`,
    `${dur}, a cada ${intervalStr} ${unit}, ${lcFirst(effectListBody(fx.then))}`
  );
}
function formatTriggerAura(fx, dur) {
  const trigPhrase = auraTriggerPhrase(fx);
  if (!trigPhrase) return dur || "";
  const body = lcFirst(effectListBody(fx.then));
  const cd = fx.cooldown_ms ? loc(` No more than once every ${Math.round(fx.cooldown_ms / 1e3)} seconds.`, ` No m\xE1ximo uma vez a cada ${Math.round(fx.cooldown_ms / 1e3)} segundos.`) : "";
  const trig = fx.trigger;
  if (trig === "on_stack_threshold" || trig === "on_enemy_stack_threshold") {
    return `${trigPhrase}: ${body}${cd}`;
  }
  if (dur) return `${dur}, ${trigPhrase}, ${body}${cd}`;
  return `${trigPhrase}: ${body}${cd}`;
}
function formatAura(fx) {
  const combatLong = fx.ttl_ms === null || typeof fx.ttl_ms === "number" && fx.ttl_ms >= 999999;
  const secs = !combatLong && fx.ttl_ms ? Math.round(fx.ttl_ms / 1e3) : 0;
  let dur;
  if (combatLong) dur = loc("For the rest of combat", "Pelo resto do combate");
  else if (secs > 0) dur = loc(`For ${secs} seconds`, `Por ${secs} segundos`);
  else dur = "";
  const trig = fx.trigger;
  if (trig === "on_armor_break") return `${loc("Brace", "Firmeza")}: ${effectListBody(fx.then)}`;
  if (fx.event_counter) return formatEventCounterAura(fx, dur);
  if ((!trig || trig === "passive_armor_scaler") && fx.modifier && !fx.tick_ms) return formatModifierAura(fx, dur, secs);
  if (!trig && fx.tick_ms && fx.then) return formatTickAura(fx, dur);
  return formatTriggerAura(fx, dur);
}
function fragmentForEffect(fx) {
  const folded = fx.type === "damage" && !!fx.consume_stack_value && detonatorFold.has(fx.consume_stack_value);
  const gate = folded ? null : condFromEffect(fx);
  const gateKey = gate?.key ?? null;
  const gatePrefix = gate?.prefix ?? null;
  let body;
  switch (fx.type) {
    case "damage":
      body = damageBody(fx, gate);
      break;
    case "dot":
      body = dotBody(fx, gate);
      break;
    case "heal":
      body = healBody(fx, gate);
      break;
    case "armor":
      body = armorBody(fx, gate);
      break;
    case "stack":
      body = stackBody(fx, gate);
      break;
    case "stamina":
    case "mana":
      body = resourceBody(fx);
      break;
    case "aura":
      body = formatAura(fx);
      break;
    case "convert_stack":
      body = convertBody(fx, gate);
      break;
    case "multiply_stack":
      body = multiplyBody(fx);
      break;
    case "stack_boost":
      body = stackBoostBody(fx);
      break;
    case "cd_debt":
      body = cdDebtBody(fx);
      break;
    case "debuff":
      body = debuffBody(fx);
      break;
    case "buff":
      body = buffBody(fx);
      break;
    case "debuff_stat":
      body = debuffStatBody(fx);
      break;
    case "stat_gain":
      body = statGainBody(fx, gate);
      break;
    case "devour":
      body = fx.devour?.exhaust_next ? loc("Exhaust the next card in order", "Esgote a pr\xF3xima carta na ordem") : "";
      break;
    default:
      body = "";
  }
  if (fx.overload_lockout_ms && body) {
    const s = Math.round(fx.overload_lockout_ms / 1e3);
    body = loc(`${body} and this card delays ${s} more seconds next time`, `${body} e esta carta atrasa ${s} segundos a mais na pr\xF3xima vez`);
  }
  return { gateKey, gatePrefix, body };
}
function formatEffect(fx) {
  const frag = fragmentForEffect(fx);
  if (!frag.body) return frag.gatePrefix ?? "";
  if (frag.gatePrefix) {
    return `${frag.gatePrefix}: ${frag.body}`;
  }
  return frag.body;
}
var SCALER_SUFFIX_RE = /\(\[(?:str|vit|dex|int|spi)\]\)/g;
function statValue(stats, stat) {
  return stats[stat] ?? 0;
}
function applyDynamicReplacements(out, stats, shift) {
  const re = /(\d+)([^\x01\x02\d]*?)\x01(-?\d+):(-?\d+):(\d+):(str|vit|dex|int|spi)\x02/g;
  let result = out.replace(re, (_m, _num, mid, base, inc, per, stat) => {
    const b = Number.parseInt(base, 10);
    const i = Number.parseInt(inc, 10);
    const p = Number.parseInt(per, 10);
    const desc = mid ?? "";
    if (shift) {
      const perStr = p > 1 ? `${p} ` : "";
      const lhs = b === 0 ? "" : `${b} + `;
      return `(${lhs}${i} ${loc("per", "por")} ${perStr}[${stat}])${desc}`;
    }
    const resolved = b + Math.floor(statValue(stats, stat) / p) * i;
    return `[[v:${resolved}:${stat}]]${desc}`;
  });
  result = result.replace(/\x01[^\x02]*\x02/g, "").replace(SCALER_SUFFIX_RE, "").replace(/ {2,}/g, " ").replace(/ \./g, ".").trim();
  return result;
}
function consumeAmount(value) {
  return Math.abs(value) >= 99 ? "all" : String(Math.abs(value));
}
function consumeAmountFx(fx) {
  if (fx.consume_fraction != null) {
    return fx.consume_fraction === 0.5 ? "half" : `${Math.round(fx.consume_fraction * 100)}%`;
  }
  return consumeAmount(fx.value ?? 0);
}
function consumeValuePhrase(stack) {
  if (consumedValueStacks.has(stack)) return loc("consumed", "consumido");
  return stack === "rage" || stack.startsWith("hero_") ? loc("on yourself", "em voc\xEA") : loc("on enemy", "no inimigo");
}
function localizeAmount(amount) {
  if (ACTIVE_LOCALE !== "pt-br") return amount;
  if (amount === "all") return "todo";
  if (amount === "half") return "metade de";
  if (amount.endsWith("%")) return `${amount} de`;
  return amount;
}
function joinTokens(tokens) {
  if (tokens.length <= 1) return tokens[0] ?? "";
  if (tokens.length === 2) return `${tokens[0]}${loc(" and ", " e ")}${tokens[1]}`;
  return `${tokens.slice(0, -1).join(", ")}${loc(" and ", " e ")}${tokens[tokens.length - 1]}`;
}
function buildConsumeClauses(card) {
  const byAmount = /* @__PURE__ */ new Map();
  const order = [];
  const add = (amount, token) => {
    if (!byAmount.has(amount)) {
      byAmount.set(amount, []);
      order.push(amount);
    }
    const arr = byAmount.get(amount);
    if (!arr.includes(token)) arr.push(token);
  };
  for (const fx of card.effects ?? []) {
    if (fx.condition) continue;
    if (fx.type === "stack" && fx.consume_stack && fx.value < 0) {
      if (pyreBurnKeyword && fx.stack === "burn") continue;
      if (fx.stack && !consumeValueFuel.has(fx.stack)) continue;
      if (fx.stack && detonatorFold.has(fx.stack)) continue;
      if (fx.stack && multiDetonator && multiDetonator.stacks.includes(fx.stack)) continue;
      add(consumeAmountFx(fx), stackTok(fx.stack));
    } else if (fx.type === "convert_stack" && fx.from) {
      if (brineFold) continue;
      add(consumeAmount(fx.value ?? 0), stackTok(fx.from));
    }
  }
  if (card.spend_armor !== void 0) {
    add(card.spend_armor === "all" ? "all" : String(card.spend_armor), "[armor]");
  }
  return order.map((amount) => loc(
    `Consume ${amount} ${joinTokens(byAmount.get(amount))}`,
    `Consuma ${localizeAmount(amount)} ${joinTokens(byAmount.get(amount))}`
  ));
}
function isPureConsumeStack(fx) {
  if (!(fx.type === "stack" && !!fx.consume_stack && !fx.spread && !fx.condition)) return false;
  if (pyreBurnKeyword && fx.stack === "burn") return true;
  return !!fx.stack && consumeValueFuel.has(fx.stack);
}
function isDevourBookkeeping(fx) {
  return fx.type === "devour";
}
function hasDevourConsumer(effects) {
  return effects.some((fx) => fx.condition?.devour_succeeded === true);
}
function formatCardDescription(card, options) {
  const dyn = options?.dynamic;
  dynamicBuild = !!dyn;
  ACTIVE_LOCALE = options?.locale ?? "en";
  spendingArmor = card.spend_armor !== void 0;
  baseEffectKeys = collectBaseEffectKeys(card.effects);
  const fxs = card.effects ?? [];
  pyreBurnKeyword = fxs.some(
    (fx) => fx.type === "damage" && fx.condition?.enemy_has_stack === "burn" && fx.condition?.per_stack === true
  );
  consumeValueFuel = /* @__PURE__ */ new Set();
  for (const fx of fxs) {
    if (fx.consume_stack_value) consumeValueFuel.add(fx.consume_stack_value);
  }
  consumedValueStacks = /* @__PURE__ */ new Set();
  for (const fx of fxs) {
    const x = fx.consume_stack_value;
    if (!x) continue;
    const snapshotSide = x === "rage" || x.startsWith("hero_") ? "self" : "enemy";
    const consumed = fxs.some((o) => {
      const oSide = o.target === "self" ? "self" : "enemy";
      if (o.type === "stack" && o.consume_stack && o.stack === x) return oSide === snapshotSide;
      if (o.type === "convert_stack" && o.from === x) return oSide === snapshotSide;
      return false;
    });
    if (consumed) consumedValueStacks.add(x);
  }
  const csvDamage = fxs.filter((fx) => fx.type === "damage" && fx.consume_stack_value && consumedValueStacks.has(fx.consume_stack_value));
  multiDetonator = null;
  const detSig = (fx) => `${fx.value}|${fx.pierce_armor ? 1 : 0}|${fx.scale ? `${fx.scale.stat}:${fx.scale.per}:${fx.scale.value}` : ""}`;
  if (csvDamage.length >= 2 && csvDamage.every((fx) => detSig(fx) === detSig(csvDamage[0]))) {
    multiDetonator = { stacks: csvDamage.map((fx) => fx.consume_stack_value), proto: csvDamage[0] };
  }
  detonatorFold = /* @__PURE__ */ new Map();
  const hasFlatDamage = fxs.some((fx) => fx.type === "damage" && !fx.condition && !fx.consume_stack_value && (fx.target === "enemy" || fx.target === "aoe"));
  if (!multiDetonator && hasFlatDamage) {
    for (const fx of csvDamage) {
      const stk = fx.consume_stack_value;
      const consume = fxs.find((o) => o.type === "stack" && o.consume_stack && o.stack === stk && o.value < 0);
      detonatorFold.set(stk, consume ? consumeAmountFx(consume) : "all");
    }
  }
  brineFold = false;
  for (let i = 0; i < fxs.length - 1; i++) {
    const a = fxs[i], b = fxs[i + 1];
    if (a.type === "convert_stack" && consumeAmount(a.value ?? 0) === "all" && a.to && String(a.to) !== "armor" && b.type === "dot" && b.stack === a.to && b.value === (a.factor ?? 1)) {
      brineFold = true;
    }
  }
  let out;
  try {
    out = buildCardDescription(card);
    if (dyn) {
      out = applyDynamicReplacements(out, dyn.stats, dyn.shift);
    } else if (options?.showScalers === false) {
      out = out.replace(SCALER_SUFFIX_RE, "").replace(/ {2,}/g, " ").replace(/ \./g, ".").trim();
    }
  } finally {
    dynamicBuild = false;
    ACTIVE_LOCALE = "en";
    spendingArmor = false;
    baseEffectKeys = /* @__PURE__ */ new Set();
    pyreBurnKeyword = false;
    consumeValueFuel = /* @__PURE__ */ new Set();
    consumedValueStacks = /* @__PURE__ */ new Set();
    detonatorFold = /* @__PURE__ */ new Map();
    multiDetonator = null;
    brineFold = false;
  }
  return out;
}
function renderableDamageKey(fx) {
  if (fx.type !== "damage") return null;
  if (fx.condition || fx.scale || fx.pierce_armor || fx.consume_stack_value || fx.per_hit || fx.multi_hit || fx.overload_lockout_ms) return null;
  if (fx.target !== "enemy") return null;
  return `damage:${fx.value}`;
}
function collapseIdenticalDamage(effects) {
  const out = [];
  for (const fx of effects) {
    const k = renderableDamageKey(fx);
    const last = out[out.length - 1];
    if (k !== null && last && last.__ck === k) {
      last.multi_hit = (last.multi_hit ?? 0) + 1;
      continue;
    }
    if (k !== null) out.push({ ...fx, __ck: k });
    else out.push(fx);
  }
  for (const e of out) delete e.__ck;
  return out;
}
function multiDetonatorClause() {
  const proto = multiDetonator.proto;
  const lead = proto.value === 0 ? proto.scale?.value ?? 1 : proto.value;
  const statS = statScaleInline(proto, proto.value);
  const tokens = multiDetonator.stacks.map((s) => stackTok(s));
  if (proto.pierce_armor) {
    return loc(
      `Consume all ${joinTokens(tokens)} and deal ${lead}${statS} Pierce per stack consumed`,
      `Consuma todo ${joinTokens(tokens)} e cause ${lead}${statS} com Perfura\xE7\xE3o por unidade consumida`
    );
  }
  return loc(
    `Consume all ${joinTokens(tokens)} and deal ${lead}${statS} per stack consumed`,
    `Consuma todo ${joinTokens(tokens)} e cause ${lead}${statS} por unidade consumida`
  );
}
function reorderUniqueGatedBonus(effects) {
  const out = effects.slice();
  for (let i = 0; i < out.length; i++) {
    const fx = out[i];
    const gate = condFromEffect(fx);
    if (!gate || !useRelativePhrasing(fx, gate)) continue;
    const sameGate = out.filter((o) => {
      const g = condFromEffect(o);
      return g !== null && g.key === gate.key;
    });
    if (sameGate.length !== 1) continue;
    const key = effectBaseKey(fx);
    let baseIdx = -1;
    for (let j = 0; j < i; j++) if (!out[j].condition && effectBaseKey(out[j]) === key) baseIdx = j;
    if (baseIdx === -1 || baseIdx === i - 1) continue;
    out.splice(i, 1);
    out.splice(baseIdx + 1, 0, fx);
    i = baseIdx + 1;
  }
  return out;
}
function isStatBuffAura(fx) {
  return fx.type === "aura" && !!fx.modifier && !fx.trigger && !fx.tick_ms && !fx.event_counter && !fx.then && ["str", "vit", "dex", "int", "spi"].includes(fx.modifier.kind);
}
function moveTrailingStatBuffAura(effects) {
  if (!effects.some(isStatBuffAura)) return effects;
  return [...effects.filter((fx) => !isStatBuffAura(fx)), ...effects.filter(isStatBuffAura)];
}
function applyVengeanceDurationExtension(sentences) {
  return sentences.map((s, i) => {
    const m = s.match(/^Vengeance: For (\d+) seconds, (.+)$/);
    if (!m || i === 0) return s;
    const prev = sentences[i - 1].match(/^For \d+ seconds, (.+)$/);
    if (prev && prev[1] === m[2]) return `Vengeance: +${m[1]} seconds`;
    return s;
  });
}
function mergeScaledResourceGains(sentences) {
  const out = [];
  for (const s of sentences) {
    const m = s.match(/^Gain \d+\[(?:stam|mana)\](\(\[[a-z]+\]\))$/);
    const prev = out[out.length - 1];
    if (m && prev) {
      const pm = prev.match(/(\(\[[a-z]+\]\))$/);
      if (/^Gain /.test(prev) && pm && pm[1] === m[1]) {
        out[out.length - 1] = `${prev} and ${s.slice("Gain ".length)}`;
        continue;
      }
    }
    out.push(s);
  }
  return out;
}
function commonClausePrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const p = a.slice(0, i);
  const cut = Math.max(p.lastIndexOf(", "), p.lastIndexOf(": "));
  return cut === -1 ? "" : p.slice(0, cut + 2);
}
function joinTails(prefix, tailA, tailB) {
  const verb = (t) => {
    const m = t.match(/^(gain|apply|deal) /i);
    return m ? m[1].toLowerCase() : null;
  };
  const va = verb(tailA), vb = verb(tailB);
  const simpleA = !tailA.includes(", ") && !tailA.includes("this combat") && !tailA.includes("(max");
  let second;
  if (va && vb && va === vb && simpleA) second = tailB.slice(tailB.indexOf(" ") + 1);
  else second = tailB[0].toLowerCase() + tailB.slice(1);
  return `${prefix}${tailA} and ${second}`;
}
function tryMergeAura(a, b) {
  const auraLike = (s) => s.startsWith("For ") || s.startsWith("Brace: ");
  if (!auraLike(a) || !auraLike(b)) return null;
  if (a.startsWith("For ") !== b.startsWith("For ")) return null;
  const prefix = commonClausePrefix(a, b);
  if (!prefix) return null;
  const tailA = a.slice(prefix.length);
  const tailB = b.slice(prefix.length);
  if (!tailA || !tailB) return null;
  const aGate = tailA.includes(": ");
  const bGate = tailB.includes(": ");
  if (aGate !== bGate) {
    const gated = aGate ? tailA : tailB;
    const plain = aGate ? tailB : tailA;
    const fixed = gated.replace(/: ([A-Z])/, (_m, c) => `, ${c.toLowerCase()}`);
    return `${prefix}${plain} and ${fixed[0].toLowerCase()}${fixed.slice(1)}`;
  }
  return joinTails(prefix, tailA, tailB);
}
function mergeAuraSentences(sentences) {
  const out = [];
  for (const s of sentences) {
    const prev = out[out.length - 1];
    const merged = prev ? tryMergeAura(prev, s) : null;
    if (merged) out[out.length - 1] = merged;
    else out.push(s);
  }
  return out;
}
function aoeScopeOnce(sentences) {
  const SUF = " to all enemies";
  if (sentences.length < 2) return sentences;
  if (!sentences.every((s) => s.endsWith(SUF) && !s.includes(": "))) return sentences;
  const tails = sentences.map((s) => {
    const t = s.slice(0, -SUF.length);
    return t[0].toLowerCase() + t.slice(1);
  });
  return [`To all enemies: ${tails.join(" and ")}`];
}
function buildCardDescription(card) {
  let effects = collapseIdenticalDamage(card.effects ?? []);
  if (!effects.length) return "";
  effects = reorderUniqueGatedBonus(effects);
  effects = moveTrailingStatBuffAura(effects);
  const frags = [];
  const devourGated = hasDevourConsumer(effects);
  let multiDetonatorEmitted = false;
  let prevWasBrineConvert = false;
  for (const fx of effects) {
    if (isPureConsumeStack(fx)) continue;
    if (devourGated && isDevourBookkeeping(fx)) continue;
    if (multiDetonator && fx.type === "damage" && fx.consume_stack_value && multiDetonator.stacks.includes(fx.consume_stack_value)) {
      if (!multiDetonatorEmitted) {
        multiDetonatorEmitted = true;
        frags.push({ gateKey: null, gatePrefix: null, body: multiDetonatorClause() });
      }
      continue;
    }
    if (brineFold && prevWasBrineConvert && fx.type === "dot") {
      const applyRe = ACTIVE_LOCALE === "pt-br" ? /^Aplique / : /^Apply /;
      const body = fragmentForEffect(fx).body.replace(applyRe, "");
      if (frags.length) frags[frags.length - 1].body += loc(`, plus ${body}`, `, mais ${body}`);
      prevWasBrineConvert = false;
      continue;
    }
    prevWasBrineConvert = false;
    const f = fragmentForEffect(fx);
    if (!f.body) continue;
    frags.push(f);
    if (brineFold && fx.type === "convert_stack") prevWasBrineConvert = true;
  }
  const sentences = [];
  let pending = null;
  const flush = () => {
    if (!pending) return;
    const { gatePrefix, bodies } = pending;
    if (gatePrefix) {
      sentences.push(`${gatePrefix}: ${joinBodies(bodies)}`);
    } else {
      for (const b of bodies) sentences.push(b);
    }
    pending = null;
  };
  for (const f of frags) {
    if (!pending) {
      pending = { gatePrefix: f.gatePrefix, bodies: [f.body] };
      continue;
    }
    if (pending.gatePrefix === f.gatePrefix) {
      pending.bodies.push(f.body);
    } else {
      flush();
      pending = { gatePrefix: f.gatePrefix, bodies: [f.body] };
    }
  }
  flush();
  const en = ACTIVE_LOCALE === "en";
  let finalSentences = en ? applyVengeanceDurationExtension(sentences) : sentences;
  finalSentences = en ? mergeScaledResourceGains(finalSentences) : finalSentences;
  finalSentences = en ? mergeAuraSentences(finalSentences) : finalSentences;
  finalSentences = en ? aoeScopeOnce(finalSentences) : finalSentences;
  const leading = [];
  if (card.exhaust) leading.push(loc("Exhaust", "Esgotar"));
  leading.push(...buildConsumeClauses(card));
  const capFirst = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const parts = [...leading, ...finalSentences].filter(Boolean).map(capFirst);
  if (!parts.length) return "";
  return parts.join(". ") + ".";
}
function joinBodies(bodies) {
  if (bodies.length === 0) return "";
  if (bodies.length === 1) return bodies[0];
  const head = bodies[0];
  const tail = bodies.slice(1).map((b) => b.length === 0 ? b : b[0].toLowerCase() + b.slice(1));
  return [head, ...tail].join(loc(" and ", " e "));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  formatCardDescription,
  formatEffect
});
