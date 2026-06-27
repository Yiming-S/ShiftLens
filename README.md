# ShiftLens

Interactive visualizations for domain adaptation.

ShiftLens is a browser-based visual explorer for understanding how domain
adaptation methods transform source data to align with a target domain. It uses
deterministic 2-D toy data and step-by-step animations to make the geometry of
source-target alignment easier to inspect.

## Methods

- SA: Subspace Alignment
- CORAL: Correlation Alignment
- RD: Riemannian-distance alignment
- ART: Aligned Riemannian Transport
- PT: Parallel Transport on SPD covariance matrices
- TCA: Transfer Component Analysis
- MIDA: Maximum Independence Domain Adaptation
- GFK: Geodesic Flow Kernel
- OT: Sinkhorn optimal transport
- M3D: Multi-step domain adaptation

## Features

- Live canvas animations for each method
- Optional matrix and diagnostic panels
- Source-target color coding and class-shape coding
- Compare mode for paired method playback
- Live mean, covariance, MMD, and class-centroid gap metrics
- Experiment data presets for covariate shift, conditional shift, label shift, nonlinear warp, outlier stress tests, and custom CSV input
- Dataset controls for random seed, mean shift, target rotation, scale, noise, class separation, label shift, outliers, and sample count
- Method detail cards with assumptions, matched quantities, outputs, math sketches, and references
- Export of the current view as PNG and the animation as WebM
- Previous/next step controls, keyboard navigation, and fullscreen canvas mode
- Shareable URL state for method, progress, panels, comparison, dataset settings, and method controls
- Dependency-free static frontend

## Controls

- `Left` / `Right`: move to the previous or next semantic step
- `Space`: play or pause the animation
- `PNG`: export the current canvas frame
- `WebM`: record the current method animation
- `Fullscreen`: expand the canvas for presentation

## Experiment Data

The experiment panel can switch between method-guided toy data and reusable
stress-test presets. Custom data can be pasted as CSV rows:

```csv
source,-2.1,0.8,0
source,-1.5,-1.2,1
target,2.4,-0.7,0
target,3.0,1.3,1
```

The app normalizes custom points into the visualization frame and maps labels
to the two displayed class shapes.

## Usage

Open `index.html` directly in a browser, or serve the folder with a static web
server:

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/`.

## Author

Yiming Shen

This project is independently designed and developed by Yiming Shen.

## License

MIT License. See `LICENSE` for details.
