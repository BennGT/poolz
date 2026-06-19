"use strict";

const defaultProfileKey = "my-pool";
const poolDefaults = {
  [defaultProfileKey]: {
    name: "My Pool",
    volume: 50000,
    sanitizer: "chlorine",
    surface: "fibreglass",
    allowCya: true
  }
};

const storageKey = "poolz-calculator-v1";
const historyKey = "poolz-history-v1";

const valueIds = [
  "poolVolume",
  "freeChlorine",
  "totalChlorine",
  "bromine",
  "ph",
  "alkalinity",
  "calcium",
  "cya",
  "salt",
  "waterTemperature",
  "targetChlorine",
  "targetCombined",
  "targetBromine",
  "targetPh",
  "targetAlkalinity",
  "targetCalcium",
  "targetCya",
  "targetSalt",
  "liquidChlorineName",
  "liquidChlorineStrength",
  "granularChlorineName",
  "granularChlorineStrength",
  "acidName",
  "muriaticStrength",
  "dryAcidName",
  "phUpName",
  "bromineName",
  "bromineStrength",
  "calciumName",
  "calciumPurity",
  "stabilizerName",
  "stabilizerPurity",
  "saltName"
];

const readingIds = [
  "freeChlorine",
  "totalChlorine",
  "combinedChlorine",
  "bromine",
  "ph",
  "alkalinity",
  "calcium",
  "cya",
  "salt",
  "waterTemperature"
];

const targetIds = [
  "targetChlorine",
  "targetCombined",
  "targetBromine",
  "targetPh",
  "targetAlkalinity",
  "targetCalcium",
  "targetCya",
  "targetSalt"
];

const targetFieldMap = {
  targetChlorine: "chlorine",
  targetCombined: "combined",
  targetBromine: "bromine",
  targetPh: "ph",
  targetAlkalinity: "alkalinity",
  targetCalcium: "calcium",
  targetCya: "cya",
  targetSalt: "salt"
};

const surfaceTargetDefaults = {
  concrete: {
    ph: 7.5,
    alkalinity: 100,
    calcium: 300
  },
  fibreglass: {
    ph: 7.4,
    alkalinity: 90,
    calcium: 200
  },
  vinyl: {
    ph: 7.4,
    alkalinity: 90,
    calcium: 175
  }
};

const savedValueIds = valueIds.filter((id) => !readingIds.includes(id) && !targetIds.includes(id));

let profileSettings = makeDefaultProfileSettings();
let lastPoolKey = defaultProfileKey;
let drawerTouchStartX = null;
let deferredInstallPrompt = null;
let lastCards = [];
let resultsVisible = false;
let historyEntries = [];

const $ = (id) => document.getElementById(id);
const all = (selector) => Array.from(document.querySelectorAll(selector));

function makeDefaultProfileSettings() {
  return Object.fromEntries(
    Object.entries(poolDefaults).map(([key, profile]) => [
      key,
      {
        name: profile.name,
        sanitizer: profile.sanitizer,
        surface: profile.surface,
        volume: profile.volume,
        allowCya: profile.allowCya,
        targets: defaultTargetsFor(profile.surface, profile.sanitizer, profile.allowCya)
      }
    ])
  );
}

function profileCount() {
  return Object.keys(profileSettings).length;
}

function renderProfileOptions(selectedKey = currentPoolKey()) {
  const select = $("poolProfile");
  if (!select) return;

  select.replaceChildren();
  Object.entries(profileSettings).forEach(([key, profile]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = profile.name || "My Pool";
    select.append(option);
  });

  if (profileSettings[selectedKey]) {
    setValue("poolProfile", selectedKey);
  } else {
    setValue("poolProfile", Object.keys(profileSettings)[0] || defaultProfileKey);
  }

  if ($("deleteProfile")) $("deleteProfile").disabled = profileCount() <= 1;
}

function selected(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function setRadio(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function normalizedSurface(value) {
  return value === "plaster" || value === "render" ? "concrete" : value;
}

function numberValue(id) {
  const value = parseFloat($(id).value);
  return Number.isFinite(value) ? value : null;
}

function decimalPlacesFromText(text) {
  const match = String(text).trim().match(/^-?\d+(?:\.(\d+))?$/);
  return match ? (match[1] || "").length : 0;
}

function scaledDecimalFromText(text, places) {
  const trimmed = String(text).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;

  const sign = trimmed.startsWith("-") ? -1 : 1;
  const unsigned = trimmed.replace(/^-/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  const scale = 10 ** places;
  const scaledFraction = (fraction + "0".repeat(places)).slice(0, places);
  return sign * ((Number(whole) * scale) + Number(scaledFraction || 0));
}

function subtractDecimalInputs(leftId, rightId) {
  const left = $(leftId).value;
  const right = $(rightId).value;
  const places = Math.min(
    Math.max(decimalPlacesFromText(left), decimalPlacesFromText(right), 2),
    6
  );
  const scale = 10 ** places;
  const leftScaled = scaledDecimalFromText(left, places);
  const rightScaled = scaledDecimalFromText(right, places);

  if (leftScaled === null || rightScaled === null) return null;
  return (leftScaled - rightScaled) / scale;
}

function positiveNumber(id, fallback) {
  const value = numberValue(id);
  return value !== null && value > 0 ? value : fallback;
}

function setValue(id, value) {
  $(id).value = value === null || value === undefined ? "" : String(value);
}

function chemicalName(id, fallback) {
  const input = $(id);
  const value = input ? input.value.trim() : "";
  return value || fallback;
}

function currentPoolKey() {
  return $("poolProfile") ? $("poolProfile").value : defaultProfileKey;
}

function currentPool() {
  return profileSettings[currentPoolKey()]
    || profileSettings[defaultProfileKey]
    || poolDefaults[defaultProfileKey];
}

function currentPoolVolumeLitres(key = currentPoolKey()) {
  const profile = profileSettings[key] || poolDefaults[defaultProfileKey];
  const volume = Number(profile.volume);
  return Number.isFinite(volume) && volume > 0 ? volume : null;
}

function activePoolAllowsCya() {
  return Boolean(currentPool().allowCya && selected("sanitizer") !== "bromine");
}

function isSaltPool() {
  return selected("sanitizer") === "salt";
}

function usesSaltReading() {
  const sanitizer = selected("sanitizer");
  return sanitizer === "salt" || sanitizer === "mineral";
}

function currentUnitSystem() {
  return selected("unitSystem");
}

function concentrationUnitLabel() {
  return selected("concentrationUnit") === "mgL" ? "mg/L" : "ppm";
}

function concentrationUnitSuffix() {
  return ` ${concentrationUnitLabel()}`;
}

function syncConcentrationUnitControls() {
  if (document.querySelector('input[name="targetConcentrationUnit"]')) {
    setRadio("targetConcentrationUnit", selected("concentrationUnit"));
  }
}

function litresToGallons(litres) {
  return litres / 3.785411784;
}

function gallonsToLitres(gallons) {
  return gallons * 3.785411784;
}

function selectedVolumeUnitLabel() {
  return currentUnitSystem() === "gallons" ? "gal" : "L";
}

function selectedVolumeExample() {
  return currentUnitSystem() === "gallons" ? "eg: 13,200 gal" : "eg: 50,000 L";
}

function litresToSelectedVolume(litres) {
  return currentUnitSystem() === "gallons" ? litresToGallons(litres) : litres;
}

function poolVolumeInputToLitres() {
  const value = numberValue("poolVolume");
  if (value === null || value <= 0) return null;
  return currentUnitSystem() === "gallons" ? gallonsToLitres(value) : value;
}

function updatePoolVolumeExample() {
  if ($("poolVolume")) $("poolVolume").placeholder = selectedVolumeExample();
  if ($("poolVolumeHint")) $("poolVolumeHint").textContent = "Not sure your pool size? Use the volume calculator below.";
}

function formatPoolVolume(litres) {
  if (!Number.isFinite(litres) || litres <= 0) return "";

  if (currentUnitSystem() === "gallons") {
    return `${formatNumber(litresToGallons(litres), 0)} gal`;
  }

  return `${formatNumber(litres, 0)} L`;
}

function formatCalculatedVolume(litres) {
  if (selected("dimensionUnit") === "feet") {
    return `${formatNumber(litresToGallons(litres), 0)} gal`;
  }

  return `${formatNumber(litres, 0)} L`;
}

function dimensionUnitLabel() {
  return selected("dimensionUnit") === "feet" ? "ft" : "m";
}

function dimensionToMetres(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return selected("dimensionUnit") === "feet" ? value * 0.3048 : value;
}

function calculatedVolumeLitres() {
  const length = dimensionToMetres(numberValue("volumeLength"));
  const width = dimensionToMetres(numberValue("volumeWidth"));
  const shallow = dimensionToMetres(numberValue("volumeShallowDepth"));
  const deep = dimensionToMetres(numberValue("volumeDeepDepth"));
  const averageDepth = shallow && deep ? (shallow + deep) / 2 : shallow || deep;

  if (!length || !width || !averageDepth) return null;

  return length * width * averageDepth * 1000;
}

function updateVolumeCalculator() {
  if (!$("volumeCalcResult")) return;

  const volume = calculatedVolumeLitres();
  const result = $("volumeCalcResult");
  const formula = $("volumeCalcFormula");
  const useButton = $("useCalculatedVolume");

  if (!volume) {
    result.textContent = "";
    formula.textContent = "";
    useButton.disabled = true;
    return;
  }

  result.textContent = formatCalculatedVolume(volume);
  formula.textContent = selected("dimensionUnit") === "feet"
    ? "Calculated from length x width x average depth in feet."
    : "Calculated from length x width x average depth in metres.";
  useButton.disabled = false;
}

function useCalculatedVolume() {
  const volume = calculatedVolumeLitres();
  if (!volume) return;

  const key = currentPoolKey();
  savePoolSettings(key);
  profileSettings[key] = {
    ...(profileSettings[key] || {}),
    sanitizer: selected("sanitizer"),
    surface: normalizedSurface($("surfaceType").value),
    volume
  };
  setValue("poolVolume", Math.round(volume));
  renderProfileOptions(key);
  applyPoolProfile(key);
  saveState();
  calculate();
  showPage("pools");
}

function syncCombinedChlorine() {
  if (selected("sanitizer") === "bromine") {
    return null;
  }

  const free = numberValue("freeChlorine");
  const total = numberValue("totalChlorine");

  if (free !== null && total !== null) {
    const rawCombined = subtractDecimalInputs("totalChlorine", "freeChlorine");
    if (rawCombined === null) return null;
    const combined = Math.max(rawCombined, 0);
    const combinedDisplay = formatTruncatedDecimal(combined, 2);
    setValue("combinedChlorine", combinedDisplay);
    return combined;
  }

  if (free !== null || total !== null) {
    setValue("combinedChlorine", "");
    return null;
  }

  setValue("combinedChlorine", "");
  return null;
}

function clearReadings() {
  readingIds.forEach((id) => setValue(id, ""));
  setValue("combinedChlorine", "");
}

function poolVolumeLitres() {
  return poolVolumeInputToLitres();
}

function formatNumber(value, maxDigits = 1) {
  return new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: 0
  }).format(value);
}

function truncateToDecimals(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.trunc((value + Number.EPSILON) * factor) / factor;
}

function formatTruncatedDecimal(value, decimals = 1) {
  return new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  }).format(truncateToDecimals(value, decimals));
}

