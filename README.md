# mikkemus-app

En liten Mikke Mus-tema fullstack-app: skriv inn navnet ditt på forsiden, se
alle registrerte navn på `/navn`. Bygget som et npm-workspaces-monorepo med
TypeScript, Next.js (App Router) og Prisma mot PostgreSQL.

## Struktur

```
mikkemus-app/
├── apps/
│   └── web/              Next.js-appen (frontend + API-routes)
├── packages/
│   └── database/         Prisma schema + delt databaseklient (@mikkemus/database)
├── k8s/
│   └── application.yaml  Eksempel på skiperator Application-manifest
└── Dockerfile             Multi-stage build, kjører som UID 150 (skiperator-krav)
```

## Database

Appen er satt opp til å kjøre mot en PostgreSQL-database i **Scaleway
Managed Database** – det er ingen lokal database inkludert.

1. Opprett en PostgreSQL-instans i Scaleway (konsoll eller `scw rdb instance create ...`).
2. Kopier `.env.example` til `.env` og fyll inn `DATABASE_URL` med
   connection-stringen fra Scaleway.
3. Kjør migrasjonen som oppretter `navn`-tabellen:

   ```bash
   npm install
   npm run db:migrate:dev
   ```

   (bruk `npm run db:migrate:deploy` i produksjon/CI – den kjører uten å
   spørre om en migrasjonsnavn og oppretter ikke nye migrasjoner)

## Utvikling

```bash
npm install
npm run db:generate   # genererer Prisma-klienten
npm run dev           # starter Next.js på http://localhost:3000
```

Siden appen kobler direkte til Scaleway-databasen også i utvikling, må
maskinen din ha nettverkstilgang dit (sjekk at IP-en din er tillatt i
Scaleway sine "Allowed IPs" for databaseinstansen, eller bruk deres
public/private network-oppsett).

## Bygge

```bash
npm run build   # bygger @mikkemus/database og @mikkemus/web
npm start       # starter produksjonsbygget
```

## Docker / deploy med skiperator

`Dockerfile` bygger et `next build --output standalone`-image og kjører
prosessen som UID 150, slik skiperator krever. Den lytter på port **8080**
(ikke 80/3000), siden en non-root-bruker ikke kan binde seg til porter
under 1024.

```bash
docker build -t mikkemus-web .
docker run -p 8080:8080 --env-file .env mikkemus-web
```

Se `k8s/application.yaml` for et startpunkt på selve skiperator
`Application`-ressursen. Den forventer at `DATABASE_URL` ligger i en
Kubernetes Secret kalt `mikkemus-db`:

```bash
kubectl create namespace mikkemus
kubectl create secret generic mikkemus-db \
  --namespace mikkemus \
  --from-literal=DATABASE_URL='postgresql://...'
kubectl apply -f k8s/application.yaml
```

Husk å bytte `image` i `k8s/application.yaml` til et faktisk image dere har
pushet til et registry containeren har tilgang til, og `ingresses` til et
hostnavn dere faktisk kontrollerer (evt. `nip.io`-varianten mot IP-en til
`istio-ingress-external` i `eurocloud-cluster`, se eurocloud-repoet).
