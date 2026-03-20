// ========================================
// ELECTROCOAGULATION SYSTEM
// Fixed Configuration: Al Anode + Fe Cathode
// ========================================

const state = {
  running: false,
  time: 0,
  speed: 1.0,
  current: 2.0,
  voltage: 12.0,
  waterVolume: 2.0,
  anodeMaterial: 'Al', // FIXED: Aluminum anode
  cathodeMaterial: 'Fe', // FIXED: Iron cathode
  turbidity: 95,
  clarity: 5,
  phLevel: 7.0,
  anodeThickness: 1.0,
  
  // Water Quality Input Parameters
  initialPH: 7.0,           // pH units (4-10)
  initialTurbidity: 100,     // NTU (10-500)
  initialTSS: 150,           // mg/L Total Suspended Solids (10-1000)
  conductivity: 500,         // µS/cm Electrical Conductivity (100-2000)
  initialO2: 6.0,            // mg/L Dissolved Oxygen (0-14)
  
  // Electrode Parameters (for kinetic model)
  electrodeArea: 50,        // cm² (total active surface area of anode)
  electrodeHeight: 10,      // cm (submerged height)
  electrodeWidth: 5,        // cm (electrode width)
  
  // Treatment time prediction
  estimatedTreatmentTime: 0,
  elapsedTreatmentTime: 0,
  isTreated: false,
  
  // Kinetic model outputs
  chargeLoading: 0,         // C/L (Coulombs per liter)
  currentDensity: 0,        // A/m² (current density)
  aluminumDosage: 0,        // mg/L Al³⁺ released
  targetChargeLoading: 0,   // C/L required for treatment
  currentTSS: 150,          // mg/L current TSS during simulation
  calibration: {
    runCount: 0,
    lastUpdated: null
  },
  
  particles: {
    ions: [],
    flocs: [],
    bubbles: [],
    impurities: []
  }
};

