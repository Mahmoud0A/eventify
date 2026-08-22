import { PrismaClient } from "../../.prisma/client/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDbUrl } from "../config/config.ts";

const adapter = new PrismaPg(getDbUrl());
export const prisma = new PrismaClient({ adapter });