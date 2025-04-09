import { cookies } from "next/headers";

/**
 * 
 * @param resource 
 */
export async function getTokenSet(resource: string) {
  const cookie = await cookies();
  const tokenSet = cookie.get("s_" + resource);

  if (!tokenSet) {
    throw new Error("Tokenset stored");
  }

  const parsed = JSON.parse(tokenSet.value);
  return parsed;
}
