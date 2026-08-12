# Kirk Drinks Beer

A static-first beer review site for https://kirkdrinks.beer/

## Files

- `index.html` — site markup
- `styles.css` — all styling
- `app.js` — renders reviews, gallery and supporter wall
- `data/reviews.json` — your beer reviews
- `data/gallery.json` — your beer photos
- `data/supporters.json` — people who bought you beers
- `assets/` — replace placeholder JPGs with your actual photos

## Run locally

Because the site loads JSON using `fetch()`, don't double-click index.html directly.

From this folder run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Add a beer review

Edit `data/reviews.json` and add:

```json
{
  "name": "Beer Name",
  "style": "IPA",
  "location": "The Pub",
  "score": 8.4,
  "buyAgain": true,
  "review": "Your review goes here.",
  "image": "assets/my-beer.jpg",
  "alt": "Pint of Beer Name"
}
```

## Add a supporter

Edit `data/supporters.json`:

```json
{
  "name": "Someone",
  "beers": 1,
  "message": "Cheers!"
}
```

The homepage automatically totals the number of funded beers.

## Buy Me a Coffee

In `index.html`, replace:

```text
https://www.buymeacoffee.com/YOURUSERNAME
```

with your real page.

### Automatic supporter wall

Do NOT put a Buy Me a Coffee API key or webhook secret in `app.js`.

For real automatic donor updates, use a tiny serverless backend (Cloudflare Worker is ideal) that:
1. Receives payment/provider webhooks.
2. Verifies the webhook signature.
3. Stores approved supporter data in D1/KV.
4. Exposes a public read-only `/api/supporters` endpoint.
5. Keeps email addresses, payment IDs and private donor metadata private.

The frontend can then replace `data/supporters.json` with that endpoint.

## Hosting

Works on:
- GitHub Pages
- Cloudflare Pages
- Netlify
- Any normal static web host

For a custom domain, point `kirkdrinks.beer` to whichever host you use.

## Images

The included JPGs are deliberately simple placeholders. Replace them with your own beer photos using the same filenames, or change the paths in the JSON files.

## Venue reviews

Each beer review can now include a venue review.

Add this inside a review in `data/reviews.json`:

```json
"venue": {
  "name": "The Old Brewery",
  "location": "Town Centre",
  "price": 7.2,
  "pour": 9.0,
  "venue": 8.4,
  "wouldReturn": true,
  "review": "Fair price, properly poured, and somewhere I would happily drink again."
}
```

The venue overall score is calculated automatically from:

- `price`
- `pour`
- `venue`

The site then displays the result as an average out of 10.

### Suggested scoring meaning

**Price**
- 10 = bargain
- 7–8 = fair
- 5–6 = a bit expensive
- below 5 = taking the piss

**Pour**
- 10 = perfect head / presentation / temperature / glass
- 7–8 = good
- 5–6 = acceptable
- below 5 = badly served

**Venue**
- 10 = destination pub/bar
- 7–8 = somewhere you'd happily return
- 5–6 = fine
- below 5 = drink it and leave


### Actual pint price

Add these fields inside each `venue` object:

```json
"pricePaid": 6.50,
"currency": "GBP"
```

`pricePaid` is the actual amount charged for the reviewed pint. `price` remains the separate value-for-money score out of 10. The site formats GBP automatically, so `6.5` displays as `£6.50`.
