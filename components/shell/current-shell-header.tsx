import { connection } from "next/server";
import { getCurrentShellView } from "@/lib/services/current-shell";
import { ShellHeader } from "./app-shell";

/**
 * The header for whoever is signed in. Decided per request, so a build made
 * without sign-in settings never bakes sample data into a real deployment.
 */
export async function CurrentShellHeader() {
  await connection();
  return <ShellHeader view={await getCurrentShellView()} />;
}
