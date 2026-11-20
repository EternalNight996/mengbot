import { describe, expect, it } from "vitest";
import { t } from "./i18n";
import { apiErrorCopy } from "./api-error-copy.ts";

describe("api error copy", () => {
  it("translates the desktop-only refusal", () => {
    expect(apiErrorCopy("forbidden: this change must come from the desktop app or a paired device")).toBe(t("api.error.desktopOnly"));
  });

  it("names the missing scope", () => {
    expect(apiErrorCopy("forbidden: this session lacks the admin scope")).toContain("admin");
  });

  it("translates a missing bot", () => {
    expect(apiErrorCopy("no such bot")).toBe(t("api.error.noSuchBot"));
  });

  it("translates the login form's own refusals", () => {
    expect(apiErrorCopy("Enter the password.")).toBe(t("api.error.loginPassword"));
    expect(apiErrorCopy("This login is in 1Password. Change or remove it there.")).toBe(t("api.error.loginReadOnly"));
  });

  it("keeps an unknown message as the server wrote it", () => {
    expect(apiErrorCopy("something new happened")).toBe("something new happened");
  });
});