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
- Shareable URL state for method, progress, panels, and method controls
- Dependency-free static frontend

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