function formatDoseNumber(value) {
  return new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  }).format(truncateToDecimals(value, 1));
}

function formatMass(grams) {
  if (!Number.isFinite(grams) || grams <= 0) return "0.0 g";
  if (grams >= 1000) return `${formatDoseNumber(grams / 1000)} kg`;
  return `${formatDoseNumber(grams)} g`;
}

function formatVolume(ml) {
  if (!Number.isFinite(ml) || ml <= 0) return "0.0 mL";
  if (ml >= 1000) return `${formatDoseNumber(ml / 1000)} L`;
  return `${formatDoseNumber(ml)} mL`;
}

function formatLitres(litres) {
  if (!Number.isFinite(litres) || litres <= 0) return "0.0 L";
  return `${formatDoseNumber(litres)} L`;
}

function ppmDose(volumeLitres, ppmDelta, productPercent) {
  if (ppmDelta <= 0 || productPercent <= 0) return 0;
  return (ppmDelta * volumeLitres) / (10 * productPercent);
}

function dryAcidForPh(volumeLitres, phDrop, alkalinity) {
  const alkFactor = clamp((alkalinity || 90) / 90, 0.75, 1.6);
  return 30 * (volumeLitres / 10000) * (phDrop / 0.1) * alkFactor;
}

function hydrochloricForPh(volumeLitres, phDrop, alkalinity, strength) {
  const alkFactor = clamp((alkalinity || 90) / 90, 0.75, 1.6);
  const standardStrength = 31.45;
  return 473 * (volumeLitres / 37854) * (phDrop / 0.2) * alkFactor * (standardStrength / strength);
}

function bicarbForAlkalinity(volumeLitres, ppmDelta) {
  return ppmDelta * volumeLitres * 0.00168;
}

function acidForAlkalinity(volumeLitres, ppmDelta, strength) {
  const standardStrength = 31.45;
  return 946 * (volumeLitres / 37854) * (ppmDelta / 10) * (standardStrength / strength);
}

function dryAcidForAlkalinity(volumeLitres, ppmDelta) {
  return 1134 * (volumeLitres / 37854) * (ppmDelta / 10);
}

function calciumChlorideForHardness(volumeLitres, ppmDelta, purity) {
  return (ppmDelta * volumeLitres * 0.001108) / (purity / 100);
}

function stabilizerDose(volumeLitres, ppmDelta, purity) {
  return (ppmDelta * volumeLitres * 0.001) / (purity / 100);
}

