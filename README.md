# Surron Parts Finder

Find the cheapest Surron, Ultra Bee, and Light Bee parts across every vendor — Luna Cycle, Surron USA, AliExpress, eBay, Empire eBikes, and more. Sorted lowest first.

**Live site:** _coming soon — enable GitHub Pages on this repo_

## What it does

Search for any Surron part (brake, peg, battery, suspension, etc.) and instantly see prices from every vendor side-by-side, including shipping. Click through to buy on whichever site is cheapest.

## Stack

Pure HTML + CSS + vanilla JavaScript. No framework, no build step. Hosted on GitHub Pages for free.

- `index.html` — main page
- `style.css` — styling
- `app.js` — data loading, filtering, sorting, rendering
- `parts.json` — the parts catalog (manually curated for V1)

## Adding or updating parts

Edit `parts.json`. Each part looks like:

```json
{
  "id": "ultra-bee-front-brake-caliper",
  "name": "Ultra Bee Front Brake Caliper",
  "category": "Brakes",
  "bike": "Ultra Bee",
  "listings": [
    {
      "vendor": "Luna Cycle",
      "price": 189.99,
      "shipping": 0,
      "url": "https://lunacycle.com/...",
      "inStock": true,
      "isPlaceholder": false
    }
  ]
}
```

Set `isPlaceholder` to `false` once you've verified the price and URL on the actual vendor page. While any listing is `isPlaceholder: true`, a yellow demo banner shows on the live site.

## Local preview

Just open `index.html` in a browser, or for the cleanest experience run a tiny local server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Roadmap

- V1 (now): manual data, top ~10 parts, GitHub Pages deploy
- V2: more parts (50+), price-history tracking, restock alerts via email
- V3: user-submitted listings, vendor reviews, scrapers
- V4: native iOS app, build planner, "what does my Ultra Bee cost to upgrade" calculator
