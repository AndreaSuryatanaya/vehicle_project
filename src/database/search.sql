-- Run once after the vehicle marketplace schema has been applied.
ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(city, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(region, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS listings_search_vector_gin_idx
    ON listings USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS listings_search_filters_idx
    ON listings (fuel_type, year, price)
    WHERE status = 'available' AND deleted_at IS NULL;
