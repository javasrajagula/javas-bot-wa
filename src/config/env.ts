import dotenv from 'dotenv';
import { parseEnv } from './env.schema.js';

dotenv.config();

export const env = parseEnv(process.env);
