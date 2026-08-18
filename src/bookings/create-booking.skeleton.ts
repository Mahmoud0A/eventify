// Create booking skeleton — transaction wrapper for Session 3
//
// This file is the transaction wrapper with Serializable isolation.
// TODO(student): fill in the three markers below.
//
// The retry loop is stubbed as a stretch — catch P2034 and re-run the
// whole transaction a bounded number of times.
//
// Imports and Prisma client are configured by the starter branch.
//
// Usage:
//   node scripts/parallel-bookings.ts   // proof script — exits non-zero on oversell
//
// Expected tally (capacity=5, 20 users):
//   exactly 5× 201, 15× 409  (a few 500s from P2034 are acceptable until retry stretch)