function replacementFraction(current, target) {
  if (!current || current <= target) return 0;
  return clamp(1 - target / current, 0, 0.95);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function defaultTargetsFor(surface, sanitizer, cyaAllowed) {
  const surfaceDefaults = surfaceTargetDefaults[normalizedSurface(surface)] || surfaceTargetDefaults.fibreglass;

  if (sanitizer === "bromine") {
    return {
      chlorine: 1.5,
      combined: 1,
      bromine: 4,
      ph: Math.max(surfaceDefaults.ph, 7.6),
      alkalinity: surfaceDefaults.alkalinity,
      calcium: surfaceDefaults.calcium,
      cya: 0,
      salt: 0
    };
  }

  return {
    chlorine: sanitizer === "salt" || sanitizer === "mineral" || cyaAllowed ? 2 : 1.5,
    combined: 1,
    bromine: 4,
    ph: surfaceDefaults.ph,
    alkalinity: surfaceDefaults.alkalinity,
    calcium: surfaceDefaults.calcium,
    cya: cyaAllowed ? 30 : 0,
    salt: sanitizer === "salt" || sanitizer === "mineral" ? 4000 : 0
  };
}

function currentDefaultTargets() {
  const sanitizer = selected("sanitizer");
  const surface = normalizedSurface($("surfaceType").value);
  return defaultTargetsFor(surface, sanitizer, activePoolAllowsCya());
}

function targetsFromInputs() {
  const defaults = currentDefaultTargets();
  return Object.fromEntries(
    Object.entries(targetFieldMap).map(([inputId, key]) => {
      const value = numberValue(inputId);
      return [key, value === null ? defaults[key] : value];
    })
  );
}

function normalizeTargets(targets) {
  const defaults = currentDefaultTargets();
  return {
    ...defaults,
    ...(targets || {})
  };
}

function setTargetInputs(targets) {
  const values = normalizeTargets(targets);
  setValue("targetChlorine", values.chlorine);
  setValue("targetCombined", values.combined);
  setValue("targetBromine", values.bromine);
  setValue("targetPh", values.ph);
  setValue("targetAlkalinity", values.alkalinity);
  setValue("targetCalcium", values.calcium);
  setValue("targetCya", values.cya);
  setValue("targetSalt", values.salt);
}

function setTargetsFromProfile() {
  setTargetInputs(currentDefaultTargets());
  updateVisibility();
  saveState();
  calculate();
}

function savePoolSettings(key = currentPoolKey()) {
  const existing = profileSettings[key] || {};
  const surface = normalizedSurface($("surfaceType").value);
  const name = $("profileName").value.trim() || existing.name || "My Pool";
  const volume = poolVolumeInputToLitres();
  profileSettings[key] = {
    ...existing,
    name,
    sanitizer: selected("sanitizer"),
    surface,
    volume,
    allowCya: true,
    targets: targetsFromInputs()
  };
}

function applyPoolProfile(key = currentPoolKey()) {
  const settings = profileSettings[key] || poolDefaults[defaultProfileKey];
  const volume = currentPoolVolumeLitres(key);
  setValue("poolVolume", volume ? Math.round(litresToSelectedVolume(volume)) : "");
  updatePoolVolumeExample();
  if ($("poolVolumeDisplay")) $("poolVolumeDisplay").textContent = formatPoolVolume(volume);
  setValue("profileName", settings.name || "My Pool");
  if ($("activePoolName")) $("activePoolName").textContent = settings.name || "My Pool";
  const surface = normalizedSurface(settings.surface) || poolDefaults[defaultProfileKey].surface;
  setValue("surfaceType", surface);
  setRadio("sanitizer", settings.sanitizer || "chlorine");
  setTargetInputs(settings.targets || currentDefaultTargets());
  lastPoolKey = key;
  updateVisibility();
  calculate();
}

function updateVisibility() {
  const sanitizer = selected("sanitizer");
  const isBromine = sanitizer === "bromine";
  const isFull = true;
  const isSalt = usesSaltReading();
  const cyaAllowed = activePoolAllowsCya();

  all(".chlorine-field").forEach((node) => node.classList.toggle("is-hidden", isBromine));
  all(".bromine-field").forEach((node) => node.classList.toggle("is-hidden", !isBromine));
  all(".target-chlorine").forEach((node) => node.classList.toggle("is-hidden", isBromine));
  all(".target-combined").forEach((node) => node.classList.toggle("is-hidden", isBromine));
  all(".target-bromine").forEach((node) => node.classList.toggle("is-hidden", !isBromine));
  all(".full-test").forEach((node) => node.classList.toggle("is-hidden", !isFull));
  all(".cya-field").forEach((node) => node.classList.toggle("is-hidden", !isFull || !cyaAllowed));
  all(".target-cya").forEach((node) => node.classList.toggle("is-hidden", !cyaAllowed));
  all(".salt-field").forEach((node) => node.classList.toggle("is-hidden", !isFull || !isSalt));
  all(".target-salt").forEach((node) => node.classList.toggle("is-hidden", !isSalt));

  if ($("poolVolumeDisplay")) $("poolVolumeDisplay").textContent = formatPoolVolume(currentPoolVolumeLitres());
}

function saveState() {
  savePoolSettings();
  const state = {
    activePool: currentPoolKey(),
    testSet: "full",
    unitSystem: currentUnitSystem(),
    concentrationUnit: selected("concentrationUnit"),
    profiles: profileSettings,
    values: {}
  };

  savedValueIds.forEach((id) => {
    if ($(id)) state.values[id] = $(id).value;
  });

  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(storageKey);

  if (!raw) {
    profileSettings = makeDefaultProfileSettings();
    renderProfileOptions(defaultProfileKey);
    applyPoolProfile(defaultProfileKey);
    calculate();
    return;
  }

  try {
    const state = JSON.parse(raw);
    profileSettings = {
      ...makeDefaultProfileSettings(),
      ...(state.profiles || state.profileSettings || {})
    };

    const activePool = profileSettings[state.activePool] ? state.activePool : Object.keys(profileSettings)[0] || defaultProfileKey;
    renderProfileOptions(activePool);
    setValue("poolProfile", activePool);
    setRadio("testSet", "full");
    if (state.unitSystem) setRadio("unitSystem", state.unitSystem);
    if (state.concentrationUnit) setRadio("concentrationUnit", state.concentrationUnit);
    syncConcentrationUnitControls();
    applyPoolProfile(currentPoolKey());

    Object.entries(state.values || {}).forEach(([id, value]) => {
      if (!$(id)) return;
      if (id === "poolVolume") return;
      if (id === "combinedChlorine") return;
      if (readingIds.includes(id)) return;
      setValue(id, value);
    });
  } catch {
    localStorage.removeItem(storageKey);
    profileSettings = makeDefaultProfileSettings();
    renderProfileOptions(defaultProfileKey);
    setValue("poolProfile", defaultProfileKey);
    applyPoolProfile(defaultProfileKey);
  }

  updateVisibility();
  calculate();
}

function hasAnyReading() {
  return readingIds.some((id) => numberValue(id) !== null);
}

function calculate({ showResults = false } = {}) {
  updateVisibility();
  syncCombinedChlorine();

  const volume = poolVolumeLitres();

  if (!volume || volume <= 0 || !hasAnyReading()) {
    lastCards = [];
    resultsVisible = false;
    renderPendingResults("Enter readings and press Calculate.");
    saveState();
    return [];
  }

  const cards = [];
  const sanitizer = selected("sanitizer");
  const alkalinity = numberValue("alkalinity");
  const liquidStrength = positiveNumber("liquidChlorineStrength", 12.5);
  const granularStrength = positiveNumber("granularChlorineStrength", 65);
  const hydrochloricStrength = positiveNumber("muriaticStrength", 31.45);

  if (sanitizer === "bromine") {
    calculateBromine(cards, volume);
  } else {
    calculateChlorine(cards, volume, liquidStrength, granularStrength);
  }

  calculatePh(cards, volume, alkalinity, hydrochloricStrength);

  calculateAlkalinity(cards, volume, hydrochloricStrength);
  calculateCalcium(cards, volume);
  calculateCya(cards, volume, sanitizer);
  calculateSalt(cards, volume, sanitizer);

  if (cards.length === 0 && hasAnyReading()) {
    cards.push({
      title: "No dose needed",
      badge: "ok",
      amount: "Balanced",
      chemical: "for the saved targets",
      body: "Keep circulating and retest on the normal schedule.",
      effect: "No chemical change is recommended from the readings entered."
    });
  }

  lastCards = cards;
  if (showResults) {
    resultsVisible = true;
    renderCards(cards);
  } else {
    resultsVisible = false;
    renderPendingResults("Readings updated. Press Calculate to show dosing.");
  }
  saveState();
  return cards;
}

function calculateChlorine(cards, volume, liquidStrength, granularStrength) {
  const free = numberValue("freeChlorine");
  const total = numberValue("totalChlorine");
  const combined = syncCombinedChlorine();
  const combinedLevel = combined === null ? null : truncateToDecimals(combined, 2);
  const defaults = currentDefaultTargets();
  const target = positiveNumber("targetChlorine", defaults.chlorine);
  const combinedAction = positiveNumber("targetCombined", defaults.combined);
  const unit = concentrationUnitSuffix();
  const liquidName = chemicalName("liquidChlorineName", "liquid chlorine");
  const granularName = chemicalName("granularChlorineName", "granular chlorine");

  if (free !== null) {
    if (free < target - 0.1) {
      const delta = target - free;
      const liquidMl = ppmDose(volume, delta, liquidStrength);
      const granularGrams = ppmDose(volume, delta, granularStrength);
      cards.push({
        title: "Raise free chlorine",
        badge: "dose",
        amount: formatVolume(liquidMl),
        chemical: `${formatNumber(liquidStrength, 1)}% ${liquidName}`,
        body: `Raises free chlorine by about ${formatNumber(delta, 1)}${unit} to ${formatNumber(target, 1)}${unit}.`,
        effect: "Raises the active sanitiser residual. Liquid chlorine can also slowly add salt and nudge pH upward.",
        steps: [
          `Add ${formatVolume(liquidMl)} ${liquidName} with the pump running.`,
          "Circulate, then retest free and total chlorine.",
          "Low chlorine is usually from bather load, sunlight, or organic demand."
        ],
        alt: [`Alternative: ${formatMass(granularGrams)} of ${formatNumber(granularStrength, 1)}% ${granularName}.`]
      });
    } else if (free > target + 1.5) {
      cards.push({
        title: "Free chlorine is high",
        badge: "watch",
        amount: "Hold",
        chemical: "chlorine dosing",
        body: `Current free chlorine is ${formatNumber(free, 1)}${unit}. Let it drift down toward ${formatNumber(target, 1)}${unit} before adding more.`,
        effect: "Holding chlorine dosing lets the sanitiser residual reduce through normal demand, sunlight and circulation.",
        steps: [
          "Do not add more chlorine now.",
          "Reduce manual dosing or chlorinator output and keep circulating.",
          "High chlorine is usually from recent dosing, high output, or low demand."
        ]
      });
    }
  }

  if (total !== null && total > 10) {
    cards.push({
      title: "Total chlorine is high",
      badge: "stop",
      amount: "Hold",
      chemical: "chlorine dosing",
      body: `Current total chlorine is ${formatNumber(total, 1)}${unit}. Avoid more chlorine until it drops.`,
      effect: "Do not add more chlorinating product while total chlorine is above the operating limit.",
      steps: [
        "Stop chlorine additions and keep the water circulating.",
        "Retest before reopening or adding more sanitiser.",
        "High total chlorine usually follows heavy dosing or poor chlorine burn-off."
      ]
    });
  }

  if (combinedLevel !== null && combinedLevel > combinedAction) {
    const breakpointTarget = combinedLevel * 10;
    const currentFree = free === null ? 0 : free;
    const breakpointDelta = Math.max(breakpointTarget - currentFree, 0);
    const liquidMl = ppmDose(volume, breakpointDelta, liquidStrength);
    const granularGrams = ppmDose(volume, breakpointDelta, granularStrength);
    const liquidDose = formatVolume(liquidMl);
    const granularDose = formatMass(granularGrams);
    cards.push({
      title: "Combined chlorine over limit",
      badge: "stop",
      amount: breakpointDelta > 0 ? liquidDose : "Retest",
      chemical: breakpointDelta > 0 ? `${formatNumber(liquidStrength, 1)}% ${liquidName}` : "combined chlorine",
      body: `Combined chlorine is ${formatTruncatedDecimal(combinedLevel, 2)}${unit}. Breakpoint target is about ${formatTruncatedDecimal(breakpointTarget, 2)}${unit} free chlorine.`,
      effect: "Combined chlorine is used-up chlorine. It is usually high after bather load, organics, low oxidation, or poor indoor ventilation.",
      steps: breakpointDelta > 0
        ? [
            `Add ${liquidDose} ${liquidName} with the pump running.`,
            "Keep bathers out, circulate and ventilate, then retest free, total and combined chlorine.",
            `Goal: combined chlorine back under ${formatTruncatedDecimal(combinedAction, 2)}${unit}.`
          ]
        : [
            "Free chlorine is already near the breakpoint level.",
            "Keep bathers out, circulate and ventilate, then retest free, total and combined chlorine.",
            `Goal: combined chlorine back under ${formatTruncatedDecimal(combinedAction, 2)}${unit}.`
          ],
      alt: breakpointDelta > 0
        ? [`${granularName} option: ${granularDose} of ${formatNumber(granularStrength, 1)}% ${granularName}.`]
        : []
    });
  } else if (combinedLevel !== null) {
    cards.push({
      title: "Combined chlorine pass",
      badge: "ok",
      amount: `${formatTruncatedDecimal(combinedLevel, 2)}${unit}`,
      chemical: "combined chlorine",
      body: `Combined chlorine is at or under the ${formatTruncatedDecimal(combinedAction, 2)}${unit} action level.`,
      effect: "Pass for the entered free and total chlorine readings."
    });
  }
}

function calculateBromine(cards, volume) {
  const bromine = numberValue("bromine");
  const defaults = currentDefaultTargets();
  const target = positiveNumber("targetBromine", defaults.bromine);
  const strength = positiveNumber("bromineStrength", 61);
  const unit = concentrationUnitSuffix();
  const bromineName = chemicalName("bromineName", "bromine granules");

  if (bromine === null) return;

  if (bromine < target - 0.1) {
    const delta = target - bromine;
    const grams = ppmDose(volume, delta, strength);
    cards.push({
      title: "Raise bromine",
      badge: "dose",
      amount: formatMass(grams),
      chemical: `${formatNumber(strength, 1)}% ${bromineName}`,
      body: `Raises total bromine by about ${formatNumber(delta, 1)}${unit} to ${formatNumber(target, 1)}${unit}.`,
      effect: "Raises the bromine sanitiser residual so the water can keep disinfecting between bather loads.",
      steps: [
        `Add ${formatMass(grams)} ${bromineName} with the pump running.`,
        "Circulate, then retest bromine.",
        "Low bromine is usually from bather load, organic demand, or feeder output set too low."
      ]
    });
  } else if (bromine > target + 2) {
    cards.push({
      title: "Bromine is high",
      badge: "watch",
      amount: "Hold",
      chemical: "bromine dosing",
      body: `Current bromine is ${formatNumber(bromine, 1)}${unit}. Let it drift down toward ${formatNumber(target, 1)}${unit}.`,
      effect: "Holding bromine dosing lets the residual reduce through normal demand and dilution.",
      steps: [
        "Do not add more bromine now.",
        "Reduce feeder output and keep circulating.",
        "High bromine is usually from recent dosing, high feeder output, or low demand."
      ]
    });
  }
}

function calculatePh(cards, volume, alkalinity, hydrochloricStrength) {
  const ph = numberValue("ph");
  const defaults = currentDefaultTargets();
  const target = positiveNumber("targetPh", defaults.ph);
  const alkalinityTarget = positiveNumber("targetAlkalinity", defaults.alkalinity);
  const acidName = chemicalName("acidName", "hydrochloric acid");
  const dryAcidName = chemicalName("dryAcidName", "dry acid");

  if (ph === null) return;

  if (ph > target + 0.05) {
    const drop = ph - target;
    const dryAcid = dryAcidForPh(volume, drop, alkalinity);
    const hydrochloric = hydrochloricForPh(volume, drop, alkalinity, hydrochloricStrength);
    const splitNote = drop > 0.4 ? " Split the dose and retest between additions." : "";
    cards.push({
      title: "Lower pH",
      badge: "dose",
      amount: formatVolume(hydrochloric),
      chemical: `${formatNumber(hydrochloricStrength, 1)}% ${acidName}`,
      body: `Estimated drop from pH ${formatNumber(ph, 1)} to ${formatNumber(target, 1)}.${splitNote}`,
      effect: "Lowers pH and also lowers total alkalinity a little.",
      steps: [
        `Add ${formatVolume(hydrochloric)} ${acidName} carefully with the pump running.`,
        "Circulate and retest pH before adding more acid.",
        "If alkalinity is already low, use smaller staged acid doses because acid will lower it further.",
        "High pH is often from aeration, liquid chlorine, or high alkalinity."
      ],
      alt: [`${dryAcidName} option: ${formatMass(dryAcid)}.`]
    });
  } else if (ph < target - 0.05) {
    const alkalinityIsLow = alkalinity !== null && alkalinity < alkalinityTarget - 5;
    const alkalinityIsHigh = alkalinity !== null && alkalinity > alkalinityTarget + 15;

    if (alkalinityIsLow) {
      cards.push({
        title: "pH is low",
        badge: "watch",
        amount: "Fix alkalinity first",
        chemical: "then retest pH",
        body: `pH is ${formatNumber(ph, 1)} and alkalinity is also low. Raise alkalinity first, because that can gently lift pH too.`,
        effect: "Alkalinity buffers pH. Sodium bicarbonate mainly raises alkalinity and only nudges pH, so retesting avoids double dosing.",
        steps: [
          "Follow the alkalinity card first.",
          "Circulate, then retest pH and alkalinity.",
          "If pH is still low after alkalinity is back in range, aerate first or use a pH increaser in small label-dose stages."
        ]
      });
      return;
    }

    if (alkalinityIsHigh) {
      cards.push({
        title: "pH is low",
        badge: "watch",
        amount: "Aerate",
        chemical: "while lowering alkalinity",
        body: `pH is ${formatNumber(ph, 1)} but alkalinity is high. Avoid pH-up or buffer products for now.`,
        effect: "The alkalinity process uses acid to reduce buffering, then aeration raises pH without adding alkalinity back.",
        steps: [
          "Follow the lower alkalinity card in small stages.",
          "Aerate strongly between acid stages to bring pH back up.",
          "Retest pH and alkalinity before adding any pH increaser."
        ]
      });
      return;
    }

    cards.push({
      title: "Raise pH",
      badge: "watch",
      amount: "Aerate first",
      chemical: "pH increaser if needed",
      body: `pH is ${formatNumber(ph, 1)}. Raise it toward ${formatNumber(target, 1)} without chasing alkalinity at the same time.`,
      effect: "Aeration raises pH without adding chemicals. pH increaser/soda ash raises pH faster but can also raise alkalinity.",
      steps: [
        "Point returns upward, run water features, or increase aeration with the pump running.",
        "Retest pH before adding a chemical pH increaser.",
        "Avoid using sodium bicarbonate for pH-only correction unless alkalinity is also low.",
        "Low pH is often from acid overdose, rain/dilution, or low alkalinity."
      ]
    });
  }
}

function calculateAlkalinity(cards, volume, hydrochloricStrength) {
  const current = numberValue("alkalinity");
  const defaults = currentDefaultTargets();
  const target = positiveNumber("targetAlkalinity", defaults.alkalinity);
  const ph = numberValue("ph");
  const phTarget = positiveNumber("targetPh", defaults.ph);
  const unit = concentrationUnitSuffix();
  const acidName = chemicalName("acidName", "hydrochloric acid");
  const dryAcidName = chemicalName("dryAcidName", "dry acid");
  const alkalinityName = chemicalName("phUpName", "sodium bicarbonate");

  if (current === null) return;

  if (current < target - 5) {
    const delta = target - current;
    const phNote = ph !== null && ph < phTarget - 0.05
      ? " pH is also low, so retest pH after this before adding any pH increaser."
      : "";
    if (ph !== null && ph > phTarget + 0.05) {
      cards.push({
        title: "Alkalinity is low",
        badge: "watch",
        amount: "Stage corrections",
        chemical: "do not add buffer yet",
        body: `Alkalinity is ${formatNumber(current, 0)}${unit}, but pH is high. Lower pH carefully first, then retest before raising alkalinity.`,
        effect: "Bicarbonate raises alkalinity but can push pH upward, so adding it while pH is already high can make the pH problem worse.",
        steps: [
          "Use the pH card first and keep the acid dose staged.",
          "Circulate and retest pH and alkalinity.",
          "Only add alkalinity increaser after pH is back near target."
        ]
      });
      return;
    }
    cards.push({
      title: "Raise alkalinity",
      badge: "dose",
      amount: formatMass(bicarbForAlkalinity(volume, delta)),
      chemical: alkalinityName,
      body: `Raises total alkalinity by about ${formatNumber(delta, 0)}${unit}.${phNote}`,
      effect: "Sodium bicarbonate mainly raises alkalinity and only gently moves pH. It is better for buffering than pH-only correction.",
      steps: [
        `Add ${formatMass(bicarbForAlkalinity(volume, delta))} ${alkalinityName} with circulation.`,
        "Retest alkalinity and pH after mixing.",
        "If pH still needs raising after alkalinity is in range, use aeration first or a pH increaser in small stages.",
        "Low alkalinity makes pH unstable and is often caused by acid or dilution."
      ]
    });
  } else if (current > target + 15) {
    const delta = current - target;
    const hydrochloric = acidForAlkalinity(volume, delta, hydrochloricStrength);
    const dryAcid = dryAcidForAlkalinity(volume, delta);
    cards.push({
      title: "Lower alkalinity",
      badge: "watch",
      amount: formatVolume(hydrochloric),
      chemical: `${acidName} total`,
      body: "Use staged acid and aeration cycles; this is not a single-dose instruction.",
      effect: "Acid lowers total alkalinity and pH. Aeration then raises pH back up without raising alkalinity again.",
      steps: [
        "Add acid in smaller staged doses to lower alkalinity.",
        "Aerate strongly to raise pH back up without adding buffer.",
        "Retest pH and alkalinity between stages.",
        "High alkalinity usually comes from source water, too much buffer, or pH-up products."
      ],
      alt: [`${dryAcidName} equivalent: ${formatMass(dryAcid)}.`]
    });
  }
}

function calculateCalcium(cards, volume) {
  const current = numberValue("calcium");
  const defaults = currentDefaultTargets();
  const target = positiveNumber("targetCalcium", defaults.calcium);
  const purity = positiveNumber("calciumPurity", 77);
  const unit = concentrationUnitSuffix();
  const calciumName = chemicalName("calciumName", "calcium chloride");

  if (current === null) return;

  if (current < target - 10) {
    const delta = target - current;
    cards.push({
      title: "Raise calcium hardness",
      badge: "dose",
      amount: formatMass(calciumChlorideForHardness(volume, delta, purity)),
      chemical: `${formatNumber(purity, 1)}% ${calciumName}`,
      body: `Raises calcium hardness by about ${formatNumber(delta, 0)}${unit}.`,
      effect: "Increases calcium hardness, which helps protect concrete surfaces and tile grout from aggressive water.",
      steps: [
        `Add ${formatMass(calciumChlorideForHardness(volume, delta, purity))} ${calciumName} slowly.`,
        "Brush/circulate well and retest hardness after mixing.",
        "Low hardness can make water aggressive to concrete, grout and tiled finishes."
      ]
    });
  } else if (current > target + 100) {
    const fraction = replacementFraction(current, target);
    cards.push({
      title: "Calcium hardness is high",
      badge: "watch",
      amount: `${formatDoseNumber(fraction * 100)}%`,
      chemical: "water replacement",
      body: `Approximate replacement volume: ${formatLitres(volume * fraction)}. Check source-water hardness first.`,
      effect: "Dilutes calcium hardness; chemical additions cannot directly remove calcium from pool water.",
      steps: [
        `Replace about ${formatLitres(volume * fraction)} if source water is lower hardness.`,
        "Retest calcium hardness after refill and circulation.",
        "High hardness is usually from hard source water, evaporation, or calcium products."
      ]
    });
  }
}

function calculateCya(cards, volume, sanitizer) {
  const current = numberValue("cya");
  if (current === null || sanitizer === "bromine" || !activePoolAllowsCya()) return;

  const defaults = currentDefaultTargets();
  const target = positiveNumber("targetCya", defaults.cya);
  const purity = positiveNumber("stabilizerPurity", 100);
  const unit = concentrationUnitSuffix();
  const stabilizerName = chemicalName("stabilizerName", "stabiliser");

  if (current < target - 5) {
    const delta = target - current;
    cards.push({
      title: "Raise stabiliser",
      badge: "dose",
      amount: formatMass(stabilizerDose(volume, delta, purity)),
      chemical: `${formatNumber(purity, 1)}% ${stabilizerName}`,
      body: `Raises cyanuric acid by about ${formatNumber(delta, 0)}${unit}.`,
      effect: "Increases stabiliser, which protects chlorine from sunlight but makes high chlorine levels less effective.",
      steps: [
        `Add ${formatMass(stabilizerDose(volume, delta, purity))} ${stabilizerName} slowly.`,
        "Circulate and retest after it has fully dissolved.",
        "Low stabiliser lets sunlight burn off chlorine faster in outdoor pools."
      ]
    });
  } else if (current > target + 20) {
    const fraction = replacementFraction(current, target);
    cards.push({
      title: "Stabiliser is high",
      badge: "watch",
      amount: `${formatDoseNumber(fraction * 100)}%`,
      chemical: "water replacement",
      body: `Approximate replacement volume: ${formatLitres(volume * fraction)}.`,
      effect: "Dilutes stabiliser; CYA does not evaporate and usually only drops through water replacement or splash-out.",
      steps: [
        `Replace about ${formatLitres(volume * fraction)} and refill.`,
        "Circulate, then retest stabiliser and chlorine.",
        "High stabiliser usually comes from previous stabiliser or stabilized chlorine use."
      ]
    });
  }
}

function calculateSalt(cards, volume, sanitizer) {
  const current = numberValue("salt");
  if (current === null || (sanitizer !== "salt" && sanitizer !== "mineral")) return;

  const defaults = currentDefaultTargets();
  const target = positiveNumber("targetSalt", defaults.salt);
  const systemName = sanitizer === "mineral" ? "mineral system" : "salt chlorinator";
  const unit = concentrationUnitSuffix();
  const saltName = chemicalName("saltName", "pool salt");

  if (current < target - 100) {
    const delta = target - current;
    cards.push({
      title: "Salt is low",
      badge: "watch",
      amount: "Check manual",
      chemical: saltName,
      body: `Salt is about ${formatNumber(delta, 0)}${unit} under target. Confirm the ${systemName} manual before adding salt.`,
      effect: `Increases salinity so the ${systemName} can operate correctly.`,
      steps: [
        "Do not add one large calculated amount from the app.",
        `Use the ${systemName} manual or salt-bag chart for the exact amount, then add in smaller stages.`,
        "Brush/circulate until dissolved, then retest salt before adding more.",
        `Low salt can stop the ${systemName} working properly.`
      ]
    });
  } else if (current > target + 500) {
    cards.push({
      title: "Salt is high",
      badge: "watch",
      amount: "Dilute only",
      chemical: "water replacement",
      body: `Salt is above target. Confirm the ${systemName} operating range before making changes.`,
      effect: "Dilutes salinity; salt cannot be chemically removed from the water.",
      steps: [
        "Do not add more salt or mineral product.",
        "Partial water replacement is the usual correction if the level is outside the equipment range.",
        `Circulate, then retest salt before adjusting the ${systemName}.`,
        "High salt usually comes from over-salting, evaporation, or liquid chlorine build-up."
      ]
    });
  }
}

function renderPendingResults(message) {
  const results = $("results");
  if (!results) return;

  results.replaceChildren();
  updateCalculateButton();
}

function renderCards(cards) {
  const results = $("results");
  if (!results) return;
  results.replaceChildren();

  if (!cards.length) {
    return;
  }

  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "dose-card";

    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = card.title;
    const badge = document.createElement("span");
    badge.className = `badge ${card.badge || "dose"}`;
    badge.textContent = card.badge === "ok" ? "ok" : card.badge || "dose";
    header.append(title, badge);

    const main = document.createElement("div");
    main.className = "dose-main";
    const amount = document.createElement("span");
    amount.className = "dose-amount";
    amount.textContent = card.amount;
    const chemical = document.createElement("span");
    chemical.className = "dose-chemical";
    chemical.textContent = card.chemical;
    main.append(amount, chemical);

    const body = document.createElement("p");
    body.textContent = card.body;
    article.append(header, main, body);

    if (card.effect) {
      const effect = document.createElement("p");
      effect.className = "dose-effect";
      const label = document.createElement("strong");
      label.textContent = "Effect: ";
      effect.append(label, document.createTextNode(card.effect));
      article.append(effect);
    }

    if (card.steps && card.steps.length) {
      const steps = document.createElement("ol");
      steps.className = "dose-steps";
      card.steps.forEach((line) => {
        const item = document.createElement("li");
        item.textContent = line;
        steps.append(item);
      });
      article.append(steps);
    }

    if (card.alt && card.alt.length) {
      const alt = document.createElement("div");
      alt.className = "dose-alt";
      card.alt.forEach((line) => {
        const span = document.createElement("span");
        span.textContent = line;
        alt.append(span);
      });
      article.append(alt);
    }

    results.append(article);
  });
  updateCalculateButton();
}

