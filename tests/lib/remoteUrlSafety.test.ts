import assert from "node:assert/strict";
import test from "node:test";

import {
  isBlockedHostname,
  isPrivateIpv4,
  isPrivateIpv6,
} from "../../lib/security/remoteUrlSafety.ts";

test("remote URL safety blocks private IPv4 and internal hostnames", () => {
  assert.equal(isPrivateIpv4("10.0.0.1"), true);
  assert.equal(isPrivateIpv4("172.16.4.20"), true);
  assert.equal(isPrivateIpv4("192.168.1.5"), true);
  assert.equal(isBlockedHostname("localhost"), true);
  assert.equal(isBlockedHostname("admin.local"), true);
  assert.equal(isBlockedHostname("service.internal"), true);
  assert.equal(isBlockedHostname("127.0.0.1"), true);
});

test("remote URL safety blocks loopback, link-local and mapped IPv6 ranges", () => {
  assert.equal(isPrivateIpv6("::1"), true);
  assert.equal(isPrivateIpv6("fe80::1234"), true);
  assert.equal(isPrivateIpv6("fd12:3456:789a::1"), true);
  assert.equal(isPrivateIpv6("::ffff:192.168.0.20"), true);
  assert.equal(isBlockedHostname("::1"), true);
});

test("remote URL safety allows public hosts", () => {
  assert.equal(isPrivateIpv4("8.8.8.8"), false);
  assert.equal(isPrivateIpv6("2606:4700:4700::1111"), false);
  assert.equal(isBlockedHostname("example.com"), false);
  assert.equal(isBlockedHostname("8.8.8.8"), false);
});
