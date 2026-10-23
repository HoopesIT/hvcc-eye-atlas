# Hoopes Vision Eye Atlas

A full-screen, interactive 3D introduction to the human eye, branded for Hoopes Vision. Patients can rotate and zoom the model, separate its layers, select nine anatomical structures, take a guided tour, and follow the path of light through the eye.

[Open the private Sites version](https://hoopes-vision-eye-atlas.joshchild.chatgpt.site/).

## Run locally

Serve the `dist` directory from this repository:

```sh
python3 -m http.server 4173 --directory dist
```

Open `http://localhost:4173` in a browser with WebGL support. No installation or build step is required.

With Node.js available, check the application JavaScript syntax:

```sh
npm run check
```

## Files and hosting

The maintained HTML, CSS, JavaScript, logo, and bundled Three.js module are in `dist/`. These are the application source files, ready to serve from any static web host. Use `dist` as the published directory.

| File | Purpose |
| --- | --- |
| `dist/index.html` | Interface and document structure |
| `dist/styles.css` | HUD styling and responsive layouts |
| `dist/app.js` | Navigation, selections, controls, and learning journeys |
| `dist/eye-scene.js` | Procedural 3D model and pointer interactions |
| `dist/content.js` | Patient education text and source links |
| `dist/assets/hoopes-logo.png` | Hoopes Vision logo |
| `dist/vendor/` | Three.js r169 and its license |
| `.openai/hosting.json` | Connection to the existing Sites project |

The application has no backend or account requirement. Google Fonts supplies the display fonts when available; system fonts provide a fallback. Access to the hosted Sites version follows its separate private access policy.

## Educational model

The model is a simplified schematic. Colors, proportions, and exploded spacing are adapted for learning, and some structures are omitted. Educational descriptions link to the National Eye Institute and Mayo Clinic. The experience does not provide a diagnosis or replace an eye examination. Source links do not imply affiliation or clinical review.

Three.js is distributed under the MIT license. See `dist/vendor/THREE-LICENSE.txt`.
