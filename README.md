#  Electrocoagulation Water Treatment Simulation

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
- Literature-calibrated kinetic model (charge loading + first-order removal)
- Built-in calibration mode to fit kinetic constants from your own experiments
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

5. **Calibration Mode** (Right Panel → Treatment Time Prediction):
   - Paste **3-5 CSV runs** in this format:
     - `time_min,current_A,volume_L,area_cm2,turbidity0_NTU,turbidityF_NTU,tss0_mgL,tssF_mgL`
   - Click **Fit & Apply** to update kinetic constants (`k_turbidity`, `k_TSS`) and reference charge loading.
   - Use **Load Sample** to prefill example runs and test the workflow.

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

The simulation uses a **charge-loading kinetic model** grounded in electrocoagulation literature:

1. Compute charge loading:
   - $Q = \frac{I \cdot t}{V}$ (C/L)
2. Apply first-order pollutant kinetics:
   - $C(Q) = C_0 e^{-kQ}$
3. Solve required charge for target removal:
   - $Q_{target} = -\ln(1-R)/k$
4. Convert to time:
   - $t = \frac{Q_{target} \cdot V}{I}$

### Model calibration used

- Conservative kinetic constants are used for turbidity/TSS so time is not under-predicted.
- Current-density efficiency is included with an operating window near **80-300 A/m²** (converted from typical EC ranges in mA/cm²).
- A practical batch-EC charge-loading envelope is enforced (**1000-5400 C/L**, equivalent to roughly **0.3-1.5 Ah/L**) so extremely short predictions are avoided.

### Water quality predictions

Water quality outputs are now computed dynamically from the same kinetic equations at the selected check time and at estimated completion time:

- Turbidity and TSS from first-order decay vs. charge loading
- Clarity from turbidity
- pH movement toward neutral due to hydroxide/floc chemistry
- Conductivity and dissolved oxygen trends from charge loading

### Scientific basis

The implementation is based on standard EC formulations and review guidance from:
- Mollah et al. (2001)
- Chen (2004)
- Kobya et al. (2003)
- Bayramoglu et al. (2004)
- Moussa et al. (2017)

### What a Real System Would Need

In an **actual implementation**, you would require:
- **Turbidity sensors** - to measure water cloudiness
- **pH meters** - to monitor acidity/alkalinity
- **Current/voltage monitors** - to track electrical parameters
- **Water quality analyzers** - for contaminant detection
- **Machine learning models** - trained on real experimental data

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
