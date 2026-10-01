# Daily Brief

News from The Guardian, The New York Times and NewsAPI.

## Setup

Use Node.js 24.12 or newer. Create `.env` in the project root and fill in your keys:

```env
NYT_API_KEY=rDf6tMtGx4x7ULIdrvMn2TpbWfS5fFaTwGrwxoi7iGlrlBrR
GUARDIAN_API_KEY=8ac161db-3b8c-4654-b9dd-1e0af311d5de
NEWSAPI_KEY=692a010b79f44c4ea0320f64e64ed192
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

[📄 View / Download Overview.pdf](https://github.com/user-attachments/files/32934302/doc.pdf)

<img width="1280" height="933" alt="photo_2026-10-01_22-40-53" src="https://github.com/user-attachments/assets/4084638b-fe7c-43e3-95e5-ce6d2715f480" />

<img width="1280" height="933" alt="photo_2026-10-01_22-40-54" src="https://github.com/user-attachments/assets/05c8533a-e2d2-4938-818a-c3d77323841d" />

<img width="375" height="900" alt="photo_2026-10-01_22-40-53 (2)" src="https://github.com/user-attachments/assets/b0881200-26f7-45db-9ef9-abecf84d4257" />



