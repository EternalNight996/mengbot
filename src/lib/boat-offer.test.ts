import { describe, expect, it } from "vitest";
import { BOAT_OFFER, boatClaimMailto, boatOfferRuns } from "./boat-offer";

const SUBJECT = "MengBot website enquiry";
const BODY = "Hi MengBot team,\n\nI am using MengBot and would like to ask about ___.\n\nThanks!";

describe("the MengBot website offer", () => {
  it("goes to the official site and writes to our support address, with no end date", () => {
    expect(BOAT_OFFER.url).toBe("https://www.mengbot.com.cn");
    expect(BOAT_OFFER.claimTo).toBe("eternalnightyeah2@yeah.net");
    expect(BOAT_OFFER.until).toBeNull();
  });

  it("drafts the message to that address with our subject and body, for the person to send", () => {
    const mailto = boatClaimMailto();
    expect(mailto).toBe("mailto:eternalnightyeah2@yeah.net?subject=MengBot%20website%20enquiry&body=Hi%20MengBot%20team%2C%0D%0A%0D%0AI%20am%20using%20MengBot%20and%20would%20like%20to%20ask%20about%20___.%0D%0A%0D%0AThanks!");
    const url = new URL(mailto);
    expect(`${url.protocol}${url.pathname}`).toBe("mailto:eternalnightyeah2@yeah.net");
    expect([...url.searchParams.keys()]).toEqual(["subject", "body"]);
    expect(url.searchParams.get("subject")).toBe(SUBJECT);
    expect(url.searchParams.get("body")!.replace(/\r\n/g, "\n")).toBe(BODY);
    expect(mailto, "a space is %20, never +, which some mail apps show as it is").not.toContain("+");
  });

  it("runs until its end date, and for good while none is set", () => {
    const end = Date.UTC(2026, 11, 1);
    expect(boatOfferRuns(end)).toBe(true);
    expect(boatOfferRuns(end - 1, { ...BOAT_OFFER, until: end })).toBe(true);
    expect(boatOfferRuns(end, { ...BOAT_OFFER, until: end })).toBe(false);
    expect(boatOfferRuns(end + 1, { ...BOAT_OFFER, until: end })).toBe(false);
  });
});
