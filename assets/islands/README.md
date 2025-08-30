# Island PNG Assets

Place your island PNG files in stage-specific directories with the following structure:

```
assets/islands/
├── ocean/
│   └── island1.png
├── space/
│   └── island1.png
├── volcanic/
│   └── island1.png
├── forest/
│   └── island1.png
└── swamp/
    └── island1.png
```

## How it works:

1. The game randomly selects one of 5 stages: ocean, space, volcanic, forest, or swamp
2. All islands in that stage use the single `island1.png` design for that stage
3. If the PNG file is missing or fails to load, islands will fallback to colored circles
4. PNGs will be scaled to fit the island size (50-110 radius)

## File Requirements:

- **Format**: PNG files only
- **Naming**: Exactly `island1.png` (case sensitive)
- **Size**: Any size (will be scaled automatically)
- **Design**: Should be themed to match the stage (ocean islands, space stations, volcanic islands, etc.)

Replace the placeholder PNG files with your actual island assets and refresh the game to see them appear! 