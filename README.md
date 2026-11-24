# SnakeBite menu website

A small static site with the SnakeBite breakfast, dinner and drinks menus in several languages.
It has no build step and no server code, so it runs on the Cloudflare Pages free plan.

```
snakebite-menu/
├── public/                 ← THIS is the website (the folder you deploy)
│   ├── index.html
│   ├── assets/             styles, script, logo, fonts
│   ├── images/             put dish photos here
│   └── data/
│       ├── menu.json       ← all dishes, prices, categories (English)
│       ├── settings.json   ← opening-time switch, time zone, languages
│       └── lang/
│           ├── en.json     ← English wording for buttons, dietary key, allergens
│           └── zh.json     ← Chinese translation (one entry per dish)
└── tools/check-menu.mjs    ← checks the data for typos before you publish
```

---

## Editing the menu

All dishes live in `public/data/menu.json`. Every dish looks like this:

```json
{
  "id": "eggs-benedict",
  "menu": "breakfast",
  "category": "breakfast",
  "name": "Eggs Benedict",
  "price": 33.00,
  "description": "Two poached eggs and wilted spinach, topped with hollandaise…",
  "dietary": ["GFO", "DF", "VO"],
  "allergens": [],
  "photo": ""
}
```

| Field | What it is |
|---|---|
| `id` | A unique short name: lowercase letters, numbers and dashes only. Translations use it to find the dish. |
| `menu` | `breakfast`, `dinner` or `drinks` (the tabs). |
| `category` | One of the category ids listed at the top of `menu.json`, e.g. `curries`, `burgers`. |
| `name` | The dish name in English. |
| `price` | A plain number: `33.00`, not `"$33"`. |
| `description` | Can be `""` if there isn't one. |
| `dietary` | Any of `GF` `GFO` `DF` `DFO` `V` `VO`. |
| `allergens` | Any of `milk` `eggs` `wheat` `gluten` `soy` `peanuts` `tree-nuts` `sesame` `fish` `crustacean` `mollusc` `lupin` `sulphites`. These show in red as "Contains: …". |
| `photo` | Optional. A path like `"images/eggs-benedict.jpg"`. If it's filled in, guests get a **Photo** button that folds the picture out. |

Optional extras:

* **Several prices.** Replace `"price"` with a list. The labels get translated through `labels` in each language file.
  ```json
  "prices": [ { "label": "Chicken", "price": 33.50 }, { "label": "Prawn", "price": 35.50 } ]
  ```
* **Add-ons** shown under the description:
  ```json
  "extras": [ { "label": "Add streaky bacon", "price": 7.00 } ]
  ```
* **Hide a dish for now** (e.g. "Not available") without deleting it: add `"available": false`.

**Common tasks**

* *Change a price:* edit the number.
* *Remove a dish:* delete its `{ … }` block, including the comma that separates it from the next block.
* *Add a dish:* copy an existing block, paste it where you want it to appear (order in the file = order on the page), and change the fields. Give it a new `id`.
* *Add a category:* add a line to `"categories"` (order there = order on the page), then use its `id` on dishes.
* *Add a photo:* save a JPG in `public/images/`. Landscape and around 1200 px wide is plenty; compress it at squoosh.app so it stays under ~200 KB. Then set `"photo": "images/your-file.jpg"`.

> JSON is fussy: every text goes in "double quotes", items are separated by commas, and there is **no** comma after the last item in a list. Run the checker (below) and it'll point at mistakes.

### Translations

Each language has one file in `public/data/lang/`. Dishes are matched by `id`:

```json
"items": {
  "eggs-benedict": { "name": "班尼迪克蛋", "description": "两个水波蛋和菠菜，淋上荷兰酱…" }
}
```

If a translation is missing, the English text is shown instead, so the page never breaks.
In other languages the English name is also shown in small grey text under every dish, so guests can point at it when ordering.

**Adding a language** (e.g. Japanese):
1. Copy `zh.json` to `ja.json` and translate the text on the right-hand side of each line. Leave the ids on the left unchanged.
2. Add `{ "code": "ja", "name": "日本語" }` to `"languages"` in `settings.json`.

The site picks the guest's phone language automatically if it's available, and the globe menu lets guests switch.
You can also link to a language directly: `https://snakebitemenu.com/?lang=zh`.

> The Chinese translation is a draft. Please have a native speaker check it, especially anything allergy-related, before you rely on it.

### Which menu opens first

`settings.json` controls this, using **New Zealand time** (`Pacific/Auckland`). Visitors' phones may still be set to their home time zone, so the site doesn't rely on them:

```json
"schedule": [
  { "menu": "breakfast", "from": "06:00", "to": "11:30" },
  { "menu": "dinner",    "from": "11:30", "to": "21:00" }
],
"fallbackMenu": "dinner"
```

Outside those times the `fallbackMenu` opens. Guests can always tap the tabs.
To test, add `?time=09:00` to the address. Links like `/#drinks` open a specific tab.

### Check before publishing

With [Node.js](https://nodejs.org) installed, run this from the `snakebite-menu` folder:

```
node tools/check-menu.mjs
```

It flags broken JSON, unknown categories or allergen codes, missing photo files and missing translations.

### Preview on your computer

Double-clicking `index.html` won't work (browsers block loading the menu files that way). Run a tiny local server instead:

```
cd public
python3 -m http.server 8000      # or: npx serve
```

Then open http://localhost:8000.

---

## Hosting on Cloudflare Pages

Cloudflare Pages is a good fit: static files are served free with no traffic limit, commercial use is allowed, and your domain is already at Cloudflare.

### Option A: GitHub (recommended, easiest to keep updated)

1. Create a free GitHub account and a new **private** repository, e.g. `snakebite-menu`.
2. Upload the contents of this folder (`public/`, `tools/`, `README.md`) using "Add file → Upload files".
3. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Connect to Git**, then pick the repository.
4. Build settings: Framework preset **None**, Build command **(leave empty)**, Build output directory **`public`**. Save and deploy.
5. From then on you can edit `public/data/menu.json` straight on github.com (pencil icon → edit → Commit). Cloudflare republishes automatically within about a minute.

### Option B: Drag and drop (no Git)

1. **Workers & Pages → Create → Pages → Upload assets.**
2. Name the project (e.g. `snakebite-menu`), then drag in the **`public`** folder and deploy.
3. To update later: open the project → **Create deployment** → drag the `public` folder in again.

### Connect your domain

1. Open the Pages project → **Custom domains → Set up a custom domain**.
2. Enter `snakebitemenu.com` and confirm. Because the domain is registered with Cloudflare, the DNS record is created for you and HTTPS is set up automatically (it can take a few minutes).
3. Repeat for `www.snakebitemenu.com` so both addresses work.

The QR code (`snakebite-menu-qr.svg` / `.png`) points to `https://snakebitemenu.com`.
Test it with a couple of phones before printing. Print it at least 2.5 cm wide with a white margin around it.
