# Piano Room

[Open Piano Room](https://aldrinsalazar.github.io/piano-room/)

I made Piano Room to help me play piano chords for songs I find on the internet. I can paste a chord sheet, see each chord on a two-octave keyboard, and hear how it sounds before playing it myself.

The app supports chord autocomplete, inversions, octave changes, drag-and-drop ordering, saved sheets, a metronome, and several appearance settings. Sheets and preferences stay in the browser's local storage.

## Run locally

Piano Room is a static app with no build step or package dependencies. Serve the directory with any local HTTP server, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Third-party software and samples

The Vue runtime is distributed under the MIT License. The included FluidR3 piano samples are distributed under Creative Commons Attribution 3.0. See `assets/piano/ATTRIBUTION.txt` for their source and attribution.

## License

Piano Room is available under the MIT License. See `LICENSE`.
