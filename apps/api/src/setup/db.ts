import { sql } from "drizzle-orm";
import { db } from "../db";
// This is used to create a hypertable on the trends table
// Needs to be run anytime we setup the db from scratch or change the trends table
const createHypertableSQL = `
  SELECT create_hypertable('trends', 'time', if_not_exists => TRUE);
`;

await db.execute(sql.raw(createHypertableSQL));
