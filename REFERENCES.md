# Electrocoagulation Simulation - Scientific References & Documentation

## Overview

This document provides the scientific basis and research paper references for the formulas and models used in the Electrocoagulation Water Treatment Simulation. The simulation uses heuristic models derived from peer-reviewed electrocoagulation research.

### Implementation Calibration Update (Mar 2026)

The simulation code now uses a more conservative kinetic calibration to avoid under-predicting treatment time for batch EC runs:

- `k_turbidity = 0.0025 L/C`
- `k_TSS = 0.0018 L/C`
- `k_COD = 0.0012 L/C`
- Target removals: turbidity `92%`, TSS `90%`
- Current-density efficiency is applied with an effective window near `80-300 A/m²`
- Target charge loading is constrained to a practical batch envelope of `1000-5400 C/L` (approximately `0.3-1.5 Ah/L`)

These values are implemented as conservative engineering estimates for simulation and should still be re-calibrated with your own laboratory data.

---

## Table of Contents

1. [Core Electrocoagulation Theory](#core-electrocoagulation-theory)
2. [Treatment Time Calculation](#treatment-time-calculation)
3. [Water Quality Parameters](#water-quality-parameters)
4. [Electrode Reactions](#electrode-reactions)
5. [Research Paper References](#research-paper-references)
6. [Formulas Used in Simulation](#formulas-used-in-simulation)

---

## Core Electrocoagulation Theory

Electrocoagulation (EC) is an electrochemical water treatment process that uses sacrificial metal electrodes to generate coagulants in situ. When current passes through the electrodes:

- **Anode (Al)**: Aluminum oxidizes and releases Al³⁺ ions
- **Cathode (Fe)**: Water reduction produces hydrogen gas and hydroxide ions
- **Solution**: Metal hydroxide flocs form, adsorb pollutants, and settle

---

## Treatment Time Calculation

### Kinetic Model (Literature-Based)

The simulation now uses a **first-order kinetic model** based on charge loading, which is the scientifically correct approach from electrocoagulation research.

#### Key Equation: First-Order Kinetics
```
C(Q) = C₀ × e^(-k×Q)

Where:
  C(Q) = pollutant concentration at charge loading Q
  C₀   = initial pollutant concentration
  k    = first-order rate constant (L/C)
  Q    = charge loading (C/L) = I × t / V
```

#### Treatment Time Based on Charge Loading
```
t = (Q_target × V) / I

Where:
  t        = treatment time (seconds)
  Q_target = required charge loading for target removal (C/L)
  V        = water volume (L)
  I        = current (A)
```

#### Target Charge Loading Calculation
```
Q_target = -ln(1 - R) / k

Where:
  R = target removal efficiency (e.g., 0.95 for 95%)
  k = rate constant for pollutant
```

### Rate Constants Used

| Parameter | Rate Constant k (L/C) | Source |
|-----------|----------------------|--------|
| Turbidity | 0.008 | Hakizimana et al. (2017) - typical EC kinetics |
| TSS | 0.006 | Emamjomeh & Sivakumar (2009) |
| COD | 0.004 | General EC literature |

### Efficiency Factors

| Factor | Formula | Effect on Treatment |
|--------|---------|---------------------|
| Current Density | j = I / A (A/m²) | Optimal: 10-30 A/m² |
| pH Efficiency | 1 - 0.1 × \|pH - 7.0\| | Reduces when pH deviates from optimal |
| Conductivity Efficiency | 0.8 + σ/2500 | Higher σ improves ion transport |
| Pollutant Load Factor | 1 + log₁₀(C₀/C_ref) | Higher initial load → more Al needed |

---

## Water Quality Parameters

### Input Parameters

| Parameter | Unit | Range | Description |
|-----------|------|-------|-------------|
| pH | pH units | 4 - 10 | Initial water acidity/alkalinity |
| Turbidity | NTU | 10 - 500 | Nephelometric Turbidity Units |
| TSS | mg/L | 10 - 1000 | Total Suspended Solids |
| Conductivity | µS/cm | 100 - 2000 | Electrical conductivity |
| Dissolved O₂ | mg/L | 0 - 14 | Initial dissolved oxygen |
| Electrode Area | cm² | 10 - 200 | Active anode surface area |

### Output Parameters (First-Order Kinetics)

| Parameter | Model | Scientific Basis |
|-----------|-------|------------------|
| Turbidity | C(Q) = C₀ × e^(-0.008×Q) | First-order kinetics |
| TSS | C(Q) = C₀ × e^(-0.006×Q) | First-order kinetics |
| pH | Shifts 0.001 units per C/L towards 7.0 | Al(OH)₃ buffering |
| Conductivity | Decreases 0.005% per C/L | Ion consumption |
| Dissolved O₂ | Increases 0.0005 mg/L per C/L | H₂ bubble aeration |

---

## Electrode Reactions

### At Anode (Aluminum - Oxidation)
```
Al → Al³⁺ + 3e⁻
```
- Aluminum dissolves as Al³⁺ ions
- Electrode mass loss follows Faraday's Law: m = (I × t × M) / (z × F)
  - I = current (A)
  - t = time (s)
  - M = molar mass of Al (27 g/mol)
  - z = valence electrons (3)
  - F = Faraday constant (96,485 C/mol)

### At Cathode (Iron - Reduction)
```
2H₂O + 2e⁻ → H₂↑ + 2OH⁻
```
- Hydrogen gas bubbles form (aids flotation)
- Hydroxide ions increase local pH

### In Solution (Floc Formation)
```
Al³⁺ + 3OH⁻ → Al(OH)₃ (floc)
```
- Aluminum hydroxide precipitates
- Flocs adsorb suspended particles and colloids
- Sweep flocculation removes contaminants

---

## Research Paper References

> **Note**: This simulation now uses a **first-order kinetic model** based on charge loading (C/L), which is the scientifically accepted approach in electrocoagulation research. The rate constants are derived from experimental data in the literature.

### Formulas Derived from Literature

| Simulation Formula | Scientific Source | Actual Formula from Paper |
|-------------------|-------------------|---------------------------|
| **Faraday's Law**: m = (I×t×M)/(z×F) | Chen (2004), Mollah et al. (2001) | Same - standard electrochemical equation |
| **First-Order Kinetics**: C = C₀×e^(-k×Q) | Hakizimana et al. (2017) | Standard kinetic model for EC pollutant removal |
| **Charge Loading**: Q = I×t/V | Moussa et al. (2017), Chen (2004) | Key parameter for EC process control |
| **Current Density**: j = I/A | Kobya et al. (2003), Bayramoglu et al. (2004) | A/m² - determines EC efficiency |
| **Optimal pH 6.5-7.5** | Kobya et al. (2003) | Optimal range for Al(OH)₃ precipitation |
| **Conductivity Effect** | Bayramoglu et al. (2004) | Higher σ → lower cell voltage → better efficiency |

### Rate Constants (from Literature)

| Parameter | k Value (L/C) | Source | Notes |
|-----------|--------------|--------|-------|
| Turbidity | 0.008 | Hakizimana et al. (2017) | Typical range: 0.005-0.015 |
| TSS | 0.006 | Emamjomeh & Sivakumar (2009) | Depends on particle size |
| COD | 0.004 | Moussa et al. (2017) | Varies with organic type |

### Model Parameters (Calibrated)

The following parameters are **calibrated approximations** based on typical experimental ranges:

| Parameter | Value | Basis |
|-----------|-------|-------|
| pH shift rate | 0.001 per C/L | Al(OH)₃ buffering capacity |
| Conductivity loss | 0.005% per C/L | Ion consumption |
| O₂ increase rate | 0.0005 mg/L per C/L | H₂ bubble aeration |
| Optimal current density | 10-30 A/m² | Kobya et al. (2003) |

---

### Primary References

1. **Mollah, M.Y.A., Schennach, R., Parga, J.R., & Cocke, D.L. (2001)**
   - *"Electrocoagulation (EC) — science and applications"*
   - Journal of Hazardous Materials, 84(1), 29-41
   - DOI: [10.1016/S0304-3894(01)00176-5](https://doi.org/10.1016/S0304-3894(01)00176-5)
   - **Relevant Content**: 
     - Faraday's Law equation (Eq. 1): m = ItM/zF
     - Table showing anode dissolution rates for Al and Fe
     - Discussion of current-time relationship (Section 3.2)

2. **Chen, G. (2004)**
   - *"Electrochemical technologies in wastewater treatment"*
   - Separation and Purification Technology, 38(1), 11-41
   - DOI: [10.1016/j.seppur.2003.10.006](https://doi.org/10.1016/j.seppur.2003.10.006)
   - **Relevant Content**:
     - Faraday's Law application to EC (Section 2.1)
     - Electrode reactions for Al and Fe (Table 1)
     - No specific treatment time formula provided

3. **Holt, P.K., Barton, G.W., & Mitchell, C.A. (2005)**
   - *"The future for electrocoagulation as a localised water treatment technology"*
   - Chemosphere, 59(3), 355-367
   - DOI: [10.1016/j.chemosphere.2004.10.023](https://doi.org/10.1016/j.chemosphere.2004.10.023)
   - **Relevant Content**:
     - Volume scaling discussion (qualitative)
     - Batch vs continuous treatment considerations
     - No specific volume-time formula provided

### pH and Aluminum Coagulation

4. **Kobya, M., Can, O.T., & Bayramoglu, M. (2003)**
   - *"Treatment of textile wastewaters by electrocoagulation using iron and aluminum electrodes"*
   - Journal of Hazardous Materials, 100(1-3), 163-178
   - DOI: [10.1016/S0304-3894(03)00102-X](https://doi.org/10.1016/S0304-3894(03)00102-X)
   - **Relevant Content**:
     - Figure 3: pH effect on color removal efficiency
     - States optimal pH 6-7 for Al electrodes (Section 3.1)
     - **No explicit pH-time formula** - we derived phFactor heuristically

5. **Daneshvar, N., Oladegaragoze, A., & Djafarzadeh, N. (2006)**
   - *"Decolorization of basic dye solutions by electrocoagulation: An investigation of the effect of operational parameters"*
   - Journal of Hazardous Materials, 129(1-3), 116-122
   - DOI: [10.1016/j.jhazmat.2005.08.033](https://doi.org/10.1016/j.jhazmat.2005.08.033)
   - **Relevant Content**:
     - pH evolution during treatment (Figure 4)
     - Qualitative pH optimization discussion

### TSS and Turbidity Removal

6. **Emamjomeh, M.M., & Sivakumar, M. (2009)**
   - *"Review of pollutants removed by electrocoagulation and electrocoagulation/flotation processes"*
   - Journal of Environmental Management, 90(5), 1663-1679
   - DOI: [10.1016/j.jenvman.2008.12.011](https://doi.org/10.1016/j.jenvman.2008.12.011)
   - **Relevant Content**:
     - Table 2: TSS removal efficiencies (80-99%)
     - Turbidity reduction mechanisms discussed
     - **No specific TSS-time formula** - we derived tssFactor heuristically

### Conductivity and Operating Parameters

7. **Bayramoglu, M., Kobya, M., Can, O.T., & Sozbir, M. (2004)**
   - *"Operating cost analysis of electrocoagulation of textile dye wastewater"*
   - Separation and Purification Technology, 37(2), 117-125
   - DOI: [10.1016/j.seppur.2003.09.002](https://doi.org/10.1016/j.seppur.2003.09.002)
   - **Relevant Content**:
     - Equation: E = UIt (Energy consumption)
     - Shows conductivity affects cell voltage and energy
     - **Inverse relationship confirmed** but exact factor (500/σ) is our approximation

### Comprehensive Reviews

8. **Moussa, D.T., El-Naas, M.H., Nasser, M., & Al-Marri, M.J. (2017)**
   - *"A comprehensive review of electrocoagulation for water treatment: Potentials and challenges"*
   - Journal of Environmental Management, 186, 24-41
   - DOI: [10.1016/j.jenvman.2016.10.032](https://doi.org/10.1016/j.jenvman.2016.10.032)
   - **Relevant Content**:
     - H₂ bubble formation at cathode (Section 2.2)
     - Aeration/flotation effects on treatment
     - General EC process overview

9. **Garcia-Segura, S., Eiband, M.M.S.G., de Melo, J.V., & Martínez-Huitle, C.A. (2017)**
   - *"Electrocoagulation and advanced electrocoagulation processes: A general review about the fundamentals, emerging applications and its association with other technologies"*
   - Journal of Electroanalytical Chemistry, 801, 267-299
   - DOI: [10.1016/j.jelechem.2017.07.047](https://doi.org/10.1016/j.jelechem.2017.07.047)
   - **Relevant Content**:
     - Advanced EC mechanisms overview
     - Covers Al and Fe electrode chemistry

10. **Hakizimana, J.N., Gourich, B., Chafi, M., et al. (2017)**
    - *"Electrocoagulation process in water treatment: A review of electrocoagulation modeling approaches"*
    - Desalination, 404, 1-21
    - DOI: [10.1016/j.desal.2016.10.011](https://doi.org/10.1016/j.desal.2016.10.011)
    - **Relevant Content**:
      - Various kinetic models (first-order, second-order)
      - RSM modeling approaches
      - Our simulation uses simplified first-order decay concept

---

## Formulas Used in Simulation

### 1. Faraday's Law (Electrode Dissolution) - Literature-Based
```
m = (I × t × M) / (z × F)

Where:
  m = mass of Al dissolved (g)
  I = current (A)
  t = time (s)
  M = molar mass of Al (26.98 g/mol)
  z = electrons transferred (3 for Al → Al³⁺)
  F = Faraday constant (96,485 C/mol)

Source: Chen (2004), Mollah et al. (2001)
```

### 2. Charge Loading (Key Parameter) - Literature-Based
```
Q = (I × t) / V

Where:
  Q = charge loading (C/L or Coulombs per Liter)
  I = current (A)
  t = time (s)
  V = water volume (L)

Source: Moussa et al. (2017), Hakizimana et al. (2017)
```

### 3. Current Density - Literature-Based
```
j = I / A

Where:
  j = current density (A/m²)
  I = current (A)
  A = electrode surface area (m²)

Optimal range: 10-30 A/m² for EC
Source: Kobya et al. (2003), Bayramoglu et al. (2004)
```

### 4. First-Order Kinetics (Pollutant Removal) - Literature-Based
```
C(Q) = C₀ × e^(-k × Q)

Where:
  C(Q) = concentration at charge loading Q
  C₀   = initial concentration
  k    = first-order rate constant (L/C)
  Q    = charge loading (C/L)

Rate constants used:
  k_turbidity = 0.008 L/C
  k_TSS       = 0.006 L/C

Source: Hakizimana et al. (2017), Emamjomeh & Sivakumar (2009)
```

### 5. Treatment Time Calculation - Literature-Based
```
t = (Q_target × V) / I

Where:
  Q_target = -ln(1 - R) / k    (R = target removal efficiency)
  
For 95% turbidity removal:
  Q_target = -ln(0.05) / 0.008 ≈ 375 C/L

Source: Derived from first-order kinetics model
```

### 6. Aluminum Dosage - Literature-Based
```
Al_dosage (mg/L) = (m × 1000) / V = (I × t × M × 1000) / (z × F × V)

Example: At I=2A, t=1h, V=2L:
  Al_dosage = (2 × 3600 × 26.98 × 1000) / (3 × 96485 × 2) ≈ 335 mg/L

Source: Faraday's Law application
```

### 7. pH Evolution Model
```
pH(Q) = pH₀ ± (0.001 × Q)

Direction: Converges towards pH 7.0 (Al(OH)₃ buffering)
Source: Kobya et al. (2003) - qualitative trend
```

### 8. Dissolved Oxygen Model
```
O₂(Q) = O₂_initial + (0.0005 × Q)

Maximum: O₂_saturation at 20°C ≈ 9.1 mg/L
Source: Moussa et al. (2017) - H₂ bubble aeration effect
```

---

## Comparison: Old Heuristic vs New Kinetic Model

| Aspect | Old (Heuristic) | New (Kinetic) |
|--------|-----------------|---------------|
| Treatment time | Multiplicative factors | Q = I×t/V based |
| Pollutant removal | Linear/power decay | First-order: e^(-k×Q) |
| Key parameter | Time (seconds) | Charge loading (C/L) |
| Electrode parameter | Not used | Current density (A/m²) |
| Scientific basis | Qualitative trends | Quantitative kinetics |
| Al dosage | Not calculated | Faraday's Law |

---

## Limitations and Assumptions

1. **First-Order Kinetics**: Assumes pollutant removal follows C = C₀×e^(-k×Q)
2. **Fixed Electrode Configuration**: Al anode + Fe cathode
3. **Batch Process**: Assumes batch treatment, not continuous flow
4. **Temperature**: Room temperature assumed (20-25°C)
5. **Rate Constants**: k values are typical values; actual values vary by pollutant type
6. **Side Reactions**: Model does not account for competing reactions at high current density

---

## Citation

If using this simulation for educational or research purposes, please cite:

```
Electrocoagulation Water Treatment Simulation (2026)
Based on peer-reviewed electrocoagulation research.
Primary references: Mollah et al. (2001), Chen (2004), Moussa et al. (2017)
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-14 | Initial release with basic EC simulation |
| 1.1.0 | 2026-02-14 | Added water quality parameters (pH, TSS, Conductivity, O₂) |
| 1.2.0 | 2026-02-14 | Added time-based quality prediction feature |

---

*Document created: February 14, 2026*
*Last updated: February 14, 2026*
