# Orb SVG Assets

Place your orb SVG files in this directory with the following naming convention:

- `orb1.svg`
- `orb2.svg` 
- `orb3.svg`
- `orb4.svg`

## How it works:

1. The game will automatically load all SVG files when starting
2. During the 10-second countdown between rounds, players can select their orb skin
3. The selected orb replaces the solid colored circle for that player
4. If SVG files are missing or fail to load, players will fallback to colored circles
5. SVGs will be scaled to match the player size (15+ radius, growing as they eat)

## File Requirements:

- **Format**: SVG files only
- **Naming**: Exactly `orb1.svg` through `orb4.svg` (case sensitive)
- **Size**: Any size (will be scaled automatically)
- **Design**: Should work well as circular/round orb shapes that represent the player

## Selection System:

- **When**: Orb selection modal appears during the 10-second countdown between rounds
- **How**: Players click on their preferred orb skin
- **Sync**: Selection is synchronized across all players in the session
- **Persistence**: Choice persists until the player selects a different orb

Add your 4 orb SVG files here and players will be able to choose their favorite skin at the start of each round! 