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
  
  // Treatment time prediction
  estimatedTreatmentTime: 0,
  elapsedTreatmentTime: 0,
  isTreated: false,
  
  particles: {
    ions: [],
    flocs: [],
    bubbles: [],
    impurities: []
  }
};

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
// TREATMENT TIME PREDICTION (HEURISTIC MODEL)
// ========================================

function calculateTreatmentTime() {
  // Heuristic electrocoagulation model with Fixed Al Anode + Fe Cathode
  // Based on: current, volume, initial turbidity, pH
  
  // Base time (hours) for 2L at 2A with Aluminum anode at high turbidity
  // Realistic electrocoagulation typically takes 4-24 hours depending on conditions
  const baseTime = 8 * 3600; // 8 hours baseline in seconds
  
  // FACTOR 1: Current Effect (inverse relationship - higher current = faster)
  // Normalized to 2A baseline
  const currentFactor = 2.0 / state.current;
  
  // FACTOR 2: Volume Effect (linear relationship)
  // Normalized to 2L baseline
  const volumeFactor = state.waterVolume / 2.0;
  
  // FACTOR 3: Aluminum Anode Fixed (optimal for floc generation)
  // Aluminum is highly efficient for coagulation
  const anodeFactor = 1.0; // Aluminum is standard (no variation)
  
  // FACTOR 4: Turbidity/Contamination (higher turbidity = longer treatment)
  // Normalized to 95% initial turbidity
  const turbidityFactor = (state.turbidity / 95) * 0.8 + 0.2; // Range: 0.2 to 1.0
  
  // FACTOR 5: pH Distance from neutral (affects coagulation)
  // Neutral pH (7.0) is optimal; further away = longer treatment
  const phDev = Math.abs(state.phLevel - 7.0);
  const phFactor = 1.0 + (phDev * 0.08);
  
  // Calculated treatment time in seconds
  const calculatedTime = baseTime * currentFactor * volumeFactor * anodeFactor * turbidityFactor * phFactor;
  
  // Store factors for UI display
  state.treatmentTimeFactors = {
    current: currentFactor.toFixed(2),
    volume: volumeFactor.toFixed(2),
    anode: anodeFactor.toFixed(2),
    turbidity: turbidityFactor.toFixed(2),
    ph: phFactor.toFixed(2)
  };
  
  state.estimatedTreatmentTime = Math.max(3600, calculatedTime); // Minimum 1 hour
  state.elapsedTreatmentTime = 0;
  state.isTreated = false;
  
  updatePredictionDisplay();
  updateFactorsDisplay();
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
  document.getElementById('factorCurrent').textContent = (2.0 / state.current).toFixed(2) + 'x';
  document.getElementById('factorVolume').textContent = (state.waterVolume / 2.0).toFixed(2) + 'x';
  document.getElementById('factorAnode').textContent = 'Aluminum (Sacrificial)';
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
// WATER QUALITY UPDATES
// ========================================

function updateWaterQuality() {
  if (!state.running) return;

  const treatmentRate = state.current * 0.4 * state.speed;

  // Turbidity decreases
  if (state.turbidity > 5) {
    state.turbidity = Math.max(5, state.turbidity - treatmentRate * 0.08);
  }

  // Clarity increases
  if (state.clarity < 95) {
    state.clarity = Math.min(95, state.clarity + treatmentRate * 0.08);
  }

  // pH adjusts for Aluminum anode (FIXED: Always Al)
  // Aluminum oxidation lowers pH
  if (state.phLevel > 6.5) state.phLevel -= 0.003 * state.speed;

  // Anode dissolves (Aluminum anode erosion)
  if (state.anodeThickness > 0.2) {
    state.anodeThickness -= 0.00015 * state.current * state.speed;
  }

  // Track elapsed treatment time (in seconds)
  state.elapsedTreatmentTime += (treatmentRate / 10) * state.speed;
  
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
    state.turbidity = 95;
    state.clarity = 5;
    state.phLevel = 7.0;
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
    document.getElementById('turbidityBar').style.width = '0%';
    document.getElementById('clarityBar').style.width = '0%';

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
  const predictedTurbidity = 5;
  const predictedClarity = 95;
  const predictedPH = 6.8;
  
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