function updateCalculateButton() {
  const button = $("calculateButton");
  if (!button) return;

  button.textContent = resultsVisible ? "Dismiss" : "Calculate";
  button.classList.toggle("primary-button", !resultsVisible);
  button.classList.toggle("secondary-button", resultsVisible);
}

function showDoseResults() {
  resultsVisible = true;
  renderCards(lastCards);
  saveState();
}

function dismissDoseResults() {
  resultsVisible = false;
  renderPendingResults("Results dismissed. Press Calculate to show dosing again.");
  saveState();
}

function handleCalculatePress() {
  if (resultsVisible) {
    dismissDoseResults();
    return;
  }

  const cards = calculate({ showResults: false });

  if (!hasAnyReading() || !cards.length) {
    return;
  }

  showDoseResults();
}

const readingLabels = {
  freeChlorine: "Free chlorine",
  totalChlorine: "Total chlorine",
  combinedChlorine: "Combined chlorine",
  bromine: "Bromine",
  ph: "pH",
  alkalinity: "Alkalinity",
  calcium: "Calcium hardness",
  cya: "Stabiliser",
  salt: "Salt",
  waterTemperature: "Temperature"
};

const readingUnits = {
  ph: "",
  waterTemperature: " degrees C"
};

const concentrationReadingIds = new Set([
  "freeChlorine",
  "totalChlorine",
  "combinedChlorine",
  "bromine",
  "alkalinity",
  "calcium",
  "cya",
  "salt"
]);

