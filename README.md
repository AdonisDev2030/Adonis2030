# Daily Brief

News from The Guardian, The New York Times and NewsAPI.

## Setup

Use Node.js 24.12 or newer. Create `.env` in the project root and fill in your keys:

```env
GUARDIAN_API_KEY=
NYT_API_KEY=
NEWSAPI_KEY=
```

Get keys from [Guardian](https://open-platform.theguardian.com/access/),
[NYT](https://developer.nytimes.com/get-started) and [NewsAPI](https://newsapi.org/register).
Enable Article Search for your NYT app. Keep `.env` private.

## Run locally

```sh
npm ci
npm run dev
```

Open the URL printed in the terminal. This starts both the interface and the API;
no second terminal is needed. Restart after changing `.env`. Stop with Ctrl+C.

## Run with Docker

With Docker running and `.env` filled in:

```sh
docker build -t daily-brief .
docker run --rm --env-file .env -p 127.0.0.1:8080:8080 daily-brief
```

Open `http://localhost:8080`. Stop with Ctrl+C. If port 8080 is busy, use
`-p 127.0.0.1:8081:8080` and open `http://localhost:8081` instead.

## Build and lint

```sh
npm run build
npm run lint
```

The build checks TypeScript and produces `dist/`.
