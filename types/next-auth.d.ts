import 'next-auth';

// Login is identity only. The connected sheet + active sub-account are stored in a durable
// server cookie (lib/server/sheetConnection.ts), not on the session — so no custom session
// fields are needed here. Read connection state via GET /api/connection.
declare module 'next-auth' {
  // Default Session shape (user, expires) is sufficient.
}
