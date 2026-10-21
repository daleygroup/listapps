import type { ImpersonationMode } from "./impersonation-policy";

/**
 * The words on the impersonation banner (CLAUDE.md section 4: persistent,
 * unmissable, cannot be dismissed). Pure so the wording is tested once.
 */
export interface BannerInput {
  targetName: string;
  mode: ImpersonationMode;
  reason: string;
  expiresAt: Date;
  now: Date;
}

export interface BannerText {
  headline: string;
  detail: string;
  /** Whole minutes left, never negative. */
  minutesLeft: number;
  elevated: boolean;
}

export function bannerText(input: BannerInput): BannerText {
  const minutesLeft = Math.max(
    0,
    Math.ceil((input.expiresAt.getTime() - input.now.getTime()) / 60_000),
  );
  const elevated = input.mode === "elevated";
  const modeWords = elevated
    ? "Changes you make are saved and logged"
    : "View only, nothing can be changed";
  const timeWords =
    minutesLeft === 0
      ? "ends now"
      : `ends in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}`;
  return {
    headline: `You are viewing ListApps as ${input.targetName}`,
    detail: `${modeWords}. Reason: ${input.reason}. Session ${timeWords}. They will be emailed that you accessed their account.`,
    minutesLeft,
    elevated,
  };
}
