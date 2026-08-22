-- Session 3 Sandbox Seed SQL
-- Run this against the sandbox database (separate from your app database)
-- This is used for testing EXPLAIN ANALYZE before/after index creation

-- Create test users
INSERT INTO \"User\" (id, email, name, role, \"createdAt\")
VALUES
  ('11111111-1111-1111-1111-111111111111', 'user1@test.com', 'Test User 1', 'ATTENDEE', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'user2@test.com', 'Test User 2', 'ATTENDEE', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'user3@test.com', 'Test User 3', 'ATTENDEE', NOW()),
  ('44444444-4444-4444-4444-444444444444', 'user4@test.com', 'Test User 4', 'ATTENDEE', NOW()),
  ('55555555-5555-5555-5555-555555555555', 'user5@test.com', 'Test User 5', 'ATTENDEE', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test event with capacity 5
INSERT INTO \"Event\" (id, title, description, venue, \"startsAt\", capacity, \"priceCents\", \"organizerId\", \"createdAt\")
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Capacity Test Event', 'Event for capacity testing', 'Test Venue', NOW() + INTERVAL '1 day', 5, 1000, '11111111-1111-1111-1111-111111111111', NOW())
ON CONFLICT (id) DO NOTHING;

-- Test queries for EXPLAIN ANALYZE:
-- Before index:
-- EXPLAIN ANALYZE SELECT * FROM \"Booking\" WHERE \"userId\" = '11111111-1111-1111-1111-111111111111';

-- After index (CREATE INDEX idx_booking_user_id ON \"Booking\" (\"userId\")):
-- EXPLAIN ANALYZE SELECT * FROM \"Booking\" WHERE \"userId\" = '11111111-1111-1111-1111-111111111111';