function loadHistory() {
  try {
    const raw = localStorage.getItem(historyKey);
    historyEntries = raw ? JSON.parse(raw) : [];
  } catch {
    historyEntries = [];
    localStorage.removeItem(historyKey);
  }

  renderHistory();
}

function saveHistory() {
  localStorage.setItem(historyKey, JSON.stringify(historyEntries.slice(0, 100)));
  renderHistory();
}

function currentReadingsSnapshot() {
  syncCombinedChlorine();
  const readings = {};

  readingIds.forEach((id) => {
    const value = numberValue(id);
    if (value !== null) readings[id] = value;
  });

  return readings;
}

function currentTargetSnapshot() {
  const defaults = currentDefaultTargets();
  return {
    chlorine: positiveNumber("targetChlorine", defaults.chlorine),
    combined: positiveNumber("targetCombined", defaults.combined),
    bromine: positiveNumber("targetBromine", defaults.bromine),
    ph: positiveNumber("targetPh", defaults.ph),
    alkalinity: positiveNumber("targetAlkalinity", defaults.alkalinity),
    calcium: positiveNumber("targetCalcium", defaults.calcium),
    cya: positiveNumber("targetCya", defaults.cya),
    salt: positiveNumber("targetSalt", defaults.salt)
  };
}

function historyBaseEntry(kind) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    createdAt: new Date().toISOString(),
    poolKey: currentPoolKey(),
    poolName: currentPool().name,
    volumeLitres: poolVolumeLitres(),
    displayedVolume: formatPoolVolume(poolVolumeLitres()),
    sanitizer: selected("sanitizer"),
    surface: normalizedSurface($("surfaceType").value)
  };
}

