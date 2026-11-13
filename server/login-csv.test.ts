import { describe, expect, it } from "vitest";
import { parseLoginCsv } from "./login-csv.ts";

describe("login CSV import", () => {
  it("reads a 1Password export", () => {
    const csv = [
      "Title,Url,Username,Password,OTPAuth,Notes",
      'GitHub,https://github.com,octocat,"s3cret, with comma",,',
      "Empty site,,nobody,pw,,",
    ].join("\n");
    const rows = parseLoginCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ host: "github.com", username: "octocat", password: "s3cret, with comma" });
  });

  it("reads a Bitwarden export", () => {
    const csv = [
      "folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp",
      ",,login,Example,,,0,https://example.com/login,me@example.com,secret,",
    ].join("\n");
    const rows = parseLoginCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ host: "example.com", username: "me@example.com", password: "secret" });
  });

  it("skips rows without a username or a password", () => {
    const csv = "Title,Url,Username,Password\nA,https://a.com,,pw\nB,https://b.com,user,";
    expect(parseLoginCsv(csv)).toEqual([]);
  });

  it("ignores a file with no recognisable header", () => {
    expect(parseLoginCsv("a,b,c\n1,2,3")).toEqual([]);
  });
});
