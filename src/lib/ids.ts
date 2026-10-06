import { customAlphabet } from "nanoid";

const alphabet = "23456789abcdefghijkmnopqrstuvwxyz";
const nano = customAlphabet(alphabet, 8);

export function newShortId(): string {
  return nano();
}