function saveTestLog() {
  const readings = currentReadingsSnapshot();

  if (!Object.keys(readings).length) {
    return;
  }

  historyEntries.unshift({
    ...historyBaseEntry("test"),
    readings,
    targets: currentTargetSnapshot()
  });
  saveHistory();
}

function isChemicalAddition(card) {
  if (!card || card.badge === "ok") return false;
  if (!card.amount || ["Hold", "Retest", "Balanced"].includes(card.amount)) return false;
  return true;
}

function saveChemicalAdditions() {
  const additions = lastCards
    .filter(isChemicalAddition)
    .map((card) => ({
      title: card.title,
      amount: card.amount,
      chemical: card.chemical,
      note: card.body
    }));

  if (!additions.length) {
    return;
  }

  historyEntries.unshift({
    ...historyBaseEntry("additions"),
    additions
  });
  saveHistory();
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatReadingValue(metric, value) {
  const digits = metric === "combinedChlorine" ? 2 : metric === "ph" || metric === "waterTemperature" ? 1 : 0;
  const unit = concentrationReadingIds.has(metric) ? concentrationUnitSuffix() : readingUnits[metric] || "";
  return `${formatTruncatedDecimal(value, digits)}${unit}`;
}

function renderHistory() {
  if (!$("historyLog")) return;

  const testCount = historyEntries.filter((entry) => entry.kind === "test").length;
  const additionCount = historyEntries.filter((entry) => entry.kind === "additions").length;
  $("historySummary").textContent = `${testCount} test log${testCount === 1 ? "" : "s"}, ${additionCount} addition log${additionCount === 1 ? "" : "s"}`;
  updateHistoryExportButtons();
  renderHistoryChart();
  renderHistoryLog();
}

function renderHistoryChart() {
  const chart = $("historyChart");
  chart.replaceChildren();

  const metric = $("historyMetric").value || "freeChlorine";
  const points = historyEntries
    .filter((entry) => entry.kind === "test" && entry.readings && Number.isFinite(entry.readings[metric]))
    .slice(0, 12)
    .reverse();

  if (points.length < 2) {
    const empty = document.createElement("span");
    empty.textContent = `Save at least two ${readingLabels[metric].toLowerCase()} readings to show a trend.`;
    chart.append(empty);
    return;
  }

  const values = points.map((entry) => entry.readings[metric]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 360;
  const height = 150;
  const pad = 28;
  const usableWidth = width - pad * 2;
  const usableHeight = height - pad * 2;
  const coords = values.map((value, index) => {
    const x = pad + (usableWidth * index) / (values.length - 1);
    const y = height - pad - ((value - min) / range) * usableHeight;
    return [x, y];
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${readingLabels[metric]} trend`);

  const grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
  grid.setAttribute("x1", pad);
  grid.setAttribute("x2", width - pad);
  grid.setAttribute("y1", height - pad);
  grid.setAttribute("y2", height - pad);
  grid.setAttribute("class", "chart-axis");
  svg.append(grid);

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", coords.map(([x, y]) => `${x},${y}`).join(" "));
  polyline.setAttribute("class", "chart-line");
  svg.append(polyline);

  coords.forEach(([x, y]) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 4);
    circle.setAttribute("class", "chart-dot");
    svg.append(circle);
  });

  const label = document.createElement("div");
  label.className = "chart-label";
  label.textContent = `${readingLabels[metric]}: ${formatReadingValue(metric, values[0])} to ${formatReadingValue(metric, values[values.length - 1])}`;

  chart.append(svg, label);
}

function renderHistoryLog() {
  const log = $("historyLog");
  log.replaceChildren();

  if (!historyEntries.length) {
    const empty = document.createElement("article");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>No history yet</strong><span>Save a test log or chemical additions from the calculator.</span>";
    log.append(empty);
    return;
  }

  historyEntries.slice(0, 18).forEach((entry) => {
    const article = document.createElement("article");
    article.className = "history-item";

    const head = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.kind === "test" ? "Test log" : "Chemical additions";
    const meta = document.createElement("span");
    meta.textContent = `${formatDateTime(entry.createdAt)} - ${entry.poolName} - ${entry.displayedVolume}`;
    head.append(title, meta);
    article.append(head);

    const details = document.createElement("p");
    if (entry.kind === "test") {
      const lines = Object.entries(entry.readings)
        .map(([id, value]) => `${readingLabels[id]} ${formatReadingValue(id, value)}`);
      details.textContent = lines.join(", ");
    } else {
      details.textContent = entry.additions
        .map((item) => `${item.amount} ${item.chemical}`)
        .join(", ");
    }
    article.append(details);
    log.append(article);
  });
}

function clearHistory() {
  if (historyEntries.length && typeof window !== "undefined" && !window.confirm("Clear saved history on this device?")) {
    return;
  }

  historyEntries = [];
  localStorage.removeItem(historyKey);
  renderHistory();
}

function updateHistoryExportButtons() {
  ["exportHistory", "shareHistory"].forEach((id) => {
    if ($(id)) $(id).disabled = historyEntries.length === 0;
  });
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function historyExportFileName() {
  return `poolz-history-${new Date().toISOString().slice(0, 10)}.csv`;
}

function readingExportValue(entry, id) {
  if (!entry.readings || !Number.isFinite(entry.readings[id])) return "";
  return formatReadingValue(id, entry.readings[id]);
}

function targetExportValue(entry, id) {
  if (!entry.targets || !Number.isFinite(entry.targets[id])) return "";
  const unitIds = new Set(["chlorine", "combined", "bromine", "alkalinity", "calcium", "cya", "salt"]);
  const digits = id === "combined" ? 2 : id === "ph" ? 1 : 0;
  const unit = unitIds.has(id) ? concentrationUnitSuffix() : "";
  return `${formatTruncatedDecimal(entry.targets[id], digits)}${unit}`;
}

function historyCsvContent() {
  const headers = [
    "Date",
    "Entry type",
    "Pool",
    "Volume",
    "Sanitiser",
    "Surface",
    "Free chlorine",
    "Total chlorine",
    "Combined chlorine",
    "Bromine",
    "pH",
    "Alkalinity",
    "Calcium hardness",
    "Stabiliser",
    "Salt",
    "Temperature",
    "Target chlorine",
    "Target combined",
    "Target bromine",
    "Target pH",
    "Target alkalinity",
    "Target calcium",
    "Target stabiliser",
    "Target salt",
    "Chemical additions",
    "Notes"
  ];

  const rows = historyEntries.slice().reverse().map((entry) => {
    const additions = entry.additions
      ? entry.additions.map((item) => `${item.amount} ${item.chemical}`).join("; ")
      : "";
    const notes = entry.additions
      ? entry.additions.map((item) => item.note || "").filter(Boolean).join("; ")
      : "";

    return [
      new Date(entry.createdAt).toLocaleString("en-AU"),
      entry.kind === "test" ? "Test log" : "Chemical additions",
      entry.poolName,
      entry.displayedVolume,
      entry.sanitizer || "",
      entry.surface || "",
      readingExportValue(entry, "freeChlorine"),
      readingExportValue(entry, "totalChlorine"),
      readingExportValue(entry, "combinedChlorine"),
      readingExportValue(entry, "bromine"),
      readingExportValue(entry, "ph"),
      readingExportValue(entry, "alkalinity"),
      readingExportValue(entry, "calcium"),
      readingExportValue(entry, "cya"),
      readingExportValue(entry, "salt"),
      readingExportValue(entry, "waterTemperature"),
      targetExportValue(entry, "chlorine"),
      targetExportValue(entry, "combined"),
      targetExportValue(entry, "bromine"),
      targetExportValue(entry, "ph"),
      targetExportValue(entry, "alkalinity"),
      targetExportValue(entry, "calcium"),
      targetExportValue(entry, "cya"),
      targetExportValue(entry, "salt"),
      additions,
      notes
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function historyExportBlob() {
  return new Blob(["\uFEFF", historyCsvContent()], {
    type: "text/csv;charset=utf-8"
  });
}

function downloadHistoryExport() {
  if (!historyEntries.length) return;

  const url = URL.createObjectURL(historyExportBlob());
  const link = document.createElement("a");
  link.href = url;
  link.download = historyExportFileName();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function shareHistoryExport() {
  if (!historyEntries.length) return;

  const fileName = historyExportFileName();
  const blob = historyExportBlob();
  const file = typeof File !== "undefined"
    ? new File([blob], fileName, { type: blob.type })
    : null;

  if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: "POOLZ history",
      text: "POOLZ history export",
      files: [file]
    }).catch(() => null);
    return;
  }

  if (navigator.share) {
    await navigator.share({
      title: "POOLZ history",
      text: historyCsvContent()
    }).catch(() => null);
    return;
  }

  const subject = encodeURIComponent("POOLZ history export");
  const body = encodeURIComponent(historyCsvContent());
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function createProfileKey() {
  return `pool-${Date.now().toString(36)}`;
}

function newProfile() {
  savePoolSettings(currentPoolKey());
  const key = createProfileKey();
  profileSettings[key] = {
    name: "New Pool",
    volume: null,
    sanitizer: "chlorine",
    surface: "fibreglass",
    allowCya: true,
    targets: defaultTargetsFor("fibreglass", "chlorine", true)
  };
  renderProfileOptions(key);
  applyPoolProfile(key);
  clearReadings();
  saveState();
  calculate();
}

function saveCurrentProfile() {
  const key = currentPoolKey();
  savePoolSettings(key);
  renderProfileOptions(key);
  applyPoolProfile(key);
  saveState();
  showPage("calculator");
}

function deleteCurrentProfile() {
  const key = currentPoolKey();
  if (profileCount() <= 1) return;

  delete profileSettings[key];
  const nextKey = Object.keys(profileSettings)[0] || defaultProfileKey;
  renderProfileOptions(nextKey);
  applyPoolProfile(nextKey);
  clearReadings();
  saveState();
  calculate();
}

function appIsInstalled() {
  const standaloneDisplay = typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = typeof navigator !== "undefined" && navigator.standalone === true;
  return standaloneDisplay || iosStandalone;
}

function updateInstallState(message) {
  const button = $("installAppButton");
  const status = $("installStatus");

  if (appIsInstalled()) {
    if (button) button.disabled = true;
    if (status) status.textContent = "Installed on this device";
    return;
  }

  if (deferredInstallPrompt) {
    if (button) button.disabled = false;
    if (status) status.textContent = message || "Install is available on this browser";
    return;
  }

  if (button) button.disabled = true;
  if (status) status.textContent = message || "Install POOLZ on mobile now. App Store and Play Store releases are planned.";
}

async function promptInstallApp() {
  if (!deferredInstallPrompt) {
    updateInstallState();
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  updateInstallState("Install prompt closed");
}

const installGuides = {
  ios: {
    title: "iPhone / iPad",
    steps: [
      "Open POOLZ in Safari on your iPhone or iPad.",
      "Tap the Share button.",
      "Choose Add to Home Screen.",
      "Tap Add. POOLZ will open from your home screen.",
      "An App Store version is planned later."
    ]
  },
  android: {
    title: "Android",
    steps: [
      "Open POOLZ in Chrome on your Android phone or tablet.",
      "Tap the browser menu.",
      "Choose Install app or Add to Home screen.",
      "Confirm the install. POOLZ will open from your home screen.",
      "A Play Store version is planned later."
    ]
  }
};

function showInstallGuide(platform) {
  const guide = installGuides[platform];
  const container = $("installGuide");
  if (!guide || !container) return;

  all("[data-install-platform]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.installPlatform === platform);
  });

  const title = document.createElement("strong");
  title.textContent = guide.title;
  const list = document.createElement("ol");
  guide.steps.forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    list.append(item);
  });
  container.replaceChildren(title, list);
}

function startMobileSplash() {
  const splash = $("mobileSplash");
  if (!splash) return;

  const isMobile = typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(max-width: 760px)").matches;

  if (!isMobile) {
    splash.remove();
    return;
  }

  const hideSplash = () => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => splash.remove(), 480);
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(hideSplash, reducedMotion ? 700 : 1800);
  splash.addEventListener("click", hideSplash, { once: true });
}

function showPage(page) {
  all("[data-page-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.pagePanel === page);
  });
  all("[data-nav-page]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.navPage === page);
  });
  closeDrawer();
  if (page === "install") updateInstallState();
  if (page === "history") renderHistory();
  if (page === "volume") updateVolumeCalculator();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openDrawer() {
  $("appDrawer").classList.add("is-open");
  $("appDrawer").setAttribute("aria-hidden", "false");
  $("drawerOverlay").hidden = false;
  $("menuToggle").setAttribute("aria-expanded", "true");
}

function closeDrawer() {
  $("appDrawer").classList.remove("is-open");
  $("appDrawer").setAttribute("aria-hidden", "true");
  $("drawerOverlay").hidden = true;
  $("menuToggle").setAttribute("aria-expanded", "false");
}

function bindEvents() {
  valueIds.forEach((id) => {
    if (!$(id)) return;
    $(id).addEventListener("input", calculate);
    $(id).addEventListener("change", calculate);
  });

  $("poolProfile").addEventListener("change", () => {
    savePoolSettings(lastPoolKey);
    applyPoolProfile(currentPoolKey());
    clearReadings();
    saveState();
    calculate();
  });

  $("profileName").addEventListener("input", () => {
    savePoolSettings();
    renderProfileOptions(currentPoolKey());
    saveState();
  });

  $("poolVolume").addEventListener("input", () => {
    savePoolSettings();
    saveState();
    calculate();
  });

  $("surfaceType").addEventListener("change", () => {
    setTargetsFromProfile();
  });

  all('input[name="sanitizer"]').forEach((input) => {
    input.addEventListener("change", () => {
      savePoolSettings();
      setTargetsFromProfile();
    });
  });

  all('input[name="testSet"]').forEach((input) => {
    input.addEventListener("change", () => {
      updateVisibility();
      saveState();
      calculate();
    });
  });

  all('input[name="unitSystem"]').forEach((input) => {
    input.addEventListener("change", () => {
      applyPoolProfile(currentPoolKey());
      saveState();
      calculate();
      renderHistory();
      updateVolumeCalculator();
    });
  });

  all('input[name="concentrationUnit"]').forEach((input) => {
    input.addEventListener("change", () => {
      syncConcentrationUnitControls();
      saveState();
      calculate();
      renderHistory();
    });
  });

  all('input[name="targetConcentrationUnit"]').forEach((input) => {
    input.addEventListener("change", () => {
      setRadio("concentrationUnit", input.value);
      syncConcentrationUnitControls();
      saveState();
      calculate();
      renderHistory();
    });
  });

  all('input[name="dimensionUnit"]').forEach((input) => {
    input.addEventListener("change", updateVolumeCalculator);
  });

  ["volumeLength", "volumeWidth", "volumeShallowDepth", "volumeDeepDepth"].forEach((id) => {
    if (!$(id)) return;
    $(id).addEventListener("input", updateVolumeCalculator);
    $(id).addEventListener("change", updateVolumeCalculator);
  });

  $("useCalculatedVolume").addEventListener("click", useCalculatedVolume);
  if ($("newProfile")) $("newProfile").addEventListener("click", newProfile);
  if ($("saveProfile")) $("saveProfile").addEventListener("click", saveCurrentProfile);
  if ($("deleteProfile")) $("deleteProfile").addEventListener("click", deleteCurrentProfile);
  $("saveTargets").addEventListener("click", () => {
    saveState();
    showPage("calculator");
  });
  $("saveChemicals").addEventListener("click", () => {
    saveState();
    showPage("calculator");
  });
  $("calculateButton").addEventListener("click", handleCalculatePress);
  $("saveTestLog").addEventListener("click", saveTestLog);
  $("historyMetric").addEventListener("change", renderHistory);
  $("exportHistory").addEventListener("click", downloadHistoryExport);
  $("shareHistory").addEventListener("click", shareHistoryExport);
  $("clearHistory").addEventListener("click", clearHistory);
  if ($("installAppButton")) $("installAppButton").addEventListener("click", promptInstallApp);
  all("[data-install-platform]").forEach((button) => {
    button.addEventListener("click", () => showInstallGuide(button.dataset.installPlatform));
  });

  $("menuToggle").addEventListener("click", openDrawer);
  $("drawerClose").addEventListener("click", closeDrawer);
  $("drawerOverlay").addEventListener("click", closeDrawer);
  all("[data-nav-page]").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.navPage));
  });

  $("appDrawer").addEventListener("touchstart", (event) => {
    drawerTouchStartX = event.touches[0].clientX;
  }, { passive: true });

  $("appDrawer").addEventListener("touchend", (event) => {
    if (drawerTouchStartX === null) return;
    const delta = event.changedTouches[0].clientX - drawerTouchStartX;
    drawerTouchStartX = null;
    if (delta < -50) closeDrawer();
  }, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });

}

bindEvents();
loadState();
loadHistory();
updateInstallState();
startMobileSplash();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallState();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateInstallState("Installed on this device");
  });
}

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=20260619-balance-salt", {
      updateViaCache: "none"
    }).catch(() => {});
  });
}
