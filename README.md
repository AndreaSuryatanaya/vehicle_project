# Vehicle Marketplace API

REST API untuk kategori kendaraan, listing, pencarian teks, filter, dan pagination. Project memakai NestJS, PostgreSQL, dan Redis untuk cache. Panduan ini menjelaskan cara menjalankan API dari awal, baik langsung di komputer maupun melalui Docker/Podman.

## Prasyarat

- Node.js 22 atau lebih baru.
- Yarn Classic 1.22.22. Aktifkan versi yang dipakai project dengan `corepack enable`.
- PostgreSQL 16 atau database PostgreSQL yang kompatibel.
- Redis 7 untuk mengaktifkan cache. API tetap berjalan jika Redis tidak tersedia, tetapi request akan langsung membaca database.
- Untuk container: Docker Compose, atau Podman bersama `podman-compose`.

## Menjalankan secara lokal

Ikuti langkah berikut dari direktori root project.

### 1. Pasang dependency

```bash
corepack enable
yarn install --frozen-lockfile
```

### 2. Siapkan PostgreSQL dan Redis

Pastikan PostgreSQL dan Redis berjalan di komputer. Jika menggunakan Homebrew:

```bash
brew services start postgresql@16
brew services start redis
```

Buat database kosong jika belum ada. Contoh ini menggunakan user `postgres`:

```bash
createdb -U postgres vehicle_project
```

Sesuaikan user atau nama database dengan instalasi lokalmu.

### 3. Atur koneksi `.env`

Salin template:

```bash
cp .env.example .env
```

Jika file `.env` sudah ada, edit nilainya dan jangan menimpanya dengan template. Pastikan `DATABASE_URL` sesuai dengan user, password, host, port, dan nama database lokal. Contoh:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vehicle_project
REDIS_URL=redis://localhost:6379
```

### 4. Buat schema database

Jalankan migration:

```bash
yarn migrate
```

Migration membaca file SQL dari `docs/database/migration`, menjalankannya sesuai urutan nama, dan mencatat migration yang sudah berhasil di tabel `schema_migrations`. Database baru akan dibuatkan schema dan search index. Jika database sudah berisi tabel inti, migration akan menganggap schema awal sudah diterapkan lalu menjalankan migration yang tersisa.

### 5. Isi database dengan data demo

Seed diperlukan agar endpoint categories, listings, search, dan filters menampilkan data. Perintah ini membuat 600 listing demo secara default:

```bash
yarn seed
```

Untuk jumlah lain gunakan minimal 500:

```bash
SEED_LISTING_COUNT=1000 yarn seed
```

Seed menambahkan kategori, atribut filter kategori beserta opsi enum, makes, models, listing, dan gambar listing yang dibutuhkan oleh data demo. Atribut filter dibuat secara idempotent untuk kategori Cars, Motorcycles, serta beberapa subkategori agar endpoint `GET /filters/:categoryId` memiliki metadata untuk ditampilkan. Saat dijalankan ulang, script hanya mengganti listing dengan judul berawalan `SEED-DEMO-`; data listing lain tidak dihapus.

### 6. Jalankan API

```bash
yarn start:dev
```

API berjalan di `http://localhost:3000`.dan untuk dokumentasi API yang lebih lengkap ada di Swagger tersedia di `http://localhost:3000/api`. Endpoint health check ada di `GET /`.

### 7. Coba endpoint

```bash
curl http://localhost:3000/
```

## Menjalankan dengan Docker Compose atau Podman

Compose menjalankan tiga service: API, PostgreSQL, dan Redis. Database Compose terpisah dari PostgreSQL lokal. Data database disimpan di volume bernama `postgres_data`.

### 1. Pastikan container engine berjalan

Dengan Docker Desktop, pastikan Docker aktif. Dengan Podman di macOS, pastikan Podman machine sudah dibuat dan berjalan:

```bash
podman machine list
```

Jika machine sudah ada tetapi statusnya `Stopped`, jalankan `podman machine start`. Jika belum pernah dibuat, inisialisasi dan jalankan sekali:

```bash
podman machine init
podman machine start
```

### 2. Build dan jalankan semua service

Untuk Podman:

```bash
podman-compose up --build -d
podman-compose ps
```

Untuk Docker:

```bash
docker compose up --build -d
docker compose ps
```

Saat API mulai, container akan menjalankan migration terlebih dahulu. Tunggu sampai service `api`, `postgres`, dan `redis` berjalan/healthy.

### 3. Seed database di dalam container

Seed **tidak dijalankan otomatis** saat startup. Jalankan sekali setelah service siap.

Podman:

```bash
podman-compose exec api node scripts/seed-search-data.js
```

Docker:

```bash
docker compose exec api node scripts/seed-search-data.js
```

Secara default, perintah ini membuat 600 listing demo. Untuk jumlah lain, tambahkan environment variable ke perintah:

```bash
podman-compose exec -e SEED_LISTING_COUNT=1000 api node scripts/seed-search-data.js
```

Dengan Docker, gunakan:

```bash
docker compose exec -e SEED_LISTING_COUNT=1000 api node scripts/seed-search-data.js
```

### 4. Gunakan API

API berjalan di `http://localhost:3000`.dan untuk dokumentasi API yang lebih lengkap ada di Swagger tersedia di `http://localhost:3000/api`. Endpoint health check ada di `GET /`.

```bash
curl http://localhost:3000/
```

Compose mempublikasikan PostgreSQL ke port host `5433` agar tidak bentrok dengan PostgreSQL lokal di `5432`. Redis hanya dapat diakses dari jaringan internal Compose.

### 5. Log dan mematikan service

Podman:

```bash
podman-compose logs -f api
podman-compose down
```

Docker:

```bash
docker compose logs -f api
docker compose down
```

`down` menghentikan container dan mempertahankan data PostgreSQL di volume. Menghapus volume dengan `down -v` juga menghapus database beserta seed datanya.

## Redis cache

API menggunakan cache-aside untuk hasil GET yang sukses. Cache kategori dan metadata filter berlaku sekitar 5 menit, hasil browse/search 30 detik, serta detail listing dan suggestion 1 menit. Perubahan data kategori atau listing membatalkan cache namespace terkait. Jika Redis tidak tersedia, API tetap membaca dari PostgreSQL.

## Database dan diagram

- Migration SQL: [`docs/database/migration`](docs/database/migration)
- Diagram ERD dalam DBML, strategi category tree, dan penjelasan index: [`docs/database/README.md`](docs/database/README.md)

## Perintah pengembangan e2e test

```bash
yarn test:e2e:api    # end-to-end tests
```