// ========================================
// KINETIC MODEL CONSTANTS (FROM LITERATURE)
// ========================================
const KINETIC_CONSTANTS = {
  // Faraday constant (C/mol)
  F: 96485,
  
  // Aluminum properties
  Al_MOLAR_MASS: 26.98,     // g/mol
  Al_VALENCE: 3,            // electrons transferred
  
  // First-order rate constants (L/C) - conservative values for Al EC batch systems.
  // Calibrated with reported treatment windows in reviews (Moussa et al., 2017; Mollah et al., 2001)
  // and kept intentionally conservative so default runs do not under-predict treatment time.
  k_turbidity: 0.0025,      // L/C - turbidity removal rate constant
  k_TSS: 0.0018,            // L/C - TSS removal rate constant
  k_COD: 0.0012,            // L/C - COD removal (if applicable)
  
  // pH model constants (from Kobya et al. 2003)
  pH_optimal: 7.0,          // Optimal pH for Al coagulation
  pH_shift_rate: 0.001,     // pH shift per C/L towards neutral
  
  // Oxygen model constants
  O2_increase_rate: 0.0005, // mg/L per C/L (from H2 bubble aeration)
  O2_saturation: 9.1,       // mg/L at 20°C
  
  // Conductivity model
  conductivity_loss_rate: 0.00005, // fractional loss per C/L
  
  // Treatment thresholds (target removal efficiency)
  target_turbidity_removal: 0.92,   // 92% removal
  target_TSS_removal: 0.90,         // 90% removal
  
  // Current density range (A/m²) - converted from common EC ranges in mA/cm²
  // 8-30 mA/cm²  ≈ 80-300 A/m²
  j_min: 80,
  j_max: 300,
  j_optimal: 150,

  // Charge loading envelope from batch EC practice (C/L)
  // 0.3-1.5 Ah/L ≈ 1080-5400 C/L (used as realistic bounds)
  reference_charge_loading: 1500,
  min_charge_loading: 1000,
  max_charge_loading: 5400
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function median(values) {
  if (!values || values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function parseCalibrationDataset(rawInput) {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'));

  if (lines.length < 3) {
    throw new Error('Please provide at least 3 calibration runs.');
  }

  let startIndex = 0;
  if (/[a-zA-Z]/.test(lines[0])) {
    startIndex = 1;
  }

  const runLines = lines.slice(startIndex);
  if (runLines.length < 3 || runLines.length > 5) {
    throw new Error('Calibration mode requires 3 to 5 runs.');
  }

  const runs = runLines.map((line, index) => {
    const columns = line.split(/[\t,;]+/).map((entry) => entry.trim());

    if (columns.length !== 6 && columns.length !== 8) {
      throw new Error(`Row ${index + 1} must have 6 or 8 numeric fields.`);
    }

    const numbers = columns.map((value) => Number(value));
    if (numbers.some((value) => !Number.isFinite(value))) {
      throw new Error(`Row ${index + 1} contains non-numeric values.`);
    }

    const run = {
      timeMin: numbers[0],
      currentA: numbers[1],
      volumeL: numbers[2],
      areaCm2: numbers[3],
      turbidity0: numbers[4],
      turbidityF: numbers[5],
      tss0: columns.length === 8 ? numbers[6] : null,
      tssF: columns.length === 8 ? numbers[7] : null
    };

    if (run.timeMin <= 0 || run.currentA <= 0 || run.volumeL <= 0 || run.areaCm2 <= 0) {
      throw new Error(`Row ${index + 1} has invalid operating values.`);
    }

    if (run.turbidity0 <= 0 || run.turbidityF <= 0 || run.turbidityF >= run.turbidity0) {
      throw new Error(`Row ${index + 1} turbidity values must be positive and final < initial.`);
    }

    if (run.tss0 !== null || run.tssF !== null) {
      if (run.tss0 <= 0 || run.tssF <= 0 || run.tssF >= run.tss0) {
        throw new Error(`Row ${index + 1} TSS values must be positive and final < initial.`);
      }
    }

    return run;
  });

  return runs;
}

function fitKineticConstantsFromRuns(runs) {
  const turbidityK = [];
  const tssK = [];

  for (const run of runs) {
    const treatmentSeconds = run.timeMin * 60;
    const chargeLoading = (run.currentA * treatmentSeconds) / run.volumeL;
    const kTurb = -Math.log(run.turbidityF / run.turbidity0) / chargeLoading;

    if (Number.isFinite(kTurb) && kTurb > 0) {
      turbidityK.push(kTurb);
    }

    if (run.tss0 !== null && run.tssF !== null) {
      const kTss = -Math.log(run.tssF / run.tss0) / chargeLoading;
      if (Number.isFinite(kTss) && kTss > 0) {
        tssK.push(kTss);
      }
    }
  }

  if (turbidityK.length < 3) {
    throw new Error('Unable to fit turbidity constant from provided runs.');
  }

  const fittedKTurbidity = clamp(median(turbidityK), 0.0003, 0.02);
  const fittedKTSS = tssK.length >= 2
    ? clamp(median(tssK), 0.0003, 0.02)
    : clamp(fittedKTurbidity * 0.75, 0.0003, 0.02);
  const fittedKCOD = clamp(fittedKTSS * 0.67, 0.0002, 0.015);

  const qTargets = runs.map(() => {
    const qTurb = -Math.log(1 - KINETIC_CONSTANTS.target_turbidity_removal) / fittedKTurbidity;
    const qTss = -Math.log(1 - KINETIC_CONSTANTS.target_TSS_removal) / fittedKTSS;
    return Math.max(qTurb, qTss);
  });

  const fittedReferenceQ = clamp(median(qTargets), 800, 6500);
  const fittedMinQ = clamp(fittedReferenceQ * 0.65, 600, fittedReferenceQ);
  const fittedMaxQ = clamp(fittedReferenceQ * 2.4, fittedReferenceQ + 200, 9000);

  return {
    kTurbidity: fittedKTurbidity,
    kTSS: fittedKTSS,
    kCOD: fittedKCOD,
    referenceQ: fittedReferenceQ,
    minQ: fittedMinQ,
    maxQ: fittedMaxQ,
    runCount: runs.length
  };
}

function setCalibrationStatus(message, type) {
  const statusElement = document.getElementById('calibrationStatus');
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.className = `calibration-status calibration-${type}`;
}

function updateCalibrationResultDisplay(result) {
  const kTurbElement = document.getElementById('fitKTurbidity');
  const kTSSElement = document.getElementById('fitKTSS');
  const qElement = document.getElementById('fitReferenceQ');

  if (kTurbElement) {
    kTurbElement.textContent = `${result.kTurbidity.toFixed(5)} L/C`;
  }
  if (kTSSElement) {
    kTSSElement.textContent = `${result.kTSS.toFixed(5)} L/C`;
  }
  if (qElement) {
    qElement.textContent = `${Math.round(result.referenceQ)} C/L`;
  }
}

function applyCalibrationResult(result) {
  KINETIC_CONSTANTS.k_turbidity = result.kTurbidity;
  KINETIC_CONSTANTS.k_TSS = result.kTSS;
  KINETIC_CONSTANTS.k_COD = result.kCOD;
  KINETIC_CONSTANTS.reference_charge_loading = result.referenceQ;
  KINETIC_CONSTANTS.min_charge_loading = result.minQ;
  KINETIC_CONSTANTS.max_charge_loading = result.maxQ;

  state.calibration.runCount = result.runCount;
  state.calibration.lastUpdated = new Date().toISOString();

  calculateTreatmentTime();
  updatePredictionDisplay();
  updateFactorsDisplay();
}

function getCalibrationSampleData() {
  return [
    '45,2.0,2.0,50,140,32,220,58',
    '60,1.5,2.0,50,120,35,180,66',
    '40,2.5,1.5,50,160,28,250,54'
  ].join('\n');
}

// Initialize impurities
function initializeImpurities() {
  state.particles.impurities = [];
  for (let i = 0; i < 60; i++) {
    state.particles.impurities.push({
      x: Math.random() * 200 + 200,
      y: Math.random() * 250 + 100,
      size: Math.random() * 2 + 1.5,
      attached: false,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3
    });
  }
}

// ========================================
// KINETIC MODEL - TREATMENT TIME CALCULATION
// Based on First-Order Kinetics and Charge Loading
// ========================================

// Calculate current density (A/m²)
function calculateCurrentDensity() {
  // Electrode area in m² (convert from cm²)
  const areaM2 = state.electrodeArea / 10000;
  state.currentDensity = state.current / areaM2;
  return state.currentDensity;
}

// Calculate charge loading at time t (C/L)
function calculateChargeLoading(timeSeconds) {
  // Q = I × t / V (Coulombs per Liter)
  return (state.current * timeSeconds) / state.waterVolume;
}

// Calculate aluminum dosage using Faraday's Law (mg/L)
function calculateAluminumDosage(timeSeconds) {
  // m = (I × t × M) / (z × F) in grams
  const massGrams = (state.current * timeSeconds * KINETIC_CONSTANTS.Al_MOLAR_MASS) / 
                    (KINETIC_CONSTANTS.Al_VALENCE * KINETIC_CONSTANTS.F);
  // Convert to mg/L
  return (massGrams * 1000) / state.waterVolume;
}

// Calculate pollutant concentration at given charge loading
function calculateConcentrationAtQ(initialConc, rateConstant, chargeLoading) {
  // First-order kinetics: C(Q) = C₀ × e^(-k×Q)
  return initialConc * Math.exp(-rateConstant * chargeLoading);
}

// pH adjustment factor (affects rate constants)
function calculatePHEfficiencyFactor() {
  // Optimal pH is 6.5-7.5 for Al coagulation
  // Efficiency decreases as pH deviates from optimal
  const deviation = Math.abs(state.initialPH - KINETIC_CONSTANTS.pH_optimal);
  // Efficiency drops by ~10% for each pH unit away from optimal
  return Math.max(0.5, 1 - (deviation * 0.1));
}

// Conductivity efficiency factor
function calculateConductivityEfficiencyFactor() {
  // Higher conductivity = better current efficiency
  // Normalized to 500 µS/cm as baseline (efficiency = 1.0)
  // Low conductivity (<200) significantly reduces efficiency
  if (state.conductivity < 200) {
    return clamp(0.4 + (state.conductivity / 400), 0.4, 0.8);
  }
  return clamp(0.8 + (state.conductivity / 2200), 0.8, 1.2);
}

function calculateCurrentDensityEfficiencyFactor(currentDensity) {
  if (currentDensity < KINETIC_CONSTANTS.j_min) {
    return clamp(currentDensity / KINETIC_CONSTANTS.j_min, 0.35, 1.0);
  }

  if (currentDensity > KINETIC_CONSTANTS.j_max) {
    return clamp(KINETIC_CONSTANTS.j_max / currentDensity, 0.35, 1.0);
  }

  const deviation = Math.abs(currentDensity - KINETIC_CONSTANTS.j_optimal) / KINETIC_CONSTANTS.j_optimal;
  return clamp(1 - (deviation * 0.25), 0.75, 1.0);
}

function getEffectiveRateConstants(currentDensity) {
  const phEfficiency = calculatePHEfficiencyFactor();
  const conductivityEfficiency = calculateConductivityEfficiencyFactor();
  const currentDensityEfficiency = calculateCurrentDensityEfficiencyFactor(currentDensity);

  const combinedEfficiency = clamp(
    phEfficiency * conductivityEfficiency * currentDensityEfficiency,
    0.2,
    1.25
  );

  return {
    k_turbidity: KINETIC_CONSTANTS.k_turbidity * combinedEfficiency,
    k_TSS: KINETIC_CONSTANTS.k_TSS * combinedEfficiency,
    k_COD: KINETIC_CONSTANTS.k_COD * combinedEfficiency,
    phEfficiency,
    conductivityEfficiency,
    currentDensityEfficiency
  };
}

function calculateTreatmentTime() {
  // ========================================
  // KINETIC MODEL CALCULATION
  // ========================================
  
  // Step 1: Calculate current density
  const currentDensity = calculateCurrentDensity();
  
  // Step 2: Calculate target charge loading for treatment completion
  state.targetChargeLoading = calculateTargetChargeLoading();

  // Step 3: Calculate effective rates and efficiencies at current operating point
  const effectiveRates = getEffectiveRateConstants(currentDensity);
  
  // Step 4: Calculate treatment time from charge loading
  // Q = I × t / V => t = Q × V / I
  const treatmentTimeSeconds = (state.targetChargeLoading * state.waterVolume) / state.current;
  
  // Step 5: Calculate expected aluminum dosage at treatment completion
  state.aluminumDosage = calculateAluminumDosage(treatmentTimeSeconds);
  
  // Store kinetic model outputs for display
  state.currentDensity = currentDensity;
  state.chargeLoading = 0; // Will be updated during simulation
  
  // Store factors for UI display
  state.treatmentTimeFactors = {
    currentDensity: currentDensity.toFixed(1) + ' A/m²',
    targetChargeLoading: state.targetChargeLoading.toFixed(1) + ' C/L',
    phEfficiency: (effectiveRates.phEfficiency * 100).toFixed(0) + '%',
    conductivityEfficiency: ((effectiveRates.conductivityEfficiency * effectiveRates.currentDensityEfficiency) * 100).toFixed(0) + '%',
    aluminumDosage: state.aluminumDosage.toFixed(1) + ' mg/L'
  };
  
  state.estimatedTreatmentTime = treatmentTimeSeconds;
  state.elapsedTreatmentTime = 0;
  state.isTreated = false;
  
  // Sync initial values with simulation state
  state.turbidity = Math.min(95, state.initialTurbidity / 5); // Scale NTU to % for visualization
  state.phLevel = state.initialPH;
  state.clarity = 100 - state.turbidity;
  state.currentTSS = state.initialTSS;
  
  updatePredictionDisplay();
  updateFactorsDisplay();
}

function calculateTargetChargeLoading() {
  const currentDensity = calculateCurrentDensity();
  const effectiveRates = getEffectiveRateConstants(currentDensity);

  const Q_turbidity = -Math.log(1 - KINETIC_CONSTANTS.target_turbidity_removal) / effectiveRates.k_turbidity;
  const Q_TSS = -Math.log(1 - KINETIC_CONSTANTS.target_TSS_removal) / effectiveRates.k_TSS;
  const kineticTargetQ = Math.max(Q_turbidity, Q_TSS);

  // Empirical batch EC floor derived from common operational windows in literature reviews.
  const turbidityLoad = state.initialTurbidity / 100;
  const tssLoad = state.initialTSS / 150;
  const combinedLoad = clamp((0.6 * turbidityLoad) + (0.4 * tssLoad), 0.5, 2.5);
  const empiricalTargetQ = KINETIC_CONSTANTS.reference_charge_loading * combinedLoad;

  return clamp(
    Math.max(kineticTargetQ, empiricalTargetQ),
    KINETIC_CONSTANTS.min_charge_loading,
    KINETIC_CONSTANTS.max_charge_loading
  );
}

function predictWaterQualityAtTime(timeSeconds) {
  const currentDensity = calculateCurrentDensity();
  const effectiveRates = getEffectiveRateConstants(currentDensity);
  const Q = calculateChargeLoading(timeSeconds);

  const turbidityNTU = calculateConcentrationAtQ(state.initialTurbidity, effectiveRates.k_turbidity, Q);
  const predictedTurbidity = Math.max(5, Math.min(95, turbidityNTU / 5));

  const predictedTSS = Math.max(10, calculateConcentrationAtQ(state.initialTSS, effectiveRates.k_TSS, Q));
  const predictedClarity = Math.min(95, 100 - predictedTurbidity);

  const phShift = KINETIC_CONSTANTS.pH_shift_rate * Q;
  let predictedPH = state.initialPH;
  if (state.initialPH > KINETIC_CONSTANTS.pH_optimal) {
    predictedPH = Math.max(KINETIC_CONSTANTS.pH_optimal, state.initialPH - phShift);
  } else {
    predictedPH = Math.min(KINETIC_CONSTANTS.pH_optimal, state.initialPH + phShift);
  }

  const conductivityLoss = state.conductivity * KINETIC_CONSTANTS.conductivity_loss_rate * Q;
  const predictedConductivity = Math.max(state.conductivity * 0.65, state.conductivity - conductivityLoss);

  const o2Increase = KINETIC_CONSTANTS.O2_increase_rate * Q;
  const predictedO2 = Math.min(KINETIC_CONSTANTS.O2_saturation, state.initialO2 + o2Increase);

  return {
    Q,
    predictedTurbidity,
    predictedClarity,
    predictedPH,
    predictedTSS,
    predictedConductivity,
    predictedO2
  };
}

function updatePredictionDisplay() {
  if (!state.running && state.estimatedTreatmentTime === 0) {
    calculateTreatmentTime();
  }
  
  const progressPercent = (state.elapsedTreatmentTime / state.estimatedTreatmentTime) * 100;
  
  // Display estimated total time to complete treatment
  const hours = Math.floor(state.estimatedTreatmentTime / 3600);
  const minutes = Math.floor((state.estimatedTreatmentTime % 3600) / 60);
  let timeDisplay = '';
  
  if (hours > 0) {
    timeDisplay = `${hours}h ${minutes}m`;
  } else {
    timeDisplay = `${minutes}m`;
  }
  
  document.getElementById('countdownDisplay').textContent = timeDisplay;
  
  // Update progress bar
  const progressBar = document.getElementById('treatmentProgress');
  progressBar.style.width = Math.min(100, progressPercent) + '%';
  document.getElementById('progressText').textContent = Math.round(progressPercent) + '%';
  
  // Update progress bar color based on treatment stage
  if (progressPercent < 50) {
    progressBar.style.background = 'linear-gradient(90deg, #ff4757, #ffae57)'; // Red to Orange
  } else if (progressPercent < 85) {
    progressBar.style.background = 'linear-gradient(90deg, #ffae57, #ffd700)'; // Orange to Yellow
  } else {
    progressBar.style.background = 'linear-gradient(90deg, #ffd700, #00ff88)'; // Yellow to Green
  }
}

function updateFactorsDisplay() {
  // Kinetic model factors display
  if (state.treatmentTimeFactors) {
    document.getElementById('factorCurrentDensity').textContent = state.treatmentTimeFactors.currentDensity;
    document.getElementById('factorChargeLoading').textContent = state.treatmentTimeFactors.targetChargeLoading;
    document.getElementById('factorAlDosage').textContent = state.treatmentTimeFactors.aluminumDosage;
    document.getElementById('factorPHEfficiency').textContent = state.treatmentTimeFactors.phEfficiency;
    document.getElementById('factorConductivityEfficiency').textContent = state.treatmentTimeFactors.conductivityEfficiency;
  }
}

// ========================================
// TREATMENT COMPLETION CHECK
// ========================================

function checkTreatmentCompletion() {
  // Treatment is complete when:
  // 1. Turbidity < 10% AND
  // 2. Clarity > 85% AND
  // 3. pH in acceptable range (6.5 - 8.5)
  
  const turbidityThreshold = 10;
  const clarityThreshold = 85;
  const phMin = 6.5;
  const phMax = 8.5;
  
  const turbidityOk = state.turbidity < turbidityThreshold;
  const clarityOk = state.clarity > clarityThreshold;
  const phOk = state.phLevel >= phMin && state.phLevel <= phMax;
  
  if (turbidityOk && clarityOk && phOk) {
    if (!state.isTreated) {
      state.isTreated = true;
      state.elapsedTreatmentTime = state.estimatedTreatmentTime;
      
      // Trigger completion animation
      if (typeof anime !== 'undefined') {
        animateTreatmentCompletion();
      }
    }
  }
}

// ========================================
// SVG ANIMATION & BEAKER
// ========================================

const beakerSvg = document.getElementById('beaker');
const waterLevel = document.getElementById('waterLevel');
const sedimentLayer = document.getElementById('sedimentLayer');
const particlesContainer = document.getElementById('particlesContainer');
const anode = document.getElementById('anode');
const cathode = document.getElementById('cathode');

function updateBeakerVisualization() {
  // Water level (5L scale: 160-480)
  const scale = (480 - 160) / 5;
  const waterHeight = 160 + (5 - state.waterVolume) * scale;
  const levelHeight = 480 - waterHeight;

  waterLevel.setAttribute('y', waterHeight);
  waterLevel.setAttribute('height', levelHeight);

  // Sediment layer
  const sedimentHeight = Math.max(20, (100 - state.clarity) * 0.4);
  sedimentLayer.setAttribute('y', 480 - sedimentHeight);
  sedimentLayer.setAttribute('height', sedimentHeight);

  // Update water color based on turbidity and pH
  let waterColor;
  const turbidityAlpha = 0.3 + (state.turbidity / 100) * 0.4;
  if (state.phLevel < 6) {
    waterColor = `rgba(200, 100, 100, ${turbidityAlpha})`;
  } else if (state.phLevel > 8) {
    waterColor = `rgba(100, 150, 220, ${turbidityAlpha})`;
  } else {
    waterColor = `rgba(150, 180, 200, ${turbidityAlpha})`;
  }
  waterLevel.setAttribute('fill', waterColor);

  // Anode thinning effect
  const anodeRect = anode.querySelector('rect');
  const originalWidth = 20;
  const newWidth = originalWidth * state.anodeThickness;
  const xOffset = (originalWidth - newWidth) / 2;
  anodeRect.setAttribute('width', newWidth);
  anodeRect.setAttribute('x', 130 - newWidth / 2);
}

function animateParticles() {
  if (!state.running) return;

  const rate = state.current * state.speed;

  // Generate ions from anode
  if (Math.random() < rate * 0.08) {
    state.particles.ions.push({
      x: 130,
      y: 200 + Math.random() * 200,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 2,
      life: 100,
      type: state.anodeMaterial
    });
  }

  // Generate bubbles from cathode
  if (Math.random() < rate * 0.12) {
    state.particles.bubbles.push({
      x: 270 + (Math.random() - 0.5) * 8,
      y: 480,
      size: Math.random() * 4 + 2.5,
      speed: Math.random() * 2 + 1.5
    });
  }

  // Update and remove ions, form flocs
  state.particles.ions = state.particles.ions.filter(ion => {
    ion.x += ion.vx * state.speed;
    ion.y += ion.vy * state.speed;
    ion.life -= 1.5 * state.speed;

    if (ion.life < 50 && Math.random() < 0.1) {
      state.particles.flocs.push({
        x: ion.x,
        y: ion.y,
        size: Math.random() * 5 + 4,
        vy: 0.3,
        type: ion.type,
        attachedImpurities: []
      });
      return false;
    }

    return ion.life > 0 && ion.x > 80 && ion.x < 320 && ion.y > 160 && ion.y < 500;
  });

  // Update bubbles
  state.particles.bubbles = state.particles.bubbles.filter(bubble => {
    bubble.y -= bubble.speed * state.speed;
    return bubble.y > 150;
  });

  // Update flocs and grab impurities
  state.particles.flocs.forEach(floc => {
    floc.y += floc.vy * state.speed;
    floc.vy += 0.08 * state.speed;

    state.particles.impurities.forEach(imp => {
      if (!imp.attached) {
        const dist = Math.sqrt(Math.pow(floc.x - imp.x, 2) + Math.pow(floc.y - imp.y, 2));
        if (dist < 25) {
          imp.attached = true;
          floc.attachedImpurities.push(imp);
        }
      }
    });

    floc.attachedImpurities.forEach(imp => {
      imp.x = floc.x + (Math.random() - 0.5) * 12;
      imp.y = floc.y + (Math.random() - 0.5) * 12;
    });
  });

  state.particles.flocs = state.particles.flocs.filter(floc => floc.y < 470);

  // Free impurities brownian motion
  state.particles.impurities.forEach(imp => {
    if (!imp.attached) {
      imp.x += imp.vx * state.speed;
      imp.y += imp.vy * state.speed;
      imp.vx += (Math.random() - 0.5) * 0.1;
      imp.vy += (Math.random() - 0.5) * 0.1;
      imp.vx *= 0.98;
      imp.vy *= 0.98;

      imp.x = Math.max(85, Math.min(315, imp.x));
      imp.y = Math.max(165, Math.min(465, imp.y));
    }
  });

  drawParticlesSVG();
}

function drawParticlesSVG() {
  particlesContainer.innerHTML = '';

  // Draw free impurities
  state.particles.impurities.forEach(imp => {
    if (!imp.attached) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', imp.x);
      circle.setAttribute('cy', imp.y);
      circle.setAttribute('r', imp.size);
      circle.setAttribute('fill', 'rgba(100, 80, 60, 0.6)');
      particlesContainer.appendChild(circle);
    }
  });

  // Draw ions
  state.particles.ions.forEach(ion => {
    const alpha = ion.life / 100;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', ion.x);
    circle.setAttribute('cy', ion.y);
    circle.setAttribute('r', 2.5);
    circle.setAttribute('fill', ion.type === 'Al' 
      ? `rgba(180, 220, 255, ${alpha})` 
      : `rgba(255, 180, 100, ${alpha})`);
    circle.setAttribute('filter', 'drop-shadow(0 0 2px ' + 
      (ion.type === 'Al' ? 'rgba(100, 200, 255, 0.5)' : 'rgba(255, 150, 80, 0.5)') + ')');
    particlesContainer.appendChild(circle);
  });

  // Draw flocs with attached impurities
  state.particles.flocs.forEach(floc => {
    const flocCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    flocCircle.setAttribute('cx', floc.x);
    flocCircle.setAttribute('cy', floc.y);
    flocCircle.setAttribute('r', floc.size);
    flocCircle.setAttribute('fill', floc.type === 'Al' 
      ? 'rgba(200, 200, 220, 0.8)' 
      : 'rgba(180, 130, 100, 0.8)');
    particlesContainer.appendChild(flocCircle);

    floc.attachedImpurities.forEach(imp => {
      const impCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      impCircle.setAttribute('cx', imp.x);
      impCircle.setAttribute('cy', imp.y);
      impCircle.setAttribute('r', imp.size);
      impCircle.setAttribute('fill', 'rgba(80, 60, 40, 0.8)');
      particlesContainer.appendChild(impCircle);
    });
  });

  // Draw bubbles
  state.particles.bubbles.forEach(bubble => {
    const bubbleCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bubbleCircle.setAttribute('cx', bubble.x);
    bubbleCircle.setAttribute('cy', bubble.y);
    bubbleCircle.setAttribute('r', bubble.size);
    bubbleCircle.setAttribute('fill', 'rgba(220, 240, 255, 0.5)');
    bubbleCircle.setAttribute('stroke', 'rgba(150, 200, 255, 0.7)');
    bubbleCircle.setAttribute('stroke-width', '1');
    particlesContainer.appendChild(bubbleCircle);
  });
}

// ========================================
// WATER QUALITY UPDATES (KINETIC MODEL)
// ========================================

function updateWaterQuality() {
  if (!state.running) return;

  // Calculate real elapsed time increment (simulation seconds per real second)
  // At speed 1.0, each real second = 60 simulation seconds (1 minute)
  const simulationSecondsPerTick = 60 * state.speed;
  
  // Track elapsed treatment time (in simulation seconds)
  state.elapsedTreatmentTime += simulationSecondsPerTick / 60; // Adjusting for ~60 FPS
  
  // ========================================
  // KINETIC MODEL: Calculate current charge loading
  // ========================================
  const prediction = predictWaterQualityAtTime(state.elapsedTreatmentTime);
  state.chargeLoading = prediction.Q;
  state.turbidity = prediction.predictedTurbidity;
  state.clarity = prediction.predictedClarity;
  state.phLevel = prediction.predictedPH;
  state.currentTSS = prediction.predictedTSS;

  // Anode dissolves using Faraday's Law
  // Calculate mass loss in grams
  const massLossGrams = (state.current * state.elapsedTreatmentTime * KINETIC_CONSTANTS.Al_MOLAR_MASS) / 
                        (KINETIC_CONSTANTS.Al_VALENCE * KINETIC_CONSTANTS.F);
  // Approximate thickness loss (assuming electrode density ~2.7 g/cm³)
  const volumeLossCm3 = massLossGrams / 2.7;
  const thicknessLoss = volumeLossCm3 / state.electrodeArea;
  state.anodeThickness = Math.max(0.2, 1.0 - thicknessLoss * 100); // Scaled for visualization
  
  // Trigger quality update animation every 500ms
  if (Math.floor(state.elapsedTreatmentTime * 10) % 5 === 0) {
    if (typeof anime !== 'undefined') {
      animateWaterQualityUpdate();
      animatePredictionCountdown();
    }
  }
  
  // Check if treatment is complete
  checkTreatmentCompletion();
  
  updatePredictionDisplay();
}

// ========================================
// CONTROL HANDLERS
// ========================================

function setupEventListeners() {
  document.getElementById('currentSlider').addEventListener('input', (e) => {
    state.current = parseFloat(e.target.value);
    document.getElementById('currentValue').textContent = state.current.toFixed(1) + ' A';
    calculateTreatmentTime();
  });

  document.getElementById('waterVolume').addEventListener('input', (e) => {
    state.waterVolume = Math.max(0.5, Math.min(5, parseFloat(e.target.value) || 2));
    updateBeakerVisualization();
    calculateTreatmentTime();
  });

  // Electrode Area Event Listener
  document.getElementById('electrodeAreaSlider').addEventListener('input', (e) => {
    state.electrodeArea = parseFloat(e.target.value);
    document.getElementById('electrodeAreaValue').textContent = state.electrodeArea + ' cm²';
    calculateTreatmentTime();
  });

  // Water Quality Parameter Event Listeners
  document.getElementById('phSlider').addEventListener('input', (e) => {
    state.initialPH = parseFloat(e.target.value);
    document.getElementById('phInputValue').textContent = state.initialPH.toFixed(1);
    calculateTreatmentTime();
  });

  document.getElementById('turbiditySlider').addEventListener('input', (e) => {
    state.initialTurbidity = parseFloat(e.target.value);
    document.getElementById('turbidityInputValue').textContent = state.initialTurbidity + ' NTU';
    calculateTreatmentTime();
  });

  document.getElementById('tssSlider').addEventListener('input', (e) => {
    state.initialTSS = parseFloat(e.target.value);
    document.getElementById('tssInputValue').textContent = state.initialTSS + ' mg/L';
    calculateTreatmentTime();
  });

  document.getElementById('conductivitySlider').addEventListener('input', (e) => {
    state.conductivity = parseFloat(e.target.value);
    document.getElementById('conductivityInputValue').textContent = state.conductivity + ' µS/cm';
    calculateTreatmentTime();
  });

  document.getElementById('o2Slider').addEventListener('input', (e) => {
    state.initialO2 = parseFloat(e.target.value);
    document.getElementById('o2InputValue').textContent = state.initialO2.toFixed(1) + ' mg/L';
    calculateTreatmentTime();
  });

  // Check Time Button Handler - Using Kinetic Model
  document.getElementById('checkTimeBtn').addEventListener('click', () => {
    const timeValue = parseFloat(document.getElementById('checkTimeValue').value) || 60;
    const timeUnit = document.getElementById('checkTimeUnit').value;
    
    // Convert to seconds
    let checkTimeSeconds = timeUnit === 'hours' ? timeValue * 3600 : timeValue * 60;
    
    // ========================================
    // KINETIC MODEL CALCULATIONS
    // ========================================
    
    // Calculate charge loading at the given time (C/L)
    const prediction = predictWaterQualityAtTime(checkTimeSeconds);
    const Q = prediction.Q;
    
    // Calculate progress percentage based on charge loading
    const progressPercent = Math.min(100, (Q / state.targetChargeLoading) * 100);
    
    // Calculate aluminum dosage at this time (mg/L)
    const alDosage = calculateAluminumDosage(checkTimeSeconds);
    
    const predictedTurbidity = prediction.predictedTurbidity;
    const predictedTSS = prediction.predictedTSS;
    const predictedClarity = prediction.predictedClarity;
    const predictedPH = prediction.predictedPH;
    const predictedConductivity = prediction.predictedConductivity;
    const predictedO2 = prediction.predictedO2;
    
    // Display results
    const timeDisplay = timeUnit === 'hours' 
      ? `${timeValue}h` 
      : `${timeValue}m`;
    
    document.getElementById('checkedTimeDisplay').textContent = timeDisplay;
    document.getElementById('checkTurbidity').textContent = predictedTurbidity.toFixed(1) + '%';
    document.getElementById('checkClarity').textContent = predictedClarity.toFixed(1) + '%';
    document.getElementById('checkPH').textContent = predictedPH.toFixed(2);
    document.getElementById('checkTSS').textContent = Math.round(predictedTSS) + ' mg/L';
    document.getElementById('checkConductivity').textContent = Math.round(predictedConductivity) + ' µS/cm';
    document.getElementById('checkO2').textContent = predictedO2.toFixed(1) + ' mg/L';
    document.getElementById('checkProgressPercent').textContent = progressPercent.toFixed(1) + '%';
    
    document.getElementById('timeCheckResults').style.display = 'block';
  });

  const calibrateApplyBtn = document.getElementById('calibrateApplyBtn');
  if (calibrateApplyBtn) {
    calibrateApplyBtn.addEventListener('click', () => {
      try {
        const calibrationInput = document.getElementById('calibrationDataInput');
        const inputText = calibrationInput ? calibrationInput.value : '';
        const runs = parseCalibrationDataset(inputText);
        const fittedResult = fitKineticConstantsFromRuns(runs);
        applyCalibrationResult(fittedResult);
        updateCalibrationResultDisplay(fittedResult);
        setCalibrationStatus(`Calibration applied from ${fittedResult.runCount} runs.`, 'success');
      } catch (error) {
        setCalibrationStatus(error.message, 'error');
      }
    });
  }

  const calibrateSampleBtn = document.getElementById('calibrateSampleBtn');
  if (calibrateSampleBtn) {
    calibrateSampleBtn.addEventListener('click', () => {
      const calibrationInput = document.getElementById('calibrationDataInput');
      if (calibrationInput) {
        calibrationInput.value = getCalibrationSampleData();
      }
      setCalibrationStatus('Sample calibration runs loaded. Click Fit & Apply.', 'info');
    });
  }

  document.getElementById('speedSlider').addEventListener('input', (e) => {
    state.speed = parseFloat(e.target.value);
    document.getElementById('speedValue').textContent = state.speed.toFixed(1) + 'x';
  });

  document.getElementById('startBtn').addEventListener('click', () => {
    state.running = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    
    // Show calculating overlays for both sections
    document.getElementById('predictionSubtitle').textContent = 'Calculating...';
    document.getElementById('timeCalculatingOverlay').style.display = 'flex';
    document.getElementById('timeResults').style.display = 'none';
    
    document.getElementById('qualitySubtitle').textContent = 'Analyzing water sample...';
    document.getElementById('calculatingOverlay').style.display = 'flex';
    document.getElementById('qualityResults').style.display = 'none';
    
    // After 2 seconds, show treatment time
    setTimeout(() => {
      document.getElementById('timeCalculatingOverlay').style.display = 'none';
      document.getElementById('timeResults').style.display = 'block';
      document.getElementById('predictionSubtitle').textContent = 'Based on current parameters:';
      showPredictedTime();
    }, 2000);
    
    // After 3 seconds, show water quality results
    setTimeout(() => {
      document.getElementById('calculatingOverlay').style.display = 'none';
      document.getElementById('qualityResults').style.display = 'block';
      document.getElementById('qualitySubtitle').textContent = 'After treatment completion:';
      showPredictedResults();
    }, 3000);
  });

  document.getElementById('pauseBtn').addEventListener('click', () => {
    state.running = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    state.running = false;
    state.time = 0;
    state.turbidity = Math.min(95, state.initialTurbidity / 5);
    state.clarity = 100 - state.turbidity;
    state.phLevel = state.initialPH;
    state.anodeThickness = 1.0;
    state.elapsedTreatmentTime = 0;
    state.isTreated = false;
    state.particles.ions = [];
    state.particles.flocs = [];
    state.particles.bubbles = [];
    
    initializeImpurities();
    calculateTreatmentTime();
    updateBeakerVisualization();
    drawParticlesSVG();
    
    // Reset treatment time section to initial state
    document.getElementById('predictionSubtitle').textContent = 'Click Start to calculate';
    document.getElementById('timeCalculatingOverlay').style.display = 'none';
    document.getElementById('timeResults').style.display = 'none';
    document.getElementById('countdownDisplay').textContent = '--';
    
    // Reset water quality section to initial state
    document.getElementById('qualitySubtitle').textContent = 'Click Start to analyze water sample';
    document.getElementById('calculatingOverlay').style.display = 'none';
    document.getElementById('qualityResults').style.display = 'none';
    document.getElementById('turbidityValue').textContent = '--';
    document.getElementById('clarityValue').textContent = '--';
    document.getElementById('phValue').textContent = '--';
    document.getElementById('tssValue').textContent = '--';
    document.getElementById('conductivityValue').textContent = '--';
    document.getElementById('o2Value').textContent = '--';
    document.getElementById('turbidityBar').style.width = '0%';
    document.getElementById('clarityBar').style.width = '0%';
    document.getElementById('tssBar').style.width = '0%';
    document.getElementById('conductivityBar').style.width = '0%';
    document.getElementById('o2Bar').style.width = '0%';
    
    // Reset time check results
    document.getElementById('timeCheckResults').style.display = 'none';

    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
  });
}

// Show predicted treatment time with animation
function showPredictedTime() {
  const hours = Math.floor(state.estimatedTreatmentTime / 3600);
  const minutes = Math.floor((state.estimatedTreatmentTime % 3600) / 60);
  
  // Animate the time display
  const countdownEl = document.getElementById('countdownDisplay');
  let displayHours = 0;
  let displayMinutes = 0;
  const duration = 1500;
  const startTime = performance.now();
  
  function updateTime(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    
    displayHours = Math.round(hours * eased);
    displayMinutes = Math.round(minutes * eased);
    
    if (displayHours > 0) {
      countdownEl.textContent = `${displayHours}h ${displayMinutes}m`;
    } else {
      countdownEl.textContent = `${displayMinutes}m`;
    }
    
    if (progress < 1) {
      requestAnimationFrame(updateTime);
    } else {
      // Final value
      if (hours > 0) {
        countdownEl.textContent = `${hours}h ${minutes}m`;
      } else {
        countdownEl.textContent = `${minutes}m`;
      }
    }
  }
  requestAnimationFrame(updateTime);
}

// Show predicted final water quality with animation
function showPredictedResults() {
  const predicted = predictWaterQualityAtTime(state.estimatedTreatmentTime);
  const predictedTurbidity = predicted.predictedTurbidity;
  const predictedClarity = predicted.predictedClarity;
  const predictedPH = predicted.predictedPH;
  const predictedTSS = predicted.predictedTSS;
  const predictedConductivity = predicted.predictedConductivity;
  const predictedO2 = predicted.predictedO2;
  
  // Animate turbidity
  animateValue('turbidityValue', 0, predictedTurbidity, '%', 800);
  animateProgressBar('turbidityBar', predictedTurbidity, 800);
  
  // Animate clarity
  animateValue('clarityValue', 0, predictedClarity, '%', 1000);
  animateProgressBar('clarityBar', predictedClarity, 1000);
  
  // Animate pH
  animatePHValue('phValue', 7.0, predictedPH, 600);
  const phPercent = (predictedPH / 14) * 100;
  document.getElementById('phMarker').style.left = phPercent + '%';
  
  // Animate TSS (from initial to target low value)
  animateValue('tssValue', state.initialTSS, predictedTSS, ' mg/L', 1200);
  const tssPercent = (predictedTSS / 1000) * 100; // Scale to max 1000 mg/L
  animateProgressBar('tssBar', tssPercent, 1200);
  
  // Animate Conductivity
  animateValue('conductivityValue', state.conductivity, Math.round(predictedConductivity), ' µS/cm', 1400);
  const conductivityPercent = (predictedConductivity / 2000) * 100; // Scale to max 2000 µS/cm
  animateProgressBar('conductivityBar', conductivityPercent, 1400);
  
  // Animate Dissolved O2
  animateValueDecimal('o2Value', state.initialO2, predictedO2, ' mg/L', 1600);
  const o2Percent = (predictedO2 / 14) * 100; // Scale to max 14 mg/L
  animateProgressBar('o2Bar', o2Percent, 1600);
}

function animateValue(elementId, start, end, suffix, duration) {
  const element = document.getElementById(elementId);
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = Math.round(start + (end - start) * eased);
    element.textContent = current + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

function animateProgressBar(elementId, targetWidth, duration) {
  const element = document.getElementById(elementId);
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.style.width = (targetWidth * eased) + '%';
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

function animatePHValue(elementId, start, end, duration) {
  const element = document.getElementById(elementId);
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (end - start) * eased;
    element.textContent = current.toFixed(2);
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

function animateValueDecimal(elementId, start, end, suffix, duration) {
  const element = document.getElementById(elementId);
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = start + (end - start) * eased;
    element.textContent = current.toFixed(1) + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

function updateAnodeInfo() {
  // Fixed Configuration: Al Anode + Fe Cathode
  const anodeLabel = document.querySelector('[data-anode-info]');
  if (anodeLabel) {
    anodeLabel.innerHTML = '<div class="info-equation">Al → Al³⁺ + 3e⁻</div><div class="info-description">Aluminum oxidation (sacrificial anode)</div>';
  }
  
  const cathodeLabel = document.querySelector('[data-cathode-info]');
  if (cathodeLabel) {
    cathodeLabel.innerHTML = '<div class="info-equation">2H₂O + 2e⁻ → H₂ + 2OH⁻</div><div class="info-description">Hydrogen evolution (iron cathode)</div>';
  }
}

// ========================================
// MAIN ANIMATION LOOP
// ========================================

let lastTime = Date.now();

function animate() {
  const now = Date.now();
  const deltaTime = (now - lastTime) / 1000;
  lastTime = now;

  if (state.running) {
    // Accelerate simulation time for demo purposes: speed 1x = 3600x real time
    // This allows 8-hour treatment to complete in ~10 seconds
    const timeAcceleration = 3600; // 1 simulated second = 3600 real seconds
    state.time += deltaTime * timeAcceleration;
    animateParticles();
    updateWaterQuality();
    updateBeakerVisualization();
    drawParticlesSVG();
  }

  requestAnimationFrame(animate);
}

// ========================================
// ANIME.JS ANIMATIONS
// ========================================

function initializeAnimations() {
  // PAGE LOAD ANIMATIONS
  const headerAnimation = anime({
    targets: '.header-card',
    opacity: [0, 1],
    translateY: [-40, 0],
    duration: 800,
    easing: 'easeOutCubic',
    autoplay: false
  });

  const panelsAnimation = anime.timeline({
    autoplay: false
  })
    .add({
      targets: '.left-panel',
      opacity: [0, 1],
      translateY: [40, 0],
      duration: 800,
      easing: 'easeOutCubic'
    }, 100)
    .add({
      targets: '.center-panel',
      opacity: [0, 1],
      translateY: [40, 0],
      duration: 800,
      easing: 'easeOutCubic'
    }, 200)
    .add({
      targets: '.right-panel',
      opacity: [0, 1],
      translateY: [40, 0],
      duration: 800,
      easing: 'easeOutCubic'
    }, 300);

  const cardsAnimation = anime({
    targets: '.card',
    opacity: [0, 1],
    scale: [0.95, 1],
    duration: 600,
    delay: anime.stagger(100, { start: 400 }),
    easing: 'easeOutElastic(1, 0.6)',
    autoplay: false
  });

  headerAnimation.play();
  panelsAnimation.play();
  cardsAnimation.play();

  // SLIDER ANIMATIONS
  const sliders = document.querySelectorAll('.form-range');
  sliders.forEach(slider => {
    slider.addEventListener('input', function() {
      const valueLabel = this.parentElement.querySelector('.slider-value');
      if (valueLabel) {
        anime({
          targets: valueLabel,
          scale: [0.9, 1.1, 1],
          duration: 400,
          easing: 'easeOutElastic(1, 0.6)'
        });
      }
    });
  });

  // BUTTON HOVER ANIMATIONS
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', function() {
      if (!this.disabled) {
        anime({
          targets: this,
          scale: 1.05,
          duration: 300,
          easing: 'easeOutQuad'
        });
      }
    });

    btn.addEventListener('mouseleave', function() {
      if (!this.disabled) {
        anime({
          targets: this,
          scale: 1,
          duration: 300,
          easing: 'easeOutQuad'
        });
      }
    });

    btn.addEventListener('click', function() {
      if (!this.disabled) {
        // Ripple effect
        anime({
          targets: this,
          scale: [1, 1.08, 1],
          boxShadow: [
            '0 8px 24px rgba(0, 255, 136, 0.35)',
            '0 12px 40px rgba(0, 255, 136, 0.6)',
            '0 8px 24px rgba(0, 255, 136, 0.35)'
          ],
          duration: 600,
          easing: 'easeOutQuad'
        });
      }
    });
  });
}

function animateWaterQualityUpdate() {
  // Smooth turbidity bar animation
  const turbidityBar = document.getElementById('turbidityBar');
  if (turbidityBar) {
    const currentWidth = parseFloat(turbidityBar.style.width) || 0;
    const newWidth = state.turbidity;
    
    anime({
      targets: turbidityBar,
      width: newWidth + '%',
      duration: 800,
      easing: 'easeOutQuad'
    });
  }

  // Smooth clarity bar animation
  const clarityBar = document.getElementById('clarityBar');
  if (clarityBar) {
    const newWidth = state.clarity;
    
    anime({
      targets: clarityBar,
      width: newWidth + '%',
      duration: 800,
      easing: 'easeOutQuad'
    });
  }

  // pH marker animation
  const phMarker = document.getElementById('phMarker');
  if (phMarker) {
    const phPercent = (state.phLevel / 14) * 100;
    anime({
      targets: phMarker,
      left: phPercent + '%',
      duration: 1000,
      easing: 'easeOutCubic'
    });
  }

  // Status badge morph
  const badge = document.getElementById('statusBadge');
  if (badge) {
    anime({
      targets: badge,
      scale: [0.95, 1.05, 1],
      duration: 500,
      easing: 'easeOutElastic(1, 0.5)'
    });
  }
}

function animatePredictionCountdown() {
  // Countdown display pulse
  const countdown = document.getElementById('countdownDisplay');
  if (countdown) {
    anime({
      targets: countdown,
      textShadow: [
        '0 0 20px rgba(0, 255, 136, 0.6), 0 0 40px rgba(0, 212, 255, 0.2)',
        '0 0 30px rgba(0, 255, 136, 0.8), 0 0 60px rgba(0, 212, 255, 0.4)',
        '0 0 20px rgba(0, 255, 136, 0.6), 0 0 40px rgba(0, 212, 255, 0.2)'
      ],
      duration: 1500,
      loop: true,
      easing: 'easeInOutQuad'
    });
  }

  // Progress bar fill animation
  const progressFill = document.getElementById('treatmentProgress');
  if (progressFill) {
    const remainingTime = Math.max(0, state.estimatedTreatmentTime - state.elapsedTreatmentTime);
    const progressPercent = (state.elapsedTreatmentTime / state.estimatedTreatmentTime) * 100;
    
    anime({
      targets: progressFill,
      width: Math.min(100, progressPercent) + '%',
      duration: 800,
      easing: 'easeOutQuad'
    });
  }
}

function animateTreatmentCompletion() {
  // Success animation sequence
  const timeline = anime.timeline();

  timeline
    .add({
      targets: '.treatment-status',
      scale: [1, 1.15, 1],
      duration: 600,
      easing: 'easeOutElastic(1, 0.6)'
    }, 0)
    .add({
      targets: '#treatmentProgress',
      width: '100%',
      duration: 600,
      easing: 'easeOutQuad'
    }, 0)
    .add({
      targets: '.progress-fill-large',
      boxShadow: [
        '0 0 20px rgba(0, 212, 255, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
        '0 0 40px rgba(0, 255, 136, 0.8), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
        '0 0 20px rgba(0, 255, 136, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.2)'
      ],
      duration: 1200,
      easing: 'easeInOutQuad',
      loop: 2
    }, 0);
}

// ========================================
// INITIALIZATION
// ========================================

function init() {
  // Ensure simulation is stopped on page load
  state.running = false;
  
  initializeImpurities();
  calculateTreatmentTime();
  updateBeakerVisualization();
  updatePredictionDisplay();
  updateFactorsDisplay();
  setCalibrationStatus('No calibration applied yet.', 'info');
  updateAnodeInfo();
  drawParticlesSVG(); // Draw initial impurities
  setupEventListeners();
  
  // Ensure buttons are in correct initial state
  document.getElementById('startBtn').disabled = false;
  document.getElementById('pauseBtn').disabled = true;
  
  // Initialize animations (wrapped in try-catch to prevent errors)
  try {
    if (typeof anime !== 'undefined') {
      initializeAnimations();
    }
  } catch (e) {
    console.log('Animation init skipped:', e);
  }
  
  console.log('Init complete, starting animation loop');
  animate();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
