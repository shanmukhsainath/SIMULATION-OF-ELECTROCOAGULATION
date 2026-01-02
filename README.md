# ⚡ Electrocoagulation Water Treatment Simulation

A realistic web-based visualization of the electrocoagulation water treatment process, featuring real-time particle animations and treatment time predictions.

![Electrocoagulation Simulation](https://img.shields.io/badge/Status-Active-brightgreen) ![Version](https://img.shields.io/badge/Version-1.0.0-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

##  Overview

This interactive simulation demonstrates the electrocoagulation process for water purification using a **fixed electrode configuration**:
- **Anode**: Aluminum (Al) - Sacrificial electrode that dissolves to form coagulants
- **Cathode**: Iron (Fe) - Produces hydrogen gas through water reduction

## Features

###  Realistic Visualization
- SVG-based beaker with animated water and electrodes
- Real-time particle animations:
  - **Al³⁺ ions** released from anode (blue particles)
  - **H₂ bubbles** rising from cathode (white bubbles)
  - **Flocs** forming and capturing impurities
  - **Impurities** being removed from water

### Treatment Time Prediction
- Heuristic model based on electrocoagulation physics
- Factors considered:
  - Current intensity (1.0 - 5.0 A)
  - Water volume (0.5 - 5.0 L)
  - Initial turbidity level
  - pH conditions
- Realistic treatment times (hours/days, not minutes)

### Water Quality Prediction
- **Turbidity**: Predicted reduction to ~5%
- **Water Clarity**: Expected improvement to ~95%
- **pH Level**: Optimized to ~6.8

### Premium UI/UX
- Glassmorphism design with gradient backgrounds
- Smooth animations powered by anime.js
- Responsive layout for all screen sizes
- Interactive controls with real-time feedback

##  Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. **Clone or download** the project folder

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to `http://127.0.0.1:3000`

## Project Structure

```
ELECTROLYSIS SIMULATION/
├── index.html      # Main HTML structure
├── style.css       # Glassmorphism styling & animations
├── app.js          # Core simulation logic & particle physics
├── package.json    # npm configuration
└── README.md       # Project documentation
```

## How to Use

1. **Adjust Parameters** (Left Panel):
   - **Current**: Set the electrical current (1.0 - 5.0 A)
   - **Water Volume**: Enter the volume to treat (0.5 - 5.0 L)
   - **Simulation Speed**: Control animation speed (0.5x - 3.0x)

2. **Click Start**:
   - Watch the "Calculating..." animation
   - Treatment time prediction appears after 2 seconds
   - Water quality prediction appears after 3 seconds

3. **Observe the Simulation**:
   - Watch ions release from the aluminum anode
   - See hydrogen bubbles rise from the iron cathode
   - Observe flocs forming and capturing impurities

4. **Controls**:
   - **Start**: Begin the simulation
   - **Pause**: Pause the simulation
   - **Reset**: Reset to initial state

##  Electrochemistry

### At Anode (Aluminum - Oxidation)
```
Al → Al³⁺ + 3e⁻
```
Aluminum dissolves, releasing Al³⁺ ions that form aluminum hydroxide coagulants.

### At Cathode (Iron - Reduction)
```
2H₂O + 2e⁻ → H₂↑ + 2OH⁻
```
Water is reduced, producing hydrogen gas bubbles and hydroxide ions.

### Coagulation Process
```
Al³⁺ + 3OH⁻ → Al(OH)₃ (flocs)
```
Aluminum ions combine with hydroxide ions to form aluminum hydroxide flocs that capture impurities.

##  Technical Details

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Animation Library**: anime.js v3.2.1
- **Rendering**: SVG-based particle system
- **Server**: http-server (development)

##  Treatment Time Model

The simulation uses a heuristic model with the following base assumptions:
- **Base treatment time**: 8 hours for 2L at 2A
- **Current factor**: Inverse relationship (higher current = faster treatment)
- **Volume factor**: Linear relationship (more volume = longer treatment)
- **Turbidity factor**: Higher contamination requires more time
- **pH factor**: Deviation from neutral pH increases treatment time

## 🧪 How Predictions Work (Heuristic Model)

> ⚠️ **Important**: This simulation uses a **mathematical heuristic model**, NOT real sensor data or machine learning.

### Treatment Time Calculation

The time is calculated using a formula based on known electrocoagulation principles:

```javascript
// Base time: 8 hours (typical for electrocoagulation at standard conditions)
const baseTime = 8 * 3600; // 8 hours in seconds

// Factor 1: Current (higher current = faster treatment)
const currentFactor = 2.0 / state.current;  // Inverse relationship

// Factor 2: Volume (more water = longer time)
const volumeFactor = state.waterVolume / 2.0;  // Linear relationship

// Factor 3: Turbidity (dirtier water = longer time)
const turbidityFactor = (state.turbidity / 95) * 0.8 + 0.2;

// Factor 4: pH deviation from neutral (affects efficiency)
const phFactor = 1.0 + (Math.abs(state.phLevel - 7.0) * 0.08);

// Final calculation
estimatedTime = baseTime × currentFactor × volumeFactor × turbidityFactor × phFactor
```

The **8-hour base time** comes from research showing typical electrocoagulation treatments take 4-24 hours depending on conditions.

### Water Quality Predictions

The water quality values are **fixed target values** representing typical electrocoagulation efficiency:

| Parameter | Predicted Value | Scientific Basis |
|-----------|----------------|------------------|
| Turbidity | **5%** | EC typically achieves 90-95% turbidity removal |
| Clarity | **95%** | Inverse of turbidity |
| pH | **6.8** | EC tends to neutralize pH toward 6.5-7.5 range |

These are the **expected outcomes** based on published electrocoagulation research, not real-time calculations.

### Scientific Basis

The model is inspired by:
1. **Faraday's Law of Electrolysis** - relates current to ion release rate
2. **Coagulation kinetics** - higher current = faster coagulant formation
3. **Mass balance** - larger volumes need proportionally more treatment
4. **pH effects** - optimal coagulation occurs near neutral pH

### What a Real System Would Need

In an **actual implementation**, you would require:
- 🔬 **Turbidity sensors** - to measure water cloudiness
- 📈 **pH meters** - to monitor acidity/alkalinity
- ⚡ **Current/voltage monitors** - to track electrical parameters
- 🧫 **Water quality analyzers** - for contaminant detection
- 📊 **Machine learning models** - trained on real experimental data

##  Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## License

This project is open source and available under the [MIT License](LICENSE).

##  Author

Created for educational purposes to demonstrate electrocoagulation water treatment principles.

---

**Note**: This is a simulation for educational purposes. Actual electrocoagulation treatment times and results depend on many factors including water composition, electrode condition, and system design.